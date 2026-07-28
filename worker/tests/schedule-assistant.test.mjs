import assert from "node:assert/strict";
import test from "node:test";

let handleScheduleAssistantRequest;
let PREFERENCE_PATCH_SCHEMA;
try {
  ({ handleScheduleAssistantRequest, PREFERENCE_PATCH_SCHEMA } = await import("../src/schedule-assistant.js"));
} catch (_) {
  // The first red run should fail on the explicit export assertion below,
  // rather than treating this as an uncaught module-resolution failure.
}

const validRequest = () => new Request("https://x/api/schedule-assistant/interpret", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "No classes before 9" }],
    currentPreferences: { version: 1, constraints: [] },
  }),
});

test("exports the schedule assistant request handler", () => {
  assert.equal(typeof handleScheduleAssistantRequest, "function");
});

function assertStrictRequiredPropertyParity(schema) {
  if (!schema || typeof schema !== "object") return;
  if (schema.type === "object" && schema.additionalProperties === false) {
    assert.deepEqual(
      [...(schema.required || [])].sort(),
      Object.keys(schema.properties || {}).sort(),
      "strict object schemas must require every declared property",
    );
  }
  Object.values(schema.properties || {}).forEach(assertStrictRequiredPropertyParity);
  (schema.anyOf || []).forEach(assertStrictRequiredPropertyParity);
  assertStrictRequiredPropertyParity(schema.items);
}

test("strict structured output requires every declared object property", () => {
  assertStrictRequiredPropertyParity(PREFERENCE_PATCH_SCHEMA);
  const patchSchema = PREFERENCE_PATCH_SCHEMA.properties.preferencePatch;
  assert.deepEqual(patchSchema.required, ["replaceKinds", "constraints"]);
  assert.equal(
    Object.hasOwn(patchSchema.properties.replaceKinds, "uniqueItems"),
    false,
    "Structured Outputs does not support the uniqueItems array keyword",
  );
  assert.deepEqual(patchSchema.properties.replaceKinds.items.enum, [
    "earliest_start", "latest_end", "avoid_day", "preferred_day", "light_day",
    "time_window_exception", "compact_schedule", "maximum_gap", "campus", "modality", "open_sections",
    "course_separation",
  ]);
});

test("rejects malformed assistant histories before calling OpenAI", async () => {
  assert.equal(typeof handleScheduleAssistantRequest, "function");
  const response = await handleScheduleAssistantRequest(new Request("https://x/api/schedule-assistant/interpret", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "system", content: "bad" }] }),
  }), { OPENAI_API_KEY: "test" }, async () => { throw new Error("must not call upstream"); });
  assert.equal(response.status, 400);
});

test("uses a supported low-cost API model without sending transcript data", async () => {
  assert.equal(typeof handleScheduleAssistantRequest, "function");
  let upstreamBody;
  const response = await handleScheduleAssistantRequest(new Request("https://x/api/schedule-assistant/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "No classes before 9" }],
      currentPreferences: { version: 1, constraints: [], grade: "A" },
    }),
  }), { OPENAI_API_KEY: "test" }, async (_url, init) => {
    upstreamBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      output_text: JSON.stringify({ preferencePatch: { replaceKinds: [], constraints: [] }, acknowledgement: "Got it." }),
    }), { status: 200 });
  });
  assert.equal(upstreamBody.model, "gpt-4o-mini");
  assert.equal(upstreamBody.reasoning, undefined);
  assert.equal(upstreamBody.text.verbosity, undefined);
  assert.ok(Number.isInteger(upstreamBody.max_output_tokens));
  assert.ok(upstreamBody.max_output_tokens >= 256 && upstreamBody.max_output_tokens <= 1024);
  assert.equal(upstreamBody.store, false);
  assert.equal(JSON.stringify(upstreamBody).includes("grade"), false);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { preferencePatch: { replaceKinds: [], constraints: [] }, acknowledgement: "Got it." });
});

test("vague named-course spacing asks for 30, 45, or 60 minutes and campus preference without calling OpenAI", async () => {
  let called = false;
  const response = await handleScheduleAssistantRequest(new Request("https://x/api/schedule-assistant/interpret", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: "I don't want micro and computer science so close together" }],
      currentPreferences: { version: 1, constraints: [] },
    }),
  }), { OPENAI_API_KEY: "test" }, async () => {
    called = true;
    throw new Error("must not call upstream");
  });
  assert.equal(called, false);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.preferencePatch, { replaceKinds: [], constraints: [] });
  assert.match(payload.acknowledgement, /30 minutes/i);
  assert.match(payload.acknowledgement, /45 minutes/i);
  assert.match(payload.acknowledgement, /1 hour/i);
  assert.match(payload.acknowledgement, /campus/i);
  assert.deepEqual(payload.clarification.replyOptions, ["30 minutes", "45 minutes", "1 hour", "Same campus", "Campus changes okay"]);
});

test("normalizes nullable strict-schema fields into a canonical preference patch", async () => {
  const response = await handleScheduleAssistantRequest(validRequest(), { OPENAI_API_KEY: "test" }, async () => {
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        preferencePatch: {
          replaceKinds: ["time_window_exception"],
          constraints: [{
            kind: "time_window_exception", strength: "soft", day: null,
            startMinutes: 540, endMinutes: 720, minimumClasses: 1, maximumClasses: null,
          }],
        },
        acknowledgement: "I will prioritize one morning class.",
      }),
    }), { status: 200 });
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.clone().json()).preferencePatch.replaceKinds, ["time_window_exception"]);
  assert.deepEqual((await response.json()).preferencePatch.constraints, [{
    kind: "time_window_exception", strength: "soft",
    startMinutes: 540, endMinutes: 720, minimumClasses: 1,
  }]);
});

test("rejects valid input when the complete upstream request would exceed 20 KB", async () => {
  let called = false;
  const messages = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: "x".repeat(900),
  }));
  const response = await handleScheduleAssistantRequest(new Request("https://x/api/schedule-assistant/interpret", {
    method: "POST",
    body: JSON.stringify({ messages, currentPreferences: { version: 1, constraints: [] } }),
  }), { OPENAI_API_KEY: "test" }, async () => {
    called = true;
    throw new Error("must not call upstream");
  });
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("bounds canonical current preference constraints before calling upstream", async () => {
  let called = false;
  const constraints = Array.from({ length: 21 }, () => ({ kind: "compact_schedule", strength: "soft" }));
  const response = await handleScheduleAssistantRequest(new Request("https://x/api/schedule-assistant/interpret", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", content: "Keep it compact" }], currentPreferences: { version: 1, constraints } }),
  }), { OPENAI_API_KEY: "test" }, async () => {
    called = true;
    throw new Error("must not call upstream");
  });
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("does not expose upstream failures or call a missing secret", async () => {
  assert.equal(typeof handleScheduleAssistantRequest, "function");
  const missingSecret = await handleScheduleAssistantRequest(validRequest(), {}, async () => {
    throw new Error("must not call upstream");
  });
  assert.equal(missingSecret.status, 503);

  let upstreamCalls = 0;
  const upstreamFailure = await handleScheduleAssistantRequest(validRequest(), { OPENAI_API_KEY: "test" }, async () => {
    upstreamCalls += 1;
    return new Response("sensitive upstream detail", { status: 429 });
  });
  assert.equal(upstreamFailure.status, 502);
  assert.equal(upstreamCalls, 1);
  const upstreamFailureBody = await upstreamFailure.text();
  assert.doesNotMatch(upstreamFailureBody, /sensitive|test/i);
  assert.match(upstreamFailureBody, /assistant_quota/);
});

test("retries one invalid assistant output and returns a valid second output", async () => {
  let calls = 0;
  const outboundBodies = [];
  const response = await handleScheduleAssistantRequest(validRequest(), { OPENAI_API_KEY: "test" }, async (_url, init) => {
    calls += 1;
    outboundBodies.push(init.body);
    const output_text = calls === 1
      ? "not-json"
      : JSON.stringify({ preferencePatch: { replaceKinds: ["earliest_start"], constraints: [{ kind: "earliest_start", strength: "hard", minutes: 540 }] }, acknowledgement: "I will start no earlier than 9." });
    return new Response(JSON.stringify({ output_text }), { status: 200 });
  });
  assert.equal(calls, 2);
  assert.deepEqual(await response.json(), {
    preferencePatch: { replaceKinds: ["earliest_start"], constraints: [{ kind: "earliest_start", strength: "hard", minutes: 540 }] },
    acknowledgement: "I will start no earlier than 9.",
  });
  assert.deepEqual(outboundBodies[0], outboundBodies[1]);
  outboundBodies.forEach((body) => {
    assert.ok(new TextEncoder().encode(body).length <= 20 * 1024);
    const parsed = JSON.parse(body);
    assert.equal(parsed.store, false);
    assert.equal(parsed.reasoning, undefined);
    assert.equal(JSON.stringify(parsed).includes("grade"), false);
  });
});

test("returns a generic 502 after exactly two invalid assistant outputs", async () => {
  let calls = 0;
  const response = await handleScheduleAssistantRequest(validRequest(), { OPENAI_API_KEY: "test" }, async () => {
    calls += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify({ preferencePatch: { replaceKinds: ["earliestStart"], constraints: [] }, acknowledgement: "Nope." }),
    }), { status: 200 });
  });
  assert.equal(calls, 2);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "schedule assistant returned an invalid response" });
});

test("does not retry a valid assistant output", async () => {
  let calls = 0;
  const response = await handleScheduleAssistantRequest(validRequest(), { OPENAI_API_KEY: "test" }, async () => {
    calls += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify({ preferencePatch: { replaceKinds: [], constraints: [] }, acknowledgement: "Got it." }),
    }), { status: 200 });
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
});

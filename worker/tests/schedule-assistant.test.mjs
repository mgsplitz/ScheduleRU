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
});

test("rejects malformed assistant histories before calling OpenAI", async () => {
  assert.equal(typeof handleScheduleAssistantRequest, "function");
  const response = await handleScheduleAssistantRequest(new Request("https://x/api/schedule-assistant/interpret", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "system", content: "bad" }] }),
  }), { OPENAI_API_KEY: "test" }, async () => { throw new Error("must not call upstream"); });
  assert.equal(response.status, 400);
});

test("uses Luna structured output without sending transcript data", async () => {
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
      output_text: JSON.stringify({ preferencePatch: { constraints: [] }, acknowledgement: "Got it." }),
    }), { status: 200 });
  });
  assert.equal(upstreamBody.model, "gpt-5.6-luna");
  assert.deepEqual(upstreamBody.reasoning, { effort: "low" });
  assert.equal(upstreamBody.store, false);
  assert.equal(JSON.stringify(upstreamBody).includes("grade"), false);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { preferencePatch: { constraints: [] }, acknowledgement: "Got it." });
});

test("normalizes nullable strict-schema fields into a canonical preference patch", async () => {
  const response = await handleScheduleAssistantRequest(validRequest(), { OPENAI_API_KEY: "test" }, async () => {
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        preferencePatch: {
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

  const upstreamFailure = await handleScheduleAssistantRequest(validRequest(), { OPENAI_API_KEY: "test" }, async () => {
    return new Response("sensitive upstream detail", { status: 429 });
  });
  assert.equal(upstreamFailure.status, 502);
  assert.doesNotMatch(await upstreamFailure.text(), /sensitive|test/i);
});

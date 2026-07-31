import "../../schedule-preference-logic.js";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARACTERS = 1_000;
const MAX_REQUEST_BYTES = 20 * 1024;
const MAX_ACKNOWLEDGEMENT_CHARACTERS = 280;
const ALLOWED_ROLES = new Set(["user", "assistant"]);
const REPLACE_KINDS = [
  "earliest_start", "latest_end", "avoid_day", "preferred_day", "light_day",
  "time_window_exception", "compact_schedule", "maximum_gap", "campus", "modality", "open_sections",
  "course_separation",
];
const NULLABLE_OUTPUT_FIELDS = new Set(["day", "minimumClasses", "maximumClasses"]);

const preferenceLogic = globalThis.ScheduleRUPreferenceLogic;

const CONSTRAINT_SCHEMAS = [
  { properties: { kind: { const: "earliest_start" }, strength: { enum: ["hard", "soft"] }, minutes: { type: "integer", minimum: 0, maximum: 1439 } }, required: ["kind", "strength", "minutes"] },
  { properties: { kind: { const: "latest_end" }, strength: { enum: ["hard", "soft"] }, minutes: { type: "integer", minimum: 0, maximum: 1439 } }, required: ["kind", "strength", "minutes"] },
  { properties: { kind: { enum: ["avoid_day", "preferred_day"] }, strength: { enum: ["hard", "soft"] }, day: { enum: ["M", "T", "W", "R", "F", "S", "U"] } }, required: ["kind", "strength", "day"] },
  { properties: { kind: { const: "light_day" }, strength: { enum: ["hard", "soft"] }, day: { enum: ["M", "T", "W", "R", "F", "S", "U"] }, maximumClasses: { type: "integer", minimum: 0, maximum: 100 } }, required: ["kind", "strength", "day", "maximumClasses"] },
  { properties: { kind: { const: "time_window_exception" }, strength: { enum: ["hard", "soft"] }, day: { enum: ["M", "T", "W", "R", "F", "S", "U", null] }, startMinutes: { type: "integer", minimum: 0, maximum: 1439 }, endMinutes: { type: "integer", minimum: 1, maximum: 1439 }, minimumClasses: { type: ["integer", "null"], minimum: 0, maximum: 100 }, maximumClasses: { type: ["integer", "null"], minimum: 0, maximum: 100 } }, required: ["kind", "strength", "day", "startMinutes", "endMinutes", "minimumClasses", "maximumClasses"] },
  { properties: { kind: { const: "compact_schedule" }, strength: { enum: ["hard", "soft"] } }, required: ["kind", "strength"] },
  { properties: { kind: { const: "maximum_gap" }, strength: { enum: ["hard", "soft"] }, minutes: { type: "integer", minimum: 0, maximum: 1439 } }, required: ["kind", "strength", "minutes"] },
  { properties: { kind: { enum: ["campus", "modality"] }, strength: { enum: ["hard", "soft"] }, value: { type: "string", minLength: 1, maxLength: 100 } }, required: ["kind", "strength", "value"] },
  { properties: { kind: { const: "open_sections" }, strength: { enum: ["hard", "soft"] }, value: { const: true } }, required: ["kind", "strength", "value"] },
  { properties: { kind: { const: "course_separation" }, strength: { enum: ["hard", "soft"] }, courseA: { type: "string", minLength: 1, maxLength: 100 }, courseB: { type: "string", minLength: 1, maxLength: 100 }, minutes: { enum: [30, 45, 60] }, campusPreference: { enum: ["same", "any"] } }, required: ["kind", "strength", "courseA", "courseB", "minutes", "campusPreference"] },
].map((schema) => ({ type: "object", additionalProperties: false, ...schema }));

export const PREFERENCE_PATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    preferencePatch: {
      type: "object",
      additionalProperties: false,
      properties: {
        replaceKinds: { type: "array", maxItems: REPLACE_KINDS.length, items: { enum: REPLACE_KINDS } },
        constraints: { type: "array", maxItems: 20, items: { anyOf: CONSTRAINT_SCHEMAS } },
      },
      required: ["replaceKinds", "constraints"],
    },
    acknowledgement: { type: "string", minLength: 1, maxLength: MAX_ACKNOWLEDGEMENT_CHARACTERS },
  },
  required: ["preferencePatch", "acknowledgement"],
};

function response(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function upstreamFailureCode(status) {
  if (status === 429) return "assistant_quota";
  if (status === 401 || status === 403) return "assistant_authentication";
  if (status === 400 || status === 404) return "assistant_configuration";
  return "assistant_upstream";
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasExactlyKeys(raw, keys) {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    && Object.keys(raw).length === keys.length && keys.every((key) => Object.hasOwn(raw, key));
}

function validMessages(messages) {
  return Array.isArray(messages) && messages.length > 0 && messages.length <= MAX_MESSAGES
    && messages.every((message) => message && typeof message === "object" && !Array.isArray(message)
      && ALLOWED_ROLES.has(message.role) && typeof message.content === "string"
      && message.content.trim().length > 0 && message.content.length <= MAX_MESSAGE_CHARACTERS);
}

function normalizedPreferences(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.version !== 1
    || !Array.isArray(raw.constraints) || raw.constraints.length > 20) return null;
  const normalized = preferenceLogic.normalizePreferenceSet(raw);
  return sameJson(normalized.constraints, raw.constraints) ? normalized : null;
}

function buildPreferencePrompt(messages, currentPreferences) {
  return [
    {
      role: "system",
      content: "Translate only schedule-preference conversation into the provided JSON schema. Do not infer sections, eligibility, academic records, credits, requirements, or schedule rankings. Return an empty constraints list when no supported preference is stated. A course_separation constraint may be created only after the conversation states both courses, one of 30, 45, or 60 minutes, and whether campuses must be the same or may be any. Set replaceKinds to every existing preference kind that the user changes, relaxes, or cancels; for example, changing no classes before 10am to no classes before 9am replaces earliest_start, while cancelling it replaces earliest_start with no new constraint. Keep the acknowledgement concise.",
    },
    {
      role: "user",
      content: JSON.stringify({ messages, currentPreferences }),
    },
  ];
}

function vagueNamedCourseSpacing(messages) {
  const latest = [...messages].reverse().find((message) => message.role === "user")?.content || "";
  const vagueSpacing = /\b(?:so\s+close|too\s+close|close\s+together|farther\s+apart|further\s+apart|more\s+space\s+between)\b/i.test(latest);
  const namesRelationship = /\b(?:and|between|them|these)\b/i.test(latest);
  const explicitGap = /\b(?:30|45|60)\s*(?:m|min|mins|minute|minutes)\b|\b1\s*(?:h|hr|hour)\b/i.test(latest);
  return vagueSpacing && namesRelationship && !explicitGap;
}

function outputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const textPart = payload?.output?.flatMap((item) => item?.content || []).find((part) => part?.type === "output_text" && typeof part.text === "string");
  return textPart?.text || null;
}

function validOutput(raw) {
  if (!hasExactlyKeys(raw, ["preferencePatch", "acknowledgement"]) || typeof raw.acknowledgement !== "string"
    || !hasExactlyKeys(raw.preferencePatch, ["replaceKinds", "constraints"])) return null;
  const acknowledgement = raw.acknowledgement.trim();
  if (!acknowledgement || acknowledgement.length > MAX_ACKNOWLEDGEMENT_CHARACTERS) return null;
  const constraints = raw.preferencePatch.constraints;
  if (!Array.isArray(constraints) || constraints.length > 20) return null;
  const canonicalConstraints = constraints.map((constraint) => {
    if (!constraint || typeof constraint !== "object" || Array.isArray(constraint)) return null;
    return Object.fromEntries(Object.entries(constraint).filter(([key, value]) => {
      return value !== null || constraint.kind !== "time_window_exception" || !NULLABLE_OUTPUT_FIELDS.has(key);
    }));
  });
  if (canonicalConstraints.some((constraint) => !constraint)) return null;
  const patch = preferenceLogic.normalizePreferencePatch({
    replaceKinds: raw.preferencePatch.replaceKinds,
    constraints: canonicalConstraints,
  });
  if (!patch) return null;
  return { preferencePatch: patch, acknowledgement };
}

export async function handleScheduleAssistantRequest(request, env, upstreamFetch = fetch) {
  let rawBody;
  try {
    rawBody = await request.text();
  } catch (_) {
    return response({ error: "invalid assistant request" }, 400);
  }
  if (!rawBody || new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
    return response({ error: "invalid assistant request" }, 400);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (_) {
    return response({ error: "invalid assistant request" }, 400);
  }
  const currentPreferences = normalizedPreferences(payload?.currentPreferences);
  if (!validMessages(payload?.messages) || !currentPreferences) {
    return response({ error: "invalid assistant request" }, 400);
  }
  if (vagueNamedCourseSpacing(payload.messages)) {
    return response({
      preferencePatch: { replaceKinds: [], constraints: [] },
      acknowledgement: "How much space would you prefer: 30 minutes, 45 minutes, or 1 hour? Should I keep the courses on the same campus, or are campus changes okay?",
      clarification: {
        replyOptions: ["30 minutes", "45 minutes", "1 hour", "Same campus", "Campus changes okay"],
      },
    }, 200);
  }
  if (!env?.OPENAI_API_KEY) return response({ error: "schedule assistant is unavailable" }, 503);

  const body = {
    model: env.SCHEDULE_ASSISTANT_MODEL || "gpt-4o-mini",
    max_output_tokens: 400,
    store: false,
    input: buildPreferencePrompt(payload.messages, currentPreferences),
    text: {
      format: { type: "json_schema", name: "schedule_preference_patch", strict: true, schema: PREFERENCE_PATCH_SCHEMA },
    },
  };
  const serializedBody = JSON.stringify(body);
  if (new TextEncoder().encode(serializedBody).length > MAX_REQUEST_BYTES) {
    return response({ error: "invalid assistant request" }, 400);
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let upstreamResponse;
    try {
      upstreamResponse = await upstreamFetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: serializedBody,
      });
    } catch (_) {
      return response({ error: "schedule assistant is temporarily unavailable" }, 502);
    }
    if (!upstreamResponse?.ok) {
      const code = upstreamFailureCode(upstreamResponse?.status);
      console.warn("schedule assistant upstream failure", {
        status: upstreamResponse?.status || 0,
        code,
        model: body.model,
      });
      return response({ error: "schedule assistant is temporarily unavailable", code }, 502);
    }

    try {
      const upstreamPayload = await upstreamResponse.json();
      const translated = validOutput(JSON.parse(outputText(upstreamPayload)));
      if (translated) return response(translated, 200);
    } catch (_) {
      // A malformed model response is the one retryable upstream condition.
    }
  }
  return response({ error: "schedule assistant returned an invalid response" }, 502);
}

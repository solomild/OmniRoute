/**
 * #9617 — antigravity/gemini returned [400] "Invalid JSON payload received.
 * Unknown name \"uniqueItems\" at 'request.tools[0].function_declarations[...]"
 *
 * Root cause: `uniqueItems` (a JSON Schema array constraint) was NOT listed in
 * `GEMINI_UNSUPPORTED_SCHEMA_KEYS`, so `cleanJSONSchemaForAntigravity` left it in
 * the function-declaration parameters. OpenAI clients (e.g. Qwen Code tool
 * schemas) send `uniqueItems: true` on array params; the Gemini/antigravity
 * upstream (OpenAPI 3.0 schema subset) rejects it with a hard 400.
 *
 * Fix: add `uniqueItems` to the unsupported-keys set so it is stripped at every
 * level (top-level property, nested object, and inside array `items`). Sibling
 * array constraints `minItems`/`maxItems` are also unsupported and must stay
 * stripped; `description` must survive.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanJSONSchemaForAntigravity,
  GEMINI_UNSUPPORTED_SCHEMA_KEYS,
} from "../../open-sse/translator/helpers/geminiHelper.ts";

test("#9617 uniqueItems is stripped at all levels for antigravity/gemini schemas", () => {
  const schema = {
    type: "object",
    properties: {
      // Mirrors Qwen Code's todo_write.blockedBy tool param.
      blockedBy: {
        type: "array",
        uniqueItems: true,
        items: { type: "string" },
      },
      // Mirrors Qwen Code's update_goal.evidenceRefs tool param (nested items).
      evidenceRefs: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        maxItems: 100,
        description: "Exact values from the latest get_goal evidenceCatalog entries.",
        items: {
          type: "object",
          properties: {
            uuid: { type: "string", uniqueItems: true },
          },
        },
      },
    },
  };

  const cleaned = JSON.stringify(cleanJSONSchemaForAntigravity(schema));

  assert.ok(!cleaned.includes("uniqueItems"), "uniqueItems must be removed");
  // minItems/maxItems are also unsupported for antigravity — must stay stripped.
  assert.ok(!cleaned.includes("minItems"), "minItems must be removed");
  assert.ok(!cleaned.includes("maxItems"), "maxItems must be removed");
  // description is supported and must survive.
  assert.ok(cleaned.includes("description"), "description must be preserved");
});

test("#9617 uniqueItems is in GEMINI_UNSUPPORTED_SCHEMA_KEYS", () => {
  assert.ok(GEMINI_UNSUPPORTED_SCHEMA_KEYS.has("uniqueItems"));
});

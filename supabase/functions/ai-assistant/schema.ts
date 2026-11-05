// Minimal JSON-schema validator for tool arguments (subset used by our strict tool schemas).
// Pure TypeScript: no Deno/npm imports so it can be unit-tested with vitest.

export type JsonSchema = {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  maxItems?: number;
  minItems?: number;
  format?: "date" | "date-time" | "uuid";
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function check(value: unknown, schema: JsonSchema, path: string, errors: string[]): unknown {
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : [];
  const actual = typeOf(value);
  if (types.length) {
    const ok = types.some((t) => t === actual || (t === "number" && actual === "integer"));
    if (!ok) { errors.push(`${path}: expected ${types.join("|")}, got ${actual}`); return value; }
  }
  if (value === null) return value;
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: must be one of ${schema.enum.join(", ")}`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: too long (max ${schema.maxLength})`);
    if (schema.format === "uuid" && !UUID_RE.test(value)) errors.push(`${path}: not a valid id`);
    if (schema.format === "date" && (!DATE_RE.test(value) || Number.isNaN(Date.parse(value)))) errors.push(`${path}: must be YYYY-MM-DD`);
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) errors.push(`${path}: must be an ISO date-time`);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${path}: must be finite`);
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: must be <= ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: too many items (max ${schema.maxItems})`);
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((item, i) => check(item, schema.items!, `${path}[${i}]`, errors));
  }
  if (actual === "object" && schema.properties) {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in obj)) errors.push(`${path}.${key}: required`);
    for (const [key, v] of Object.entries(obj)) {
      const sub = schema.properties[key];
      if (!sub) { if (schema.additionalProperties === false) errors.push(`${path}.${key}: unknown field`); continue; }
      check(v, sub, `${path}.${key}`, errors);
    }
  }
  return value;
}

export type ValidationResult = { ok: true; value: Record<string, unknown> } | { ok: false; errors: string[] };

/** Parse a JSON string (as returned by the model) and validate it against the schema. */
export function parseAndValidate(raw: unknown, schema: JsonSchema): ValidationResult {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try { parsed = raw.trim() ? JSON.parse(raw) : {}; } catch { return { ok: false, errors: ["arguments are not valid JSON"] }; }
  }
  if (typeOf(parsed) !== "object") return { ok: false, errors: ["arguments must be a JSON object"] };
  const errors: string[] = [];
  check(parsed, schema, "args", errors);
  if (errors.length) return { ok: false, errors: errors.slice(0, 8) };
  // Strict-mode schemas make optional fields nullable; drop nulls so handlers use `undefined`.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) if (v !== null) cleaned[k] = v;
  return { ok: true, value: cleaned };
}

/** Stable JSON (sorted keys) so equal arguments always hash equally. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- helpers to author strict schemas ----
export const str = (description: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: "string", description, ...extra });
export const nullable = (s: JsonSchema): JsonSchema => ({
  ...s,
  type: [...(Array.isArray(s.type) ? s.type : [s.type ?? "string"]), "null"],
  ...(s.enum ? { enum: [...s.enum, null] } : {}),
});

/** Strip keywords OpenAI strict mode rejects (length limits); the server validator still enforces them. */
export function toOpenAiSchema(s: JsonSchema): JsonSchema {
  const { minLength: _a, maxLength: _b, ...rest } = s;
  const out: JsonSchema = { ...rest };
  if (s.properties) out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toOpenAiSchema(v)]));
  if (s.items) out.items = toOpenAiSchema(s.items);
  return out;
}
/** Build a strict object schema: every property required, optional ones must already be nullable. */
export const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});

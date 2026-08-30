import z from "zod";

/**
 * The JSON Schema keywords Gemini accepts in `responseJsonSchema`, as documented
 * on `GenerateContentConfig.responseJsonSchema` in `@google/genai`.
 */
const SUPPORTED_KEYWORDS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

/**
 * Keywords whose value is a map of *names* to sub-schemas. Their keys are user
 * data, not schema keywords, and must survive filtering.
 */
const SCHEMA_MAP_KEYWORDS = new Set(["$defs", "properties"]);

/**
 * Recursively drops keywords Gemini does not understand.
 *
 * @param {unknown} node - A JSON Schema node.
 * @returns {unknown} The node with unsupported keywords removed.
 */
const stripUnsupported = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    return node.map(stripUnsupported);
  }

  if (node === null || typeof node !== "object") {
    return node;
  }

  const result: Record<string, unknown> = {};

  for (const [keyword, value] of Object.entries(node)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) continue;

    result[keyword] = SCHEMA_MAP_KEYWORDS.has(keyword)
      ? stripUnsupportedFromSchemaMap(value)
      : stripUnsupported(value);
  }

  return result;
};

/**
 * Walks a name-to-sub-schema map, preserving the names verbatim.
 *
 * @param {unknown} node - The value of a `properties` or `$defs` keyword.
 * @returns {unknown} The map with each sub-schema sanitised.
 */
const stripUnsupportedFromSchemaMap = (node: unknown): unknown => {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return node;
  }

  return Object.fromEntries(
    Object.entries(node).map(([name, subSchema]) => [
      name,
      stripUnsupported(subSchema),
    ]),
  );
};

/**
 * Converts a Zod schema into a JSON Schema that Gemini will accept for
 * constrained decoding, keeping the Zod schema as the single source of truth.
 *
 * `z.toJSONSchema` emits `$schema`, `default` and `minLength` for our schemas, and
 * none of those are in Gemini's supported subset - hence the filtering pass.
 *
 * `io: "input"` is deliberate: the model produces the value we are about to parse,
 * which is the *input* side of any schema carrying a `.default()`.
 *
 * @param {z.ZodType} schema - The Zod schema describing the expected response.
 * @returns {Record<string, unknown>} A Gemini-compatible JSON Schema.
 */
export const toGeminiResponseSchema = (
  schema: z.ZodType,
): Record<string, unknown> =>
  stripUnsupported(z.toJSONSchema(schema, { io: "input" })) as Record<
    string,
    unknown
  >;

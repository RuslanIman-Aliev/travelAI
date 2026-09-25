import { toGeminiResponseSchema } from "@/lib/gemini-schema";
import { aiGenerationResponseSchema } from "@/lib/validators";
import z from "zod";

/** Keywords Gemini documents as supported for `responseJsonSchema`. */
const SUPPORTED = new Set([
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
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

const SCHEMA_MAPS = new Set(["properties", "$defs"]);

/** Collects every schema keyword used anywhere in the document. */
const collectKeywords = (node: unknown, insideNameMap = false): string[] => {
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectKeywords(child, false));
  }
  if (node === null || typeof node !== "object") return [];

  return Object.entries(node).flatMap(([key, value]) => [
    ...(insideNameMap ? [] : [key]),
    ...collectKeywords(value, SCHEMA_MAPS.has(key)),
  ]);
};

describe("toGeminiResponseSchema", () => {
  it("emits only keywords Gemini supports", () => {
    const schema = toGeminiResponseSchema(aiGenerationResponseSchema);
    const unsupported = [...new Set(collectKeywords(schema))].filter(
      (keyword) => !SUPPORTED.has(keyword),
    );

    expect(unsupported).toEqual([]);
  });

  it("drops the keywords zod emits that Gemini rejects", () => {
    // Regression guard: zod produces all three for our schemas.
    const schema = toGeminiResponseSchema(
      z.object({
        name: z.string().min(1),
        note: z.string().optional().default(""),
      }),
    );

    expect(schema).not.toHaveProperty("$schema");
    expect(JSON.stringify(schema)).not.toContain("minLength");
    expect(JSON.stringify(schema)).not.toContain("default");
  });

  it("keeps property names that collide with schema keywords", () => {
    const schema = toGeminiResponseSchema(
      z.object({ type: z.string(), items: z.string(), default: z.string() }),
    );

    expect(Object.keys(schema.properties as object).sort()).toEqual([
      "default",
      "items",
      "type",
    ]);
  });

  it("preserves the structure the model has to follow", () => {
    const schema = toGeminiResponseSchema(aiGenerationResponseSchema);

    // The error escape hatch and the itinerary are both reachable, otherwise
    // constrained decoding would make the invalid-destination path impossible.
    expect(schema.anyOf).toHaveLength(2);

    const [errorVariant, itineraryVariant] = schema.anyOf as Array<{
      properties: Record<string, unknown>;
    }>;

    expect(Object.keys(errorVariant.properties)).toEqual(["error"]);
    expect(itineraryVariant.properties).toHaveProperty("itinerary");
  });

  it("drops array bounds, which Gemini rejects for a nested array", () => {
    // `minItems`/`maxItems` are documented as supported but produce a 400 once
    // an array sits inside another array's `items` - days holding activities,
    // which is exactly this response. The bounds still hold: they are enforced
    // when the response is parsed with the Zod schema.
    const schema = toGeminiResponseSchema(aiGenerationResponseSchema);

    expect(JSON.stringify(schema)).not.toContain("minItems");
    expect(JSON.stringify(schema)).not.toContain("maxItems");
  });
});

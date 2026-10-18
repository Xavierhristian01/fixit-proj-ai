import { describe, expect, it } from "vitest";
import { parseLooseJson } from "@/lib/ai.functions";
describe("photo findings parsing", () => {
  it("reads JSON wrapped in code fences", () => expect(parseLooseJson('```json\n{"confidence":"low"}\n```')).toEqual({ confidence: "low" }));
  it("reads plain JSON", () => expect(parseLooseJson('{"a":1}')).toEqual({ a: 1 }));
});

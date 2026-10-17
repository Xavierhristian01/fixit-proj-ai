import { describe, expect, it } from "vitest";
import { safetyReason } from "@/lib/safety";

describe("safety triggers", () => {
  for (const t of ["brakes are soft", "steering is heavy", "gas leak in kitchen", "fuel leaking from gen", "white smoke coming out", "burning smell from fan", "sparks from socket", "mains wiring problem"]) {
    it(`stops on: ${t}`, () => expect(safetyReason(t)).not.toBeNull());
  }
  it("does not stop on a normal problem", () => expect(safetyReason("pump runs but no water")).toBeNull());
});

import { describe, expect, it } from "vitest";
import { assessSafety, safetyReason } from "@/lib/safety";

describe("safety triggers", () => {
  for (const t of ["brakes are soft", "steering is heavy", "fuel leaking from gen", "repair brake hydraulics", "replace suspension parts", "replace an airbag", "repair a gas cylinder", "mains wiring problem", "repair inside a microwave", "sealed refrigerant system", "generator internals carrying high voltage"]) {
    it(`needs trained help: ${t}`, () => expect(assessSafety(t)?.risk).toBe("pro"));
  }
  for (const t of ["gas leak in kitchen", "a smell of gas", "smoke from wiring", "sparks from socket", "fuel pouring out", "someone shocked", "someone hurt", "engine caught fire"]) {
    it(`emergency: ${t}`, () => expect(assessSafety(t)?.risk).toBe("emergency"));
  }
  for (const t of ["pump runs but no water", "change a tyre", "jump-start my car", "check engine oil", "clean the spark plug", "change the oil", "prime the pump", "clean the fan", "black smoke from exhaust", "white smoke coming out", "replace a plug fuse", "handle fuel with engine off", "oil puddle under generator", "no smoke, no sparks, no gas smell", "parking brake engaged"]) {
    it(`does not blanket-stop: ${t}`, () => expect(safetyReason(t)).toBeNull());
  }
});

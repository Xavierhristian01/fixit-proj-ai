import { describe, expect, it } from "vitest";
import { applyEffect, getScenario, machines } from "@/lib/mock-data";

const pump = machines.find((m) => m.id === "pump")!;
const car = machines.find((m) => m.id === "car")!;

describe("demo scenarios", () => {
  it("water pump + runs but no water asks 3 questions", () => {
    expect(getScenario(pump, "Runs but no water").questions).toHaveLength(3);
  });
  it("causes sort highest first after an answer", () => {
    const s = getScenario(pump, "Runs but no water");
    const next = applyEffect(s.causes, s.questions[0].effects.no);
    expect(next[0].label).toBe("Dry well or empty tank");
  });
  it("car + brakes feel soft ends in a safety stop", () => {
    expect(getScenario(car, "Brakes feel soft").result.kind).toBe("safety");
  });
});

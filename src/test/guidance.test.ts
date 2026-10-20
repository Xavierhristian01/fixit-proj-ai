import { describe, expect, it } from "vitest";
import { buildReport, normalizeTurn, safetyTurn, toResult, type AiTurn } from "@/lib/ai-contract";
import { assessSafety } from "@/lib/safety";
import { quickFixes } from "@/lib/mock-data";

const guide: AiTurn = {
  mode: "guide", risk: "careful", reply: "Here is your plan.", question: null, causes: [], status: "guide_ready",
  before_you_start: { tools: ["Jack", "Spare tyre"], safety_first: ["Level ground"] },
  checklist: Array.from({ length: 4 }, (_, i) => ({ step: `Action ${i + 1}`, difficulty: "medium", warning: i === 2 ? "Never go under a jack-only vehicle." : null, source: null })),
  stop_if: ["The jack moves"], situation: [{ label: "Location", value: "Home" }], safety_message: null,
};

describe("practical guidance rules", () => {
  it("offers the requested jobs by machine", () => {
    expect(quickFixes.car).toEqual(["Change a tyre", "Jump-start", "Check engine oil"]);
    expect(quickFixes.generator).toEqual(["Clean the spark plug", "Change the oil"]);
    expect(quickFixes.pump).toEqual(["Prime the pump"]);
    expect(quickFixes.fan).toEqual(["Clean the fan"]);
    expect(quickFixes.other).toEqual([]);
  });
  it("retains preparations, step warnings and stop signs in the ready guide", () => {
    const r = toResult(guide, "Change a tyre");
    expect(r.kind).toBe("guide");
    expect(r.risk).toBe("careful");
    expect(r.before_you_start?.tools).toEqual(["Jack", "Spare tyre"]);
    expect(r.steps[2]?.warning).toBe("Never go under a jack-only vehicle.");
    expect(r.stop_if).toEqual(["The jack moves"]);
  });
  it("preserves the diagnosed cause when continuing into guide mode", () => {
    const r = toResult(guide, "Prime pump", { name: "Lost prime", likelihood: 85, why: "Air" });
    expect(r.kind === "fix" && r.cause).toBe("Lost prime");
    expect(r.kind === "fix" && r.confidence).toBe(85);
  });
  it("guide reports contain the job and only completed steps in step order", () => {
    const report = buildReport("Car", "Change a tyre", toResult(guide, "Change a tyre"), [2, 0]);
    expect(report).toContain("Job: Change a tyre");
    expect(report).toContain("1. Action 1\n3. Action 3");
    expect(report).not.toContain("Action 2");
    expect(report).not.toContain("Action 4");
  });
  it("safety stops retain only immediate safe actions, including emergency 112", () => {
    const decision = assessSafety("smoke from wiring");
    if (!decision) throw new Error("Expected emergency");
    const r = toResult(safetyTurn(decision, "english", "guide"), "Smoke");
    expect(r.kind).toBe("safety");
    expect(r.risk).toBe("emergency");
    expect(r.steps.some((s) => s.text.includes("112"))).toBe(true);
    expect(r.steps).toHaveLength(4);
  });
  it("photo flags alone do not stop oil leaks or worn parts", () => {
    expect(assessSafety(JSON.stringify({ safety_flags: ["Oil puddle", "Rusty exhaust"] }))).toBeNull();
    expect(assessSafety(JSON.stringify({ safety_flags: ["Smoke from wiring"] }))?.risk).toBe("emergency");
  });
  it("uses no source without a verified pack", () => {
    const r = normalizeTurn({ ...guide, checklist: guide.checklist.map((s) => ({ ...s, source: "Invented p.12" })) }, false);
    expect(r.checklist.every((s) => s.source === null)).toBe(true);
  });
  it("allows 4–12 steps and rejects shorter or oversized guides", () => {
    expect(() => normalizeTurn(guide, false)).not.toThrow();
    expect(() => normalizeTurn({ ...guide, checklist: guide.checklist.slice(0, 3) }, false)).toThrow();
  });
  it("only pro and emergency risk may end in safety stop", () => {
    expect(() => normalizeTurn({ ...guide, status: "safety_stop", risk: "diy" }, false)).toThrow();
    expect(normalizeTurn({ ...guide, risk: "pro" }, false).status).toBe("safety_stop");
  });
});
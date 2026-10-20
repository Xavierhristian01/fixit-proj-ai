import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "@/components/fixit/HomeScreen";

describe("quick fixes start guidance", () => {
  for (const [machine, job, id] of [["Car", "Change a tyre", "car"], ["Generator", "Clean the spark plug", "generator"], ["Water pump", "Prime the pump", "pump"], ["Standing fan", "Clean the fan", "fan"]]) {
    it(`${job} starts guide mode for ${machine}`, () => {
      const start = vi.fn();
      render(<HomeScreen onStart={start} />);
      fireEvent.click(screen.getByRole("button", { name: `${machine} Verified` }));
      fireEvent.click(screen.getByRole("button", { name: job, exact: true }));
      expect(start).toHaveBeenCalledWith(expect.objectContaining({ id }), job, null, "guide");
    });
  }
});
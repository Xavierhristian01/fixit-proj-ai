import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HomeScreen } from "@/components/fixit/HomeScreen";

function card(name: string) {
  return screen.getByRole("button", { name: new RegExp(name, "i") });
}

// The safer default: no machine is pre-selected as "verified", so the user has to
// name their own equipment before FixIt assumes anything about it.
describe("HomeScreen default machine", () => {
  it("highlights Something else and not Water pump on first render", () => {
    render(<HomeScreen onStart={vi.fn()} />);

    expect(card("Something else")).toHaveClass("border-primary");
    expect(card("Water pump")).not.toHaveClass("border-primary");
  });
});

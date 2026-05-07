import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stack } from "./Stack";

describe("Stack", () => {
  it("renders children with flex-col", () => {
    render(<Stack data-testid="x">a</Stack>);
    expect(screen.getByTestId("x").className).toContain("flex-col");
  });

  it("uses the gap prop", () => {
    render(<Stack data-testid="x" gap={2}>a</Stack>);
    expect(screen.getByTestId("x").className).toContain("gap-2");
  });
});

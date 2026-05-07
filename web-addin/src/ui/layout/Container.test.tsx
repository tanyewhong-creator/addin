import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Container } from "./Container";

describe("Container", () => {
  it("renders with mx-auto and default lg max width", () => {
    render(<Container data-testid="x">a</Container>);
    const el = screen.getByTestId("x");
    expect(el.className).toContain("mx-auto");
    expect(el.className).toContain("max-w-5xl");
  });

  it("applies size prop", () => {
    render(<Container data-testid="x" size="sm">a</Container>);
    expect(screen.getByTestId("x").className).toContain("max-w-2xl");
  });
});

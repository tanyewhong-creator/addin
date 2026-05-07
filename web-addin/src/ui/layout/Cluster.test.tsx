import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Cluster } from "./Cluster";

describe("Cluster", () => {
  it("renders with flex-row and flex-wrap", () => {
    render(<Cluster data-testid="x">a</Cluster>);
    const el = screen.getByTestId("x");
    expect(el.className).toContain("flex-row");
    expect(el.className).toContain("flex-wrap");
  });

  it("applies justify and align props", () => {
    render(<Cluster data-testid="x" justify="between" align="baseline">a</Cluster>);
    const el = screen.getByTestId("x");
    expect(el.className).toContain("justify-between");
    expect(el.className).toContain("items-baseline");
  });
});

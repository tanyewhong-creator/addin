import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>hello</Card>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("forwards className", () => {
    render(<Card data-testid="x" className="custom-class" />);
    expect(screen.getByTestId("x").className).toContain("custom-class");
  });
});

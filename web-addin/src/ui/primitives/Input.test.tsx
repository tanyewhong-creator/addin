import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";

describe("Input", () => {
  it("renders an <input>", () => {
    render(<Input data-testid="x" />);
    expect(screen.getByTestId("x").tagName).toBe("INPUT");
  });

  it("forwards placeholder", () => {
    render(<Input placeholder="email" />);
    expect(screen.getByPlaceholderText("email")).toBeInTheDocument();
  });

  it("renders disabled state", () => {
    render(<Input disabled data-testid="x" />);
    expect(screen.getByTestId("x")).toBeDisabled();
  });

  it("applies invalid styling when invalid=true", () => {
    render(<Input invalid data-testid="x" />);
    const el = screen.getByTestId("x");
    expect(el.className).toMatch(/danger/);
  });
});

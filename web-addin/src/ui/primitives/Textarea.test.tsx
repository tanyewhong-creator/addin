import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("renders a <textarea>", () => {
    render(<Textarea data-testid="x" />);
    expect(screen.getByTestId("x").tagName).toBe("TEXTAREA");
  });
});

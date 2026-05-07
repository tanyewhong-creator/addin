import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Label } from "./Label";

describe("Label", () => {
  it("renders as a <span> with uppercase styling", () => {
    render(<Label>hello</Label>);
    const el = screen.getByText("hello");
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toContain("uppercase");
  });
});

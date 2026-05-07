import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Caption } from "./Caption";

describe("Caption", () => {
  it("renders as a <span>", () => {
    render(<Caption>hello</Caption>);
    const el = screen.getByText("hello");
    expect(el.tagName).toBe("SPAN");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandBar } from "./CommandBar";

describe("CommandBar", () => {
  it("renders nothing when closed", () => {
    render(<CommandBar isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog when open", () => {
    render(<CommandBar isOpen onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("calls onClose on Escape", () => {
    let closed = false;
    render(<CommandBar isOpen onClose={() => (closed = true)} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closed).toBe(true);
  });
});

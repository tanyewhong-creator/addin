import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(<Modal open={false} onClose={() => {}}>x</Modal>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog when open", () => {
    render(<Modal open onClose={() => {}}>x</Modal>);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders title", () => {
    render(<Modal open onClose={() => {}} title="Confirm">x</Modal>);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    let closed = false;
    render(<Modal open onClose={() => (closed = true)}>x</Modal>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closed).toBe(true);
  });

  it("closes on backdrop click", () => {
    let closed = false;
    render(<Modal open onClose={() => (closed = true)}>x</Modal>);
    fireEvent.click(screen.getByRole("dialog"));
    expect(closed).toBe(true);
  });

  it("does NOT close on inner content click", () => {
    let closed = false;
    render(<Modal open onClose={() => (closed = true)}>
      <button data-testid="inner">x</button>
    </Modal>);
    fireEvent.click(screen.getByTestId("inner"));
    expect(closed).toBe(false);
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";

function Probe() {
  const toast = useToast();
  return (
    <button onClick={() => toast("hello")} data-testid="trigger">trigger</button>
  );
}

describe("Toast", () => {
  it("useToast outside Provider throws", () => {
    function P() { useToast(); return null; }
    const orig = console.error;
    console.error = () => {};
    expect(() => render(<P />)).toThrow();
    console.error = orig;
  });

  it("renders no toasts initially", () => {
    render(<ToastProvider><div /></ToastProvider>);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("displays a toast when triggered", async () => {
    render(<ToastProvider><Probe /></ToastProvider>);
    await userEvent.click(screen.getByTestId("trigger"));
    expect(screen.getByRole("status")).toHaveTextContent("hello");
  });

  it("auto-dismisses after the duration", async () => {
    vi.useFakeTimers();
    function ProbeShort() {
      const toast = useToast();
      return (
        <button onClick={() => toast("bye", { durationMs: 100 })} data-testid="t">
          x
        </button>
      );
    }
    render(<ToastProvider><ProbeShort /></ToastProvider>);
    fireEvent.click(screen.getByTestId("t"));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

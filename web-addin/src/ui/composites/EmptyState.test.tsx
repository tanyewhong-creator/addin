import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders message", () => {
    render(<EmptyState message="nothing here yet" />);
    expect(screen.getByText("nothing here yet")).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(<EmptyState message="x" action={<button>add</button>} />);
    expect(screen.getByRole("button", { name: "add" })).toBeInTheDocument();
  });
});

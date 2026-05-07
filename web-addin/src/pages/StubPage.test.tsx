import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StubPage } from "./StubPage";

describe("StubPage", () => {
  it("renders the page title", () => {
    render(<StubPage title="Memory" />);
    expect(screen.getByRole("heading", { name: "Memory" })).toBeInTheDocument();
  });

  it("renders the v2.1 message", () => {
    render(<StubPage title="X" />);
    expect(screen.getByText(/ships in v2.1/i)).toBeInTheDocument();
  });

  it("references the CLI fallback", () => {
    render(<StubPage title="X" />);
    expect(screen.getByText(/.addin\/config.yaml/i)).toBeInTheDocument();
  });
});

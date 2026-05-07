import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Heading } from "./Heading";

describe("Heading", () => {
  it("renders as h1 by default", () => {
    render(<Heading>x</Heading>);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders as h2 when level=2", () => {
    render(<Heading level={2}>x</Heading>);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});

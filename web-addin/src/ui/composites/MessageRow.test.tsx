import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageRow } from "./MessageRow";

describe("MessageRow", () => {
  it("renders actor and timestamp", () => {
    render(<MessageRow actor="you" timestamp="14:02">hello</MessageRow>);
    expect(screen.getByText(/you/)).toBeInTheDocument();
    expect(screen.getByText(/14:02/)).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "./Icon";
import { Check, X } from "./allowlist";

describe("Icon", () => {
  it("renders the requested lucide icon", () => {
    const { container } = render(<Icon icon={Check} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("forces stroke-width=1 by default", () => {
    const { container } = render(<Icon icon={X} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("stroke-width", "1");
  });

  it("accepts a strokeWidth override", () => {
    const { container } = render(<Icon icon={X} strokeWidth={2} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("stroke-width", "2");
  });

  it("defaults size to 16 (rendered as width/height attribute)", () => {
    const { container } = render(<Icon icon={X} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "16");
  });
});

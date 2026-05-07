import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "./TopBar";

describe("TopBar", () => {
  it("renders brand, nav, end", () => {
    render(
      <TopBar
        brand={<span>BRAND</span>}
        nav={<span>NAV</span>}
        end={<span>END</span>}
      />,
    );
    expect(screen.getByText("BRAND")).toBeInTheDocument();
    expect(screen.getByText("NAV")).toBeInTheDocument();
    expect(screen.getByText("END")).toBeInTheDocument();
  });

  it("renders as <header>", () => {
    render(<TopBar brand={<span>x</span>} />);
    expect(screen.getByRole("banner")).toBeInTheDocument(); // <header> role
  });
});

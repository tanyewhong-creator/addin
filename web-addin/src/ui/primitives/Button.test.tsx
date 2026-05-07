import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("renders as a <button> element", () => {
    render(<Button>X</Button>);
    expect(screen.getByRole("button").tagName).toBe("BUTTON");
  });

  it("accepts onClick", async () => {
    let clicked = false;
    render(<Button onClick={() => (clicked = true)}>X</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(clicked).toBe(true);
  });

  it("renders all three variants without throwing", () => {
    render(
      <>
        <Button variant="primary">P</Button>
        <Button variant="secondary">S</Button>
        <Button variant="ghost">G</Button>
      </>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("applies the danger intent class", () => {
    render(<Button intent="danger">Delete</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/danger|red/);
  });

  it("forwards extra props to the button element", () => {
    render(<Button data-testid="probe" aria-label="x">X</Button>);
    const btn = screen.getByTestId("probe");
    expect(btn).toHaveAttribute("aria-label", "x");
  });

  it("renders disabled state", () => {
    render(<Button disabled>X</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders loading state with disabled and a spinner sibling", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.children.length).toBeGreaterThan(0);
  });
});

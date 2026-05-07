import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "./Field";
import { Input } from "./Input";

describe("Field", () => {
  it("renders the label", () => {
    render(
      <Field label="Email">
        <Input />
      </Field>,
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("connects label to input via id/htmlFor", () => {
    render(
      <Field label="Email">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("renders error message and sets aria-invalid", () => {
    render(
      <Field label="Email" error="required">
        <Input />
      </Field>,
    );
    expect(screen.getByText("required")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders help text when no error", () => {
    render(
      <Field label="Email" help="we wont share it">
        <Input />
      </Field>,
    );
    expect(screen.getByText("we wont share it")).toBeInTheDocument();
  });

  it("hides help text when error is present", () => {
    render(
      <Field label="Email" help="we wont share it" error="bad">
        <Input />
      </Field>,
    );
    expect(screen.queryByText("we wont share it")).not.toBeInTheDocument();
    expect(screen.getByText("bad")).toBeInTheDocument();
  });

  it("renders required marker", () => {
    render(
      <Field label="Email" required>
        <Input />
      </Field>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});

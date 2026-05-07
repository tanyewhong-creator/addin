import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters falsy", () => {
    const off = false as boolean;
    expect(cn("foo", off && "bar", null, undefined, "baz")).toBe("foo baz");
  });

  it("dedupes Tailwind utility conflicts", () => {
    // tailwind-merge resolves: text-neutral-500 wins over text-neutral-900
    expect(cn("text-neutral-900", "text-neutral-500")).toBe("text-neutral-500");
  });
});

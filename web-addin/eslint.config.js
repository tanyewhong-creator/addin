import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", "storybook-static", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Import icons from src/ui/icons/allowlist instead. " +
                "Add to allowlist if a new icon is needed.",
            },
          ],
        },
      ],
    },
  },
  // Allow the allowlist file (re-export hub) and Icon.tsx (type-only imports)
  // to import from lucide-react.
  {
    files: ["src/ui/icons/allowlist.ts", "src/ui/icons/Icon.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
);

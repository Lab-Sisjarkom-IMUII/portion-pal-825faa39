import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Keep these rules strict; use unknown/proper types instead of any
      "@typescript-eslint/no-explicit-any": "warn",
      // Some config files (tailwind) use require() style imports; allow them.
      "@typescript-eslint/no-require-imports": "off",
      // Allow empty object types in UI helper interfaces from template (generated code)
      "@typescript-eslint/no-empty-object-type": "off",
      // Allow unsafe function type for now (used in supabase SDK invoke typing workaround)
      "@typescript-eslint/no-unsafe-function-type": "warn",
    },
  },
);

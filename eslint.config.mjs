import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".artifacts/**",
      "coverage/**",
      "dist/**",
      "drizzle/archive/**",
      "drizzle/meta/**",
      "node_modules/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
      "no-useless-assignment": "off",
      "no-useless-escape": "off",
      "preserve-caught-error": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,mjs,cjs,ts}", "**/*.test.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "no-undef": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  }
);

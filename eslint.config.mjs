import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"],
  },
  {
    files: ["**/*.{js,cjs,mjs,ts,tsx,mts,cts}"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);

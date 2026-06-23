import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // `set-state-in-effect` is an advisory React-Compiler perf rule (synchronous
    // setState inside an effect can cause one extra render). It is not a
    // correctness bug, and the affected effects here (mount flags, object-URL
    // image previews, derived state) are intentional. Keep it a warning rather
    // than a build-blocking error; refactor case-by-case over time.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;

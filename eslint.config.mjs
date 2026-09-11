import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
    },
  },
  globalIgnores([
    "dist/**",
    ".next/**",
    ".open-next/**",
    ".vinext/**",
    "backups/**",
    "*.tar.gz",
  ]),
]);

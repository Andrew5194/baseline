import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@baseline/db", "@baseline/db/*"],
              message: "Marketing app cannot import @baseline/db.",
            },
            {
              group: ["@baseline/events", "@baseline/events/*"],
              message: "Marketing app cannot import @baseline/events.",
            },
            {
              group: ["@baseline/metrics", "@baseline/metrics/*"],
              message: "Marketing app cannot import @baseline/metrics.",
            },
            {
              group: ["@baseline/integrations-github", "@baseline/integrations-github/*"],
              message: "Marketing app cannot import integration packages.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;

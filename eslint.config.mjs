import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "coverage/**",
      // Build/gate scratch dir: build:monitored:clean quarantines .next into
      // .tmp/next-quarantine-* (compiled JS full of require()), and gate logs land in
      // .tmp/build-monitor. These are gitignored artifacts -- linting them produced
      // false no-require-imports errors that broke local `npm run lint` after a build.
      ".tmp/**",
      // Python virtualenvs under scripts/ vendor minified JS (e.g. mpire's bootstrap/jquery,
      // torch's model_dump code.js). They are gitignored + never shipped, but `eslint .` was
      // picking them up and producing ~48 false no-this-alias / no-unused-vars errors that broke
      // local `npm run lint` (CI never saw them -- they are untracked). Ignore all venv + vendored
      // site-packages trees.
      "**/.venv/**",
      "**/site-packages/**",
      // Same class as the venv trees above: the Impeccable design skill is vendored third-party
      // tooling installed via npx into .claude/ and .agents/. It is gitignored and never shipped,
      // but `eslint .` was picking it up and producing 316 of the repo's 392 warnings -- 81% of the
      // baseline, from code that is not ours and never reaches CI (which checks out without it).
      // That gap made the local lint number useless for judging our own changes.
      ".claude/skills/impeccable/**",
      ".agents/skills/impeccable/**",
      "tests/**/*.js",
      "tests/archive/**",
      "*.config.js",
      "*.config.mjs",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;

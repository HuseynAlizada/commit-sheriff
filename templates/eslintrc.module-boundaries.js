/**
 * Advanced ESLint config — enforces module boundaries in a modular TypeScript/React app.
 *
 * This is an OPTIONAL, opt-in template (not installed by `commit-sheriff init`). Copy it to
 * your repo root as `.eslintrc.js` via `npx commit-sheriff add-eslint-react`, then adjust the
 * assumptions below to match your project structure.
 *
 * Assumptions this template makes (edit as needed):
 *   - Feature modules live under `src/app/<module>/` (e.g. `src/app/auth/`).
 *   - Each module exposes its public surface via a `<module>.public.ts` barrel file; anything
 *     else under `src/app/<module>/modules/**` or `src/app/<module>/shared/**` is internal and
 *     must not be imported directly from another module.
 *   - Shared/base code lives under `src/app/_shared/**` and `src/packages/**` and must never
 *     import from a feature module (that would invert the dependency direction).
 *   - `src/packages/routing/AppRoutes.tsx` and `src/packages/routing/config/modules.registry.ts`
 *     are the one place allowed to import every module directly (that's the whole point of a
 *     router/registry), so the boundary rule is turned off just for those two files.
 *
 * Module list: instead of hardcoding module names, this reads `modules` from the repo's
 * `.commitsheriffrc.json` (the same list used by the commit-sheriff commit-msg/branch-name
 * hooks — see README), so the two conventions (module tags in commits/branches, and module
 * boundaries in imports) stay in sync automatically. For older installs that still keep their
 * config under `package.json`'s `commitGuard` block, that location is used as a fallback. If
 * neither is found, a small illustrative default is used instead — replace it with your real
 * module names.
 */

const fs = require("fs");
const path = require("path");

function loadAppModules() {
  try {
    const rcPath = path.join(__dirname, ".commitsheriffrc.json");
    const rc = JSON.parse(fs.readFileSync(rcPath, "utf8"));
    if (Array.isArray(rc.modules) && rc.modules.length) {
      return rc.modules.map((m) => String(m).toLowerCase());
    }
  } catch {
    // fall through to the legacy package.json lookup below
  }
  try {
    const pkgPath = path.join(__dirname, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const modules = pkg.commitGuard && pkg.commitGuard.modules;
    if (Array.isArray(modules) && modules.length) {
      return modules.map((m) => String(m).toLowerCase());
    }
  } catch {
    // fall through to the illustrative default below
  }
  return ["auth", "billing", "reports", "settings"]; // example only — replace with your modules
}

const APP_MODULES = loadAppModules();
const MODULE_INTERNALS = ["modules", "shared"];

const restrictImports = (group, message) => ({
  "no-restricted-imports": ["error", { patterns: [{ group, message }] }],
});

const moduleBoundaryOverrides = [
  // A module reaches another module's internals only through `<module>.public.ts`, so the
  // surface between modules stays explicit. `routing/` stays open on purpose: route enums are
  // dependency-free leaves, while the barrel pulls in services that instantiate on import.
  ...APP_MODULES.map((appModule) => ({
    files: [`src/app/${appModule}/**`],
    rules: restrictImports(
      APP_MODULES.filter((other) => other !== appModule).flatMap((other) =>
        MODULE_INTERNALS.map((internal) => `~/app/${other}/${internal}/**`),
      ),
      "Cross-module import: use the other module's '<module>.public.ts' barrel instead of a deep path.",
    ),
  })),
  {
    files: ["src/app/_shared/**", "src/packages/**"],
    rules: restrictImports(
      APP_MODULES.map((appModule) => `~/app/${appModule}/**`),
      "Base layers must not depend on a feature module: move the shared piece down into _shared or packages instead.",
    ),
  },
  {
    files: [
      "src/packages/routing/AppRoutes.tsx",
      "src/packages/routing/config/modules.registry.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
];

module.exports = {
  root: true,
  ignorePatterns: [
    "coverage/**",
    "dist/**",
    "build/**",
    "node_modules/**",
    "**/*.d.ts",
    "**/*.config.js",
  ],
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
    project: true,
  },
  settings: {
    react: {
      version: "detect",
    },
    linkComponents: [
      { name: "RouterLink", linkAttribute: ["href", "to"] },
      { name: "Link", linkAttribute: ["href", "to"] },
    ],
    jest: {
      version: "29.0",
    },
  },
  overrides: [
    {
      files: ["*.js", "**/*.styles.ts"],
      rules: {
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-var-requires": "off",
      },
    },
    {
      files: ["**/*.styles.ts"],
      rules: {
        "@typescript-eslint/no-unsafe-return": "off",
      },
    },
    ...moduleBoundaryOverrides,
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:sonarjs/recommended-legacy",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:prettier/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:testing-library/react",
    "plugin:@vitest/legacy-recommended",
    "plugin:jest/recommended",
  ],
  plugins: [
    "@typescript-eslint",
    "sonarjs",
    "import",
    "prettier",
    "react",
    "react-hooks",
    "jsx-a11y",
    "testing-library",
    "@vitest",
    "jest",
  ],
  rules: {
    "prettier/prettier": [
      "error",
      {
        endOfLine: "auto",
      },
    ],
    /** React-specific rules */
    "react/hook-use-state": ["warn", { allowDestructuredState: true }],
    "react/react-in-jsx-scope": ["off"],
    "react/no-array-index-key": ["error"],
    "react/display-name": ["off"],
    "react/prop-types": ["off"],
    /** Accessibility rules */
    "jsx-a11y/anchor-is-valid": [
      "error",
      {
        components: ["Link", "RouterLink"],
        specialLink: ["to"],
        aspects: ["noHref", "invalidHref", "preferButton"],
      },
    ],
    /** Best practices and coding style */
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "warn",
    "prefer-const": ["error"],
    "no-use-before-define": ["error", { functions: false, classes: true, variables: true }],
    "no-nested-ternary": ["error"],
    /** SonarJS rules */
    "sonarjs/cognitive-complexity": ["error"],
    "sonarjs/no-inverted-boolean-check": ["off"],
    "sonarjs/no-duplicate-string": ["off"],
    /** Import rules */
    "import/no-anonymous-default-export": "off",
    "import/no-cycle": ["off"],
    "import/namespace": ["off"],
    "import/no-named-as-default": ["off"],
    "import/no-unresolved": ["off", { ignore: ["^src/"] }],
    /** TypeScript-specific rules */
    "@typescript-eslint/explicit-module-boundary-types": ["off"],
    "@typescript-eslint/no-explicit-any": ["error"],
    "@typescript-eslint/no-unsafe-return": ["warn"],
    "@typescript-eslint/no-unsafe-call": ["warn"],
    "@typescript-eslint/no-unsafe-member-access": ["warn"],
    "@typescript-eslint/no-unsafe-assignment": ["warn"],
    "@typescript-eslint/prefer-optional-chain": ["error"],
    "@typescript-eslint/prefer-nullish-coalescing": ["warn"],
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-restricted-types": [
      "error",
      {
        types: {
          Array: {
            message: "Use yourType[] instead. So for Array<string> you need to use string[]",
          },
        },
      },
    ],
    "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],
    "@typescript-eslint/naming-convention": [
      "error",
      {
        selector: "variable",
        types: ["boolean"],
        format: ["PascalCase"],
        prefix: ["is", "should", "has", "can", "did", "will", "are"],
      },
    ],
    /** File size constraints */
    "max-lines": ["warn", { max: 250, skipComments: true, skipBlankLines: true }],
  },
};

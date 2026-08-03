#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const cwd = process.cwd();
const command = process.argv[2];

const DEFAULT_COMMIT_GUARD = {
  useModules: false,
  project: "PROJ",
  // Only enforced when useModules is true — safe to leave empty otherwise. Fill in your own
  // module tags here (e.g. ["auth", "billing", "reports"]); left empty, the hooks fall back to
  // accepting any uppercase tag.
  modules: [],
  branchTypes: [
    "feature",
    "bugfix",
    "hotfix",
    "improvement",
    "refactor",
    "release",
    "chore",
    "docs",
    "test",
    "spike",
  ],
  types: [
    "feat",
    "fix",
    "docs",
    "style",
    "refactor",
    "test",
    "chore",
    "perf",
    "ci",
    "build",
    "revert",
  ],
};

const DEFAULT_LINT_STAGED = {
  // No --max-warnings=0 here on purpose: warnings should be visible (ESLint prints them to the
  // terminal either way) but must NOT block the commit — only actual errors (non-zero exit) do.
  "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css,scss,html}": ["prettier --write"],
};

const CONFIG_FILE_NAME = ".commitsheriffrc.json";

function readPackageJson() {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.error("  package.json not found. Run `npm init` first.");
    process.exit(1);
  }
  return { pkgPath, pkg: JSON.parse(fs.readFileSync(pkgPath, "utf8")) };
}

function ensureHusky() {
  const huskyDir = path.join(cwd, ".husky");
  const shimPath = path.join(huskyDir, "_", "husky.sh");
  if (!fs.existsSync(shimPath)) {
    console.log("→ setting up husky (npx husky init)...");
    execSync("npx husky init", { cwd, stdio: "inherit" });
  }
}

function copyHook(name) {
  const src = path.join(__dirname, "..", "templates", name);
  const dest = path.join(cwd, ".husky", name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`✔ .husky/${name} written`);
}

function ensureConfigFile() {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  const { pkg } = readPackageJson();

  if (fs.existsSync(configPath)) {
    console.log(`• ${CONFIG_FILE_NAME} already exists, left untouched`);
    return;
  }

  if (pkg.commitGuard) {
    console.log(
      `• Found a legacy-style 'commitGuard' block in package.json — ${CONFIG_FILE_NAME} not created, the old configuration keeps working.`,
    );
    return;
  }

  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_COMMIT_GUARD, null, 2) + "\n");
  console.log(`✔ ${CONFIG_FILE_NAME} written`);
}

// Installs whatever in `packages` isn't already a listed dependency/devDependency, so the hooks
// this tool wires up are actually functional right after `init`/`add-eslint` — not just
// documented as a copy-paste command the user has to remember to run separately. Falls back to
// printing the manual command if the install itself fails (offline, registry auth issue, etc.),
// so the user isn't left silently thinking it worked.
// Strips a trailing "@version" from an install spec to get the plain package name for looking it
// up in package.json — careful with scoped packages ("@eslint/js" has no version, but
// "@vitest/eslint-plugin@^1" does; only the *last* "@" is ever the version separator).
function packageNameOf(spec) {
  const atIndex = spec.lastIndexOf("@");
  return atIndex > 0 ? spec.slice(0, atIndex) : spec;
}

function ensureDevDeps(packages) {
  const { pkg } = readPackageJson();
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  const missing = packages.filter((spec) => !deps[packageNameOf(spec)]);
  if (!missing.length) {
    console.log("• Required devDependencies are already installed, nothing to do");
    return;
  }
  console.log(`→ Installing: ${missing.join(" ")}`);
  try {
    // --legacy-peer-deps: some ESLint plugins lag behind the newest ESLint major in their
    // declared peerDependencies (e.g. eslint-plugin-import still capping at ^9 while npm already
    // resolves plain "eslint" to 10.x), which makes npm's default strict peer resolution abort
    // the whole install with ERESOLVE even though the versions work fine together in practice.
    execSync(`npm install --save-dev --legacy-peer-deps ${missing.join(" ")}`, {
      cwd,
      stdio: "inherit",
    });
    console.log("✔ devDependencies installed");
  } catch {
    console.log(
      "\n  Automatic install failed (could be a network/npm error) — run it yourself:\n" +
        `    npm install --save-dev ${missing.join(" ")}\n`,
    );
  }
}

function ensurePrepareScript() {
  const { pkgPath, pkg } = readPackageJson();
  if (!pkg.scripts) pkg.scripts = {};
  if (!pkg.scripts.prepare) {
    pkg.scripts.prepare = "husky";
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
}

// Always overwrites, same policy as the ESLint/Prettier templates below — no manual merge step,
// ever. Back up your own lint-staged customizations under a different key first if you have any.
function ensureLintStagedBlock() {
  const { pkgPath, pkg } = readPackageJson();
  pkg["lint-staged"] = DEFAULT_LINT_STAGED;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("✔ package.json → lint-staged configuration written (overwritten)");
}

// Opt-in, not run automatically by `init` — installing ESLint/Prettier/lint-staged onto a project
// that didn't ask for them is more surprising than helpful.
function addLintStagedDeps() {
  // Without this, the pre-commit hook's `lint-staged` step silently no-ops when the package
  // itself isn't installed (it only checks whether *some* config/listing exists), so lint/format
  // checks would never actually run on commit even though everything *looks* set up. `eslint`
  // and `prettier` are included too since the default lint-staged config above already assumes
  // both are runnable — otherwise the very first commit would fail on "command not found" instead
  // of an actual lint/format problem. `eslint` is pinned to ^9 (not left to resolve to whatever
  // "latest" is) because the plugin ecosystem this tool depends on (eslint-plugin-react, etc.)
  // regularly lags behind ESLint's newest major for months — installing an unpinned "latest" has
  // broken real installs (e.g. eslint-plugin-react crashing under ESLint 10's changed rule-context
  // API) within days of a new major landing on npm.
  ensureDevDeps(["lint-staged", "eslint@^9", "prettier"]);
}

function init() {
  ensureHusky();
  copyHook("commit-msg");
  copyHook("pre-commit");
  ensureConfigFile();
  ensurePrepareScript();

  console.log(
    "\nHusky hooks are set up. ESLint/Prettier/lint-staged are opt-in, not installed by default —\n" +
      "run `npx commit-sheriff add-eslint` when you want them.\n",
  );

  console.log(`\nDone. Adjust 'project' and, if needed, 'modules' in ${CONFIG_FILE_NAME}.\n`);
}

const ESLINT_REACT_DEV_DEPS = [
  // Pinned (not left to resolve to "latest") — see the comment on the eslint@^9 install in
  // addLintStagedDeps() for why: the plugin ecosystem here regularly lags behind ESLint's newest major.
  // @eslint/js in particular is versioned in lockstep with ESLint core and its `latest` (10.x)
  // declares a hard peerDependency on eslint@^10 — installing it unpinned alongside eslint@^9
  // produces an immediate ERESOLVE conflict, which is exactly what this pin prevents.
  "eslint@^9",
  // Same lag problem, different package: @typescript-eslint/eslint-plugin@8.65.0 declares
  // `typescript: ">=4.8.4 <6.1.0"` as a peer, but unpinned "typescript" resolves to npm's
  // "latest" (7.x once TypeScript ships a 7.0) — that's outside the supported range and
  // crashes plugin loading with "typescript-eslint does not support TS 7.0". Pinning to the
  // latest 5.x line keeps us inside the range the plugin actually supports today.
  "typescript@^5",
  "@typescript-eslint/parser",
  "@typescript-eslint/eslint-plugin",
  "@eslint/js@^9",
  "@eslint/eslintrc",
  "eslint-plugin-sonarjs",
  "eslint-plugin-import",
  "eslint-plugin-prettier",
  "eslint-config-prettier",
  "eslint-plugin-react",
  "eslint-plugin-react-hooks",
  "eslint-plugin-jsx-a11y",
  "eslint-plugin-testing-library",
  "@vitest/eslint-plugin",
  "eslint-plugin-jest",
  "prettier",
];

// The module-boundary + all-recommended-plugins ruleset lives in this file, copied verbatim from
// the template every run. `eslint.config.mjs` itself (the file ESLint actually reads) is then
// generated fresh below to import it — no manual merge step for the user, ever. This intentionally
// means a fully hand-written `eslint.config.mjs` gets replaced: simplicity/zero-manual-steps was
// chosen over preserving bespoke prior setups, matching how `.prettierrc.js` already worked.
const RULES_FILE = "eslint.config.commit-sheriff.mjs";

function copyTemplateOverwrite(templateName, destName) {
  const src = path.join(__dirname, "..", "templates", templateName);
  const dest = path.join(cwd, destName);
  const existed = fs.existsSync(dest);
  fs.copyFileSync(src, dest);
  console.log(existed ? `✔ ${destName} updated (overwritten)` : `✔ ${destName} written`);
  return dest;
}

function writeFileOverwrite(destName, content) {
  const dest = path.join(cwd, destName);
  const existed = fs.existsSync(dest);
  fs.writeFileSync(dest, content);
  console.log(existed ? `✔ ${destName} updated (overwritten)` : `✔ ${destName} written`);
  return dest;
}

// eslint-config-next changed shape across majors: up through v15 it ships an eslintrc-style
// object (`module.exports = { extends: [...] }`) meant to be pulled in via FlatCompat's legacy
// `compat.extends("next/core-web-vitals", "next/typescript")` bridge (exactly what
// `create-next-app` itself generates for v15 projects). From v16 on it ships a native flat-config
// array as the default export of `eslint-config-next/core-web-vitals` / `/typescript` instead —
// running the *old* FlatCompat-string pattern against a v16 install crashes with
// "TypeError: Converting circular structure to JSON" deep inside `@eslint/eslintrc`'s config
// validator (confirmed by reproducing it in a scratch project — the crash reproduces with only
// Next's own extends, no module-boundary rules involved at all). `create-next-app@latest` itself
// already generates the new native-import form for v16, so we mirror that here rather than the
// older FlatCompat form once eslint-config-next resolves to 16+.
function installedVersion(pkgName) {
  try {
    return require(path.join(cwd, "node_modules", pkgName, "package.json")).version;
  } catch {
    return null;
  }
}

function buildEslintEntryConfig(hasNext) {
  if (!hasNext) {
    return (
      `import moduleBoundaries from "./${RULES_FILE}";\n\n` +
      `export default [...moduleBoundaries];\n`
    );
  }

  const version = installedVersion("eslint-config-next");
  const major = version ? parseInt(version.split(".")[0], 10) : null;
  // Default to the modern (16+) form when the version can't be determined (e.g. install failed
  // offline) — that's what any newly-scaffolded Next project will have going forward.
  const useNativeFlatExport = major === null || major >= 16;

  if (useNativeFlatExport) {
    // eslint-config-next's native flat array already registers plugins like "react",
    // "react-hooks", "import", "jsx-a11y" and "@typescript-eslint". Our own module-boundary
    // template is built through @eslint/eslintrc's FlatCompat, which independently resolves
    // those same plugin *names* into separate object instances — even though they load the same
    // underlying package, ESLint's flat config throws "Cannot redefine plugin ..." when a plugin
    // name is registered twice with two different object references (confirmed by reproducing it
    // in a scratch Next 16 project). Only one registration per plugin name is actually needed, so
    // any config entry from our own template that re-declares a plugin Next.js already registered
    // has that redundant "plugins" key stripped below — its "rules" keep working against the
    // plugin instance Next.js already loaded.
    return (
      `import nextCoreWebVitals from "eslint-config-next/core-web-vitals";\n` +
      `import nextTypescript from "eslint-config-next/typescript";\n` +
      `import moduleBoundaries from "./${RULES_FILE}";\n\n` +
      `const nextConfigs = [...nextCoreWebVitals, ...nextTypescript];\n` +
      `const pluginsNextAlreadyRegisters = new Set(\n` +
      `  nextConfigs.flatMap((entry) => (entry.plugins ? Object.keys(entry.plugins) : [])),\n` +
      `);\n` +
      `const dedupedModuleBoundaries = moduleBoundaries.map((entry) => {\n` +
      `  if (!entry.plugins) return entry;\n` +
      `  const ownPlugins = Object.fromEntries(\n` +
      `    Object.entries(entry.plugins).filter(([name]) => !pluginsNextAlreadyRegisters.has(name)),\n` +
      `  );\n` +
      `  const { plugins, ...rest } = entry;\n` +
      `  return Object.keys(ownPlugins).length ? { ...rest, plugins: ownPlugins } : rest;\n` +
      `});\n\n` +
      `export default [...nextConfigs, ...dedupedModuleBoundaries];\n`
    );
  }

  return (
    `import { fileURLToPath } from "node:url";\n` +
    `import path from "node:path";\n` +
    `import { FlatCompat } from "@eslint/eslintrc";\n` +
    `import moduleBoundaries from "./${RULES_FILE}";\n\n` +
    `const compat = new FlatCompat({\n` +
    `  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),\n` +
    `});\n\n` +
    `export default [\n` +
    `  ...compat.extends("next/core-web-vitals", "next/typescript"),\n` +
    `  ...moduleBoundaries,\n` +
    `];\n`
  );
}

function addEslint() {
  const { pkg } = readPackageJson();
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  const hasNext = Boolean(deps.next);

  ensureConfigFile();
  ensureLintStagedBlock();
  addLintStagedDeps();

  copyTemplateOverwrite("eslint.config.module-boundaries.mjs", RULES_FILE);

  // eslint-config-next must actually be installed (and its version readable) *before* generating
  // the entry config below, so the version check above sees real, resolved data instead of "not
  // installed yet".
  const extraDeps = hasNext && !deps["eslint-config-next"] ? ["eslint-config-next"] : [];
  ensureDevDeps(ESLINT_REACT_DEV_DEPS.concat(extraDeps));

  writeFileOverwrite("eslint.config.mjs", buildEslintEntryConfig(hasNext));
  copyTemplateOverwrite("prettier.module-boundaries.js", ".prettierrc.js");

  console.log(
    "\nThis template is for TypeScript/React + module-boundary rules.\n" +
      `The module list is read automatically from ${CONFIG_FILE_NAME}'s "modules" (falls back\n` +
      "to an illustrative default if empty — read the comment inside the template file).\n\n" +
      "Note: eslint.config.mjs, " +
      RULES_FILE +
      ", and .prettierrc.js are overwritten\n" +
      "with the latest template every run (same as the commit-msg/pre-commit hooks) — no manual\n" +
      "merge step needed, but if you want to keep your own customizations, back them up under a\n" +
      "different name first.\n" +
      (hasNext
        ? "\nNext.js detected → next/core-web-vitals and next/typescript rules are folded in\n" +
          "automatically too.\n"
        : ""),
  );

  if (fs.existsSync(path.join(cwd, ".eslintrc.js"))) {
    console.log(
      "\nNote: your project still has a legacy .eslintrc.js — delete it. With a flat config\n" +
        "present, ESLint never reads it, and it can itself start producing lint errors as a\n" +
        "plain .js file.\n",
    );
  }
}

if (command === "init") {
  init();
} else if (command === "add-eslint") {
  addEslint();
} else {
  console.log("Usage: npx commit-sheriff init");
  console.log(
    "     : npx commit-sheriff add-eslint   (optional, ESLint + Prettier + lint-staged, overwrites any existing setup)",
  );
  process.exit(command ? 1 : 0);
}

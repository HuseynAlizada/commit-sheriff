#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const cwd = process.cwd();
const command = process.argv[2];

const DEFAULT_COMMIT_GUARD = {
  useModules: false,
  project: "PROJ",
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
  "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css,scss,html}": ["prettier --write"],
};

const CONFIG_FILE_NAME = ".commitsheriffrc.json";

function readPackageJson() {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.error("  package.json tapılmadı. Əvvəlcə `npm init` işlədin.");
    process.exit(1);
  }
  return { pkgPath, pkg: JSON.parse(fs.readFileSync(pkgPath, "utf8")) };
}

function ensureHusky() {
  const huskyDir = path.join(cwd, ".husky");
  const shimPath = path.join(huskyDir, "_", "husky.sh");
  if (!fs.existsSync(shimPath)) {
    console.log("→ husky quraşdırılır (npx husky init)...");
    execSync("npx husky init", { cwd, stdio: "inherit" });
  }
}

function copyHook(name) {
  const src = path.join(__dirname, "..", "templates", name);
  const dest = path.join(cwd, ".husky", name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`✔ .husky/${name} yazıldı`);
}

function ensureConfigFile() {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  const { pkg } = readPackageJson();

  if (fs.existsSync(configPath)) {
    console.log(`• ${CONFIG_FILE_NAME} artıq var, toxunulmadı`);
    return;
  }

  if (pkg.commitGuard) {
    console.log(
      `• package.json-da köhnə tərzli 'commitGuard' bloku tapıldı — ${CONFIG_FILE_NAME} yaradılmadı, köhnə konfiqurasiya işləməyə davam edir.`,
    );
    return;
  }

  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_COMMIT_GUARD, null, 2) + "\n");
  console.log(`✔ ${CONFIG_FILE_NAME} yazıldı`);
}

function mergeConfig() {
  const { pkgPath, pkg } = readPackageJson();
  let changed = false;

  ensureConfigFile();

  if (!pkg["lint-staged"]) {
    pkg["lint-staged"] = DEFAULT_LINT_STAGED;
    changed = true;
    console.log("✔ package.json → lint-staged konfiqurasiyası əlavə olundu");
  } else {
    console.log("• package.json-da lint-staged artıq var, toxunulmadı");
  }

  if (!pkg.scripts) pkg.scripts = {};
  if (!pkg.scripts.prepare) {
    pkg.scripts.prepare = "husky";
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
}

function isReactTypescriptProject() {
  const { pkg } = readPackageJson();
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
  return Boolean(deps.react && deps.typescript);
}

function init() {
  ensureHusky();
  copyHook("commit-msg");
  copyHook("pre-commit");
  mergeConfig();

  if (isReactTypescriptProject()) {
    console.log(
      "\n• react + typescript aşkarlandı → TS/React modul-sərhəd ESLint şablonu da əlavə olunur:",
    );
    addEslintReact();
  } else {
    console.log(
      "\n(Layihə TS/React kimi aşkarlanmadı — istəsəniz `npx commit-sheriff add-eslint-react` ilə əlavə edə bilərsiniz.)",
    );
  }

  console.log(
    `\nHazırdır. ${CONFIG_FILE_NAME} faylında 'project' və lazım olsa 'modules' dəyərlərini tənzimləyin.\n`,
  );
}

const ESLINT_REACT_DEV_DEPS = [
  "typescript",
  "@typescript-eslint/parser",
  "@typescript-eslint/eslint-plugin",
  "@eslint/js",
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

const FLAT_CONFIG_CANDIDATES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
];
const FLAT_CONFIG_SIDE_FILE = "eslint.config.commit-sheriff.mjs";

function hasFlatEslintConfig() {
  return FLAT_CONFIG_CANDIDATES.some((name) => fs.existsSync(path.join(cwd, name)));
}

function copyTemplateOverwrite(templateName, destName) {
  const src = path.join(__dirname, "..", "templates", templateName);
  const dest = path.join(cwd, destName);
  const existed = fs.existsSync(dest);
  fs.copyFileSync(src, dest);
  console.log(existed ? `✔ ${destName} yeniləndi (üzərinə yazıldı)` : `✔ ${destName} yazıldı`);
  return dest;
}

function addEslintReact() {
  // ESLint 9+ prioritizes flat config (`eslint.config.*`) and completely ignores a legacy
  // `.eslintrc.js` when one is present — no fallback. Frameworks like Next.js already scaffold
  // their own `eslint.config.mjs`, so if we wrote only `.eslintrc.js` here it would silently
  // never run for the majority of modern projects. We therefore ship the flat-config template
  // as the primary artifact, and decide where it lands based on what the project already has.
  const flatConfigAlreadyExists = hasFlatEslintConfig();

  if (flatConfigAlreadyExists) {
    copyTemplateOverwrite("eslint.config.module-boundaries.mjs", FLAT_CONFIG_SIDE_FILE);
    console.log(
      `\n• Layihədə artıq öz eslint.config.* faylınız var — ona toxunulmadı.\n` +
        `  Modul-sərhəd qaydaları ayrıca ${FLAT_CONFIG_SIDE_FILE} faylına yazıldı.\n` +
        `  Özünüzün eslint.config.* faylınıza əlavə edin, məsələn:\n\n` +
        `    import moduleBoundaries from "./${FLAT_CONFIG_SIDE_FILE}";\n` +
        `    export default [\n` +
        `      ...compat.extends("next/core-web-vitals", "next/typescript"),\n` +
        `      ...moduleBoundaries,\n` +
        `    ];\n`,
    );
  } else {
    copyTemplateOverwrite("eslint.config.module-boundaries.mjs", "eslint.config.mjs");
    console.log(
      "\n• Layihədə eslint.config.* yox idi — eslint.config.mjs olaraq birbaşa yazıldı.\n",
    );
  }
  copyTemplateOverwrite("prettier.module-boundaries.js", ".prettierrc.js");
  console.log(
    "Bu şablon TypeScript/React + modul-sərhəd (module-boundary) qaydaları üçündür.\n" +
      `Modul siyahısı ${CONFIG_FILE_NAME}.modules-dən avtomatik oxunur (boşdursa nümunə\n` +
      "siyahı istifadə olunur — şablon faylı içindəki şərhi oxuyun).\n\n" +
      "Diqqət: eslint.config.* (və ya yuxarıdakı side-file) və .prettierrc.js hər dəfə\n" +
      "şablonun ən son versiyası ilə üzərinə yazılır (commit-msg/pre-commit hook-ları kimi)\n" +
      "— özünüzə uyğun etdiyiniz dəyişiklikləri qorumaq istəsəniz, əvvəlcə fərqli adla\n" +
      "backup götürün.\n\n" +
      "Lazımi devDependencies (özünüz quraşdırın, layihənizin real versiyalarına uyğun):\n" +
      `  npm install --save-dev ${ESLINT_REACT_DEV_DEPS.join(" ")}\n`,
  );
}

if (command === "init") {
  init();
} else if (command === "add-eslint-react") {
  addEslintReact();
} else {
  console.log("İstifadə: npx commit-sheriff init");
  console.log(
    "        : npx commit-sheriff add-eslint-react   (opsional, TS/React modul-sərhəd ESLint şablonu)",
  );
  process.exit(command ? 1 : 0);
}

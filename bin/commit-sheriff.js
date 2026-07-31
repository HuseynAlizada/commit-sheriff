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
    "feature",
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

function mergeConfig() {
  const { pkgPath, pkg } = readPackageJson();
  let changed = false;

  if (!pkg.commitGuard) {
    pkg.commitGuard = DEFAULT_COMMIT_GUARD;
    changed = true;
    console.log("✔ package.json → commitGuard konfiqurasiyası əlavə olundu");
  } else {
    console.log("• package.json-da commitGuard artıq var, toxunulmadı");
  }

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

function init() {
  ensureHusky();
  copyHook("commit-msg");
  copyHook("pre-commit");
  mergeConfig();
  console.log(
    "\nHazırdır. package.json → commitGuard bölməsində 'project' və lazım olsa 'modules' dəyərlərini tənzimləyin.\n",
  );
}

const ESLINT_REACT_DEV_DEPS = [
  "typescript",
  "@typescript-eslint/parser",
  "@typescript-eslint/eslint-plugin",
  "eslint-plugin-sonarjs",
  "eslint-plugin-import",
  "eslint-plugin-prettier",
  "eslint-config-prettier",
  "eslint-plugin-react",
  "eslint-plugin-react-hooks",
  "eslint-plugin-jsx-a11y",
  "eslint-plugin-testing-library",
  "eslint-plugin-vitest",
  "eslint-plugin-jest",
  "prettier",
];

function copyTemplateIfMissing(templateName, destName) {
  const src = path.join(__dirname, "..", "templates", templateName);
  const dest = path.join(cwd, destName);
  if (fs.existsSync(dest)) {
    console.log(`• ${destName} artıq var, toxunulmadı`);
    return;
  }
  fs.copyFileSync(src, dest);
  console.log(`✔ ${destName} yazıldı`);
}

function addEslintReact() {
  copyTemplateIfMissing("eslintrc.module-boundaries.js", ".eslintrc.js");
  copyTemplateIfMissing("prettier.module-boundaries.js", ".prettierrc.js");
  console.log(
    "\nBu şablon TypeScript/React + modul-sərhəd (module-boundary) qaydaları üçündür.\n" +
      "Modul siyahısı package.json → commitGuard.modules-dən avtomatik oxunur (boşdursa nümunə\n" +
      "siyahı istifadə olunur — .eslintrc.js içindəki şərhi oxuyun).\n\n" +
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

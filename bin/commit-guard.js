#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const cwd = process.cwd();
const command = process.argv[2];

const DEFAULT_COMMIT_GUARD = {
  useModules: false,
  project: "PROJ",
  branchTypes: ["feature", "bugfix", "improvement", "hotfix", "refactor"],
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

if (command === "init") {
  init();
} else {
  console.log("İstifadə: npx commit-guard init");
  process.exit(command ? 1 : 0);
}

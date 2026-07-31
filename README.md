# commit-guard

Shared [Husky](https://typicode.github.io/husky/) git hooks for any project — enforces a consistent **branch naming format** and **commit message format** (ticket + type, optionally module), and runs **lint-staged** / type-check / related tests before every commit.

One command installs the same hooks in any repo:

```bash
npx @huseyn01/commit-guard init
```

## Table of contents

- [Why](#why)
- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
- [What `init` does](#what-init-does)
- [Commit message format](#commit-message-format)
- [Branch name format](#branch-name-format)
- [Configuration (`commitGuard`)](#configuration-commitguard)
  - [`useModules`](#usemodules)
  - [`project`](#project)
  - [`modules`](#modules)
  - [`branchTypes`](#branchtypes)
  - [`types`](#types)
- [Pre-commit checks](#pre-commit-checks)
- [lint-staged](#lint-staged)
- [Examples](#examples)
- [Updating](#updating)
- [Skipping / bypassing hooks](#skipping--bypassing-hooks)
- [Troubleshooting](#troubleshooting)
- [Releasing this package](#releasing-this-package)
- [License](#license)

## Why

Different repos tend to drift into different commit-message and branch-naming conventions, which makes changelogs, ticket tracing, and code review harder. `commit-guard` gives every project the same two git hooks (`commit-msg`, `pre-commit`) driven by one small config block in `package.json`, so:

- Every commit message references a ticket and a change type.
- Every branch name reflects the same ticket and change type.
- Lint/format/type-check/tests run automatically before a commit is allowed, but only for the tools the project actually has installed.

## Requirements

- Node.js (used to read `package.json` and evaluate the config — no runtime dependencies are installed by `commit-guard` itself)
- Git
- [`husky`](https://www.npmjs.com/package/husky) v9+ as a devDependency of your project

## Install

```bash
npm install --save-dev @huseyn01/commit-guard husky
```

`lint-staged`, `eslint`, and `prettier` are optional — install them too if you want the pre-commit hook to lint/format staged files:

```bash
npm install --save-dev lint-staged eslint prettier
```

## Usage

```bash
npx commit-guard init
```

Run this once per repo, from the repo root (where `package.json` lives). This works once `@huseyn01/commit-guard` is installed as a devDependency, since it exposes an unscoped `commit-guard` binary via `node_modules/.bin`. To run it directly without installing first, use the full scoped name: `npx @huseyn01/commit-guard init`.

## What `init` does

1. Initializes Husky if it isn't already set up (runs `npx husky init` when `.husky/_/husky.sh` is missing).
2. Copies the hook scripts into `.husky/commit-msg` and `.husky/pre-commit` (overwriting any existing files with those exact names) and makes them executable.
3. Adds a default `commitGuard` block to `package.json` **only if one doesn't already exist** — re-running `init` never overwrites your customized config.
4. Adds a default `lint-staged` block to `package.json` **only if one doesn't already exist**.
5. Adds a `"prepare": "husky"` npm script if missing, so hooks are (re)installed automatically after `npm install`.

Re-running `npx commit-guard init` later (e.g. after updating the package) is safe: it refreshes the two hook scripts to the latest version but leaves your `commitGuard` / `lint-staged` config alone.

## Commit message format

```
(TICKET) type(scope): message
```

or, when [`useModules`](#usemodules) is `true`:

```
(TICKET) [MODULE] type(scope): message
```

- **`TICKET`** — `PROJECT-NUMBER`, e.g. `PROJ-1191` (uppercase letters, a dash, digits)
- **`MODULE`** — required only if `useModules: true` (see [`modules`](#modules))
- **`type`** — one of the words configured in [`types`](#types)
- **`(scope)`** — optional, free text in parentheses
- **`message`** — free text description

Merge/revert/fixup/squash commits (`Merge ...`, `Revert ...`, `fixup! ...`, `squash! ...`) are always allowed through unchanged — no need to reformat what Git itself generates.

### Examples

```
(PROJ-1077) feat: implement organization management
(PROJ-1191) fix(register): reset registration session on menu reopen
(PROJ-1077) [SET] feat: implement organization management      # only with useModules: true
```

If the commit message doesn't match, the commit is rejected and the hook prints the required format, an example, the ticket pattern, and the allowed types (and modules, if enabled).

When `useModules: true`, the hook also checks that the `[MODULE]` in the commit message matches the module encoded in the current branch name (see below) — so you can't accidentally tag a commit for a different module than the branch you're on.

## Branch name format

```
<type>/<PROJECT>-<NUMBER>-<description>
```

or, when `useModules: true`:

```
<type>/<MODULE>-<PROJECT>-<NUMBER>-<description>
```

- **`type`** — one of the words configured in [`branchTypes`](#branchtypes)
- **`MODULE`** — required only if `useModules: true`
- **`PROJECT-NUMBER`** — same ticket reference as in commit messages
- **`description`** — lowercase, starts with a letter, only lowercase letters/digits/dashes after that

### Examples

```
bugfix/PROJ-1093-fix-validation
improvement/PROJ-609-correct-husky-pre-commit-validation
improvement/PRO-PROJ-609-correct-husky-pre-commit-validation   # only with useModules: true
```

The check is skipped on a detached `HEAD` (e.g. mid-rebase, mid-cherry-pick), so it never blocks those operations.

## Configuration (`commitGuard`)

Add/edit this block in your project's `package.json` (the `init` command adds a default one for you):

```json
{
  "commitGuard": {
    "useModules": false,
    "project": "PROJ",
    "branchTypes": [
      "feature",
      "bugfix",
      "hotfix",
      "improvement",
      "refactor",
      "release",
      "chore",
      "docs",
      "test",
      "spike"
    ],
    "types": [
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
      "revert"
    ]
  }
}
```

All keys are optional; anything you omit falls back to the default shown above.

### `useModules`

`boolean`, default `false`.

Turns the `[MODULE]` tag on or off in both the commit message and the branch name. Leave this `false` unless your project is split into named modules/domains that you want tracked per commit.

### `project`

`string`, default `"PROJ"`.

The project key used in the **branch name** check (`<type>/<PROJECT>-<NUMBER>-...`). Note this only constrains the branch name — the commit message ticket itself accepts any uppercase project key (`^\([A-Z]+-[0-9]+\)`), so it doesn't need to be repeated here for the commit-msg hook to work, but keeping it consistent with your Jira/Linear/etc. project key is recommended.

### `modules`

`string[]`, default: none — falls back to accepting **any** uppercase code (`[A-Z]+`).

Only relevant when `useModules: true`. If you want to restrict commits/branches to a specific, known set of module codes, list them explicitly:

```json
"commitGuard": {
  "useModules": true,
  "project": "PROJ",
  "modules": ["AUTH", "BILLING", "REPORTS"]
}
```

If you omit `modules` (or leave it as `[]`), **any** uppercase code is accepted (e.g. `[AUTH]`, `[XYZ]`, `[SET]`) — useful early in a project before the final module list is settled.

### `branchTypes`

`string[]`, default: `["feature", "bugfix", "hotfix", "improvement", "refactor", "release", "chore", "docs", "test", "spike"]`.

Allowed prefixes for **branch names**. This is intentionally a coarser, workflow-level vocabulary (what kind of branch is this?) — it does not need to match `types` word-for-word, since a single `feature/...` branch will typically contain several kinds of commits (`feat`, `test`, `docs`, `chore`, ...) as the feature is built.

### `types`

`string[]`, default: `["feat", "feature", "fix", "docs", "style", "refactor", "test", "chore", "perf", "ci", "build", "revert"]`.

Allowed `type` words in **commit messages**, following [Conventional Commits](https://www.conventionalcommits.org/) style.

## Pre-commit checks

In addition to the branch name check, `pre-commit` conditionally runs (skipped when the project doesn't have the relevant tool):

- `npm run type-check` — if a `type-check` script exists in `package.json`
- `npx lint-staged` — if `lint-staged` is listed as a dependency
- `npx vitest related --run --passWithNoTests <staged .ts/.tsx files>` — if `vitest` is listed as a dependency and staged `.ts`/`.tsx` files exist (bounded to 60s via `timeout`/`gtimeout` when available)

Any failure here aborts the commit.

## lint-staged

The default config added by `init` (only if you don't already have one):

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css,scss,html}": ["prettier --write"]
  }
}
```

Adjust freely — `commit-guard` doesn't overwrite it once present.

## Examples

**Minimal project (no modules):**

```json
"commitGuard": {
  "useModules": false,
  "project": "PROJ",
  "branchTypes": ["feature", "bugfix", "hotfix", "improvement", "refactor", "release", "chore", "docs", "test", "spike"],
  "types": ["feat", "fix", "docs", "chore", "test"]
}
```

```bash
git checkout -b bugfix/PROJ-1093-fix-validation
git commit -m "(PROJ-1093) fix: correct validation on empty input"
```

**Project split into modules, with a locked list:**

```json
"commitGuard": {
  "useModules": true,
  "project": "ACME",
  "modules": ["AUTH", "BILLING", "REPORTS"],
  "branchTypes": ["feature", "bugfix", "hotfix", "improvement", "refactor", "release", "chore", "docs", "test", "spike"],
  "types": ["feat", "fix", "docs", "chore", "test"]
}
```

```bash
git checkout -b feature/AUTH-ACME-42-add-sso
git commit -m "(ACME-42) [AUTH] feat: add SSO login"
```

## Updating

When a new version of `commit-guard` is published:

```bash
npm install @huseyn01/commit-guard@latest --save-dev
npx commit-guard init
```

`npm install` updates the package; `npx commit-guard init` re-copies the (possibly changed) `.husky/commit-msg` and `.husky/pre-commit` scripts. It will **not** touch your existing `commitGuard` or `lint-staged` config in `package.json`.

## Skipping / bypassing hooks

Not recommended as a habit, but for emergencies Git supports:

```bash
git commit --no-verify -m "..."
```

Merge, revert, `fixup!`, and `squash!` commits are already exempted from the commit-message format check automatically.

## Troubleshooting

**"Could not load commitGuard config — is Node.js installed and is this running from the repo root?"**
The hook runs `node -e "..."` against `./package.json`. Make sure Node.js is on your `PATH` and that you're committing from the repository root (or that your Git client runs hooks with the repo root as the working directory — some GUI clients get this wrong).

**A commit is accepted even though the message looks wrong**
Check which branch/tool you actually committed from — hooks only run for the local Git client that has Husky's `core.hooksPath` configured (`git config core.hooksPath` should print `.husky/_`). GUI clients or CI systems that bypass local hooks (or commit via the GitHub/GitLab API) will not trigger them.

**Branch name rejected right after `git checkout -b ...`**
Detached HEAD is exempt, but a normal new branch is checked immediately on first commit — rename it with `git branch -m <valid-name>` and try again.

**`useModules: true` but every module code is accepted**
That's expected if `commitGuard.modules` is empty/omitted — see [`modules`](#modules). Add an explicit list to restrict it.

## Releasing this package

```bash
npm version patch   # or minor / major
npm publish
```

(`npm version` runs on a properly named branch per this repo's own hooks, then fast-forward it into `main`.)

## License

ISC

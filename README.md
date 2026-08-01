# commit-sheriff

Shared [Husky](https://typicode.github.io/husky/) git hooks for any project — enforces a consistent **branch naming format** and **commit message format** (ticket + type, optionally module), and runs **lint-staged** / type-check / related tests before every commit.

## Quick start

```bash
npm install --save-dev commit-sheriff husky
npx commit-sheriff init
npx commit-sheriff add-eslint-react   # optional — only needed if init didn't auto-detect react+typescript
```

This is the full flow end to end. The `Install`, `Usage`, and `What init does` sections below repeat
these same commands with more context/explanation — you don't need to run anything extra from
there, they're not additional steps.

## Table of contents

- [Quick start](#quick-start)
- [Why](#why)
- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
- [What `init` does](#what-init-does)
- [Commit message format](#commit-message-format)
- [Branch name format](#branch-name-format)
- [Configuration (`.commitsheriffrc.json`)](#configuration-commitsheriffrcjson)
  - [`useModules`](#usemodules)
  - [`project`](#project)
  - [`modules`](#modules)
  - [`branchTypes`](#branchtypes)
  - [`types`](#types)
- [Pre-commit checks](#pre-commit-checks)
- [lint-staged](#lint-staged)
- [Advanced: ESLint module-boundary template (TypeScript/React)](#advanced-eslint-module-boundary-template-typescriptreact)
- [Examples](#examples)
- [Updating](#updating)
- [Skipping / bypassing hooks](#skipping--bypassing-hooks)
- [Troubleshooting](#troubleshooting)
- [Releasing this package](#releasing-this-package)
- [License](#license)

## Why

Different repos tend to drift into different commit-message and branch-naming conventions, which makes changelogs, ticket tracing, and code review harder. `commit-sheriff` gives every project the same two git hooks (`commit-msg`, `pre-commit`) driven by one small root-level `.commitsheriffrc.json` config file, so:

- Every commit message references a ticket and a change type.
- Every branch name reflects the same ticket and change type.
- Lint/format/type-check/tests run automatically before a commit is allowed, but only for the tools the project actually has installed.

## Requirements

- Node.js (used to read `package.json` and evaluate the config — no runtime dependencies are installed by `commit-sheriff` itself)
- Git
- [`husky`](https://www.npmjs.com/package/husky) v9+ as a devDependency of your project

## Install

```bash
npm install --save-dev commit-sheriff husky
```

`npx commit-sheriff init` installs `lint-staged`, `eslint`, and `prettier` for you automatically
(via `npm install --save-dev`) if they're missing, so the pre-commit lint/format step is actually
functional right away — you don't need to install them yourself first. This only happens as part
of `init` (see below), not from installing `commit-sheriff` itself.

## Usage

```bash
npx commit-sheriff init
```

Run this once per repo, from the repo root (where `package.json` lives). This works once `commit-sheriff` is installed as a devDependency (it exposes a `commit-sheriff` binary via `node_modules/.bin`), or directly without installing first via `npx commit-sheriff init`.

## What `init` does

1. Initializes Husky if it isn't already set up (runs `npx husky init` when `.husky/_/husky.sh` is missing).
2. Copies the hook scripts into `.husky/commit-msg` and `.husky/pre-commit` (overwriting any existing files with those exact names) and makes them executable.
3. Creates a default `.commitsheriffrc.json` file at the repo root **only if one doesn't already exist** (and only if there's no legacy `package.json` → `commitGuard` block either — see [Configuration](#configuration-commitsheriffrcjson)) — re-running `init` never overwrites your customized config.
4. Adds a default `lint-staged` block to `package.json` **only if one doesn't already exist**.
5. Adds a `"prepare": "husky"` npm script if missing, so hooks are (re)installed automatically after `npm install`.
6. Installs `lint-staged`, `eslint`, and `prettier` as devDependencies (via `npm install --save-dev`) if any of them are missing, so the pre-commit lint/format step actually runs instead of silently no-oping.
7. If `react` and `typescript` are both present in your `dependencies`/`devDependencies`, also runs [`add-eslint-react`](#advanced-eslint-module-boundary-template-typescriptreact) automatically, which **overwrites** `eslint.config.mjs` and `.prettierrc.js` with the latest templates (folding in `next/core-web-vitals`/`next/typescript` automatically if `next` is detected) and installs the extra plugins it needs — no manual merge step. Otherwise it's skipped and you can add it manually later.

Re-running `npx commit-sheriff init` later (e.g. after updating the package) is safe for your project-specific settings: it refreshes the hook scripts and (on react+typescript projects) the ESLint/Prettier templates to the latest version, but leaves your `.commitsheriffrc.json` / `lint-staged` config alone. `eslint.config.mjs`, `eslint.config.commit-sheriff.mjs`, and `.prettierrc.js` are **always overwritten** on every re-run — back them up under a different name first if you've hand-edited them.

**Why the auto-install matters**: the pre-commit hook only runs `lint-staged` if it can actually
find the package — if it's missing, older versions of this hook **silently skipped linting
entirely**, so a broken/incomplete setup looked identical to a working one until someone noticed
bad code slipping through. The hook itself is now hardened too: if `package.json` has a
`lint-staged` config block but the package isn't actually installed (e.g. `node_modules` got
wiped, or someone added the config by hand), the commit now **fails loudly** with instructions,
instead of passing silently.

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

## Configuration (`.commitsheriffrc.json`)

Add/edit this file at your project's **root** (next to `package.json`) — the `init` command creates a default one for you:

```json
{
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
```

All keys are optional; anything you omit falls back to the default shown above. Edit this file whenever you like — the hooks read it fresh on every commit, so changes take effect immediately, no reinstall or `init` re-run needed.

### Legacy `package.json` → `commitGuard` (backward compatibility)

Versions of `commit-sheriff` before this config-file change stored the same settings under a `commitGuard` key in `package.json` instead. That still works: if no `.commitsheriffrc.json` file exists, the hooks (and the `add-eslint-react` template) fall back to reading `package.json`'s `commitGuard` block automatically, so existing installs keep working without any changes required. New installs (and any project without an existing `commitGuard` block) get the new `.commitsheriffrc.json` file instead — this is the recommended location going forward. To migrate an existing project by hand, move the contents of `commitGuard` out into a new root-level `.commitsheriffrc.json` file and delete the `commitGuard` key from `package.json`.

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
{
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

`string[]`, default: `["feat", "fix", "docs", "style", "refactor", "test", "chore", "perf", "ci", "build", "revert"]`.

Allowed `type` words in **commit messages**, following [Conventional Commits](https://www.conventionalcommits.org/) style.

## Pre-commit checks

In addition to the branch name check, `pre-commit` conditionally runs (skipped when the project doesn't have the relevant tool):

- `npm run type-check` — if a `type-check` script exists in `package.json`
- `npx lint-staged` — if `package.json` has a `lint-staged` config block. If the block exists but the `lint-staged` package itself isn't actually installed, the commit **fails with instructions** rather than silently skipping the check (this used to silently no-op — see [What `init` does](#what-init-does)).
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

Warnings are printed but never block the commit — only actual errors (ESLint's non-zero exit) do.
That's the default ESLint behavior (`--fix` alone exits 0 on warning-only results), so a rule set to
`"warn"` (e.g. an unused import under some "recommended" configs) shows up in the terminal as a
heads-up but doesn't stop you from committing.

Adjust freely — `commit-sheriff` doesn't overwrite it once present. If you want warnings to block
the commit too, add `--max-warnings=0` to the `eslint --fix` command by hand.

## Advanced: ESLint module-boundary template (TypeScript/React)

Optional, separate from `init` — for projects that split feature code into modules (e.g.
`src/app/auth/`, `src/app/billing/`) and want ESLint to enforce that modules only talk to each
other through a public barrel file, never through deep/internal paths:

```bash
npx commit-sheriff add-eslint-react
```

This ships as a **flat config** (`eslint.config.*`, ESLint 9+ format), not the legacy
`.eslintrc.js` format — see [why](#why-flat-config) below. It always writes two files, no manual
merge step required, ever:

- `eslint.config.commit-sheriff.mjs` — the actual ruleset (module-boundary rules + all the
  recommended plugins: TypeScript, React, hooks, a11y, sonarjs, import, testing-library, vitest,
  jest, prettier).
- `eslint.config.mjs` — the entry point ESLint actually reads, generated fresh every run to import
  the file above. **If you already had an `eslint.config.mjs` (e.g. Next.js's own
  `create-next-app`-generated one), it is fully overwritten** — not merged, not left alone. If
  `next` is detected in your `dependencies`, the generated entry point folds in Next's own ESLint
  rules automatically so you don't lose Next-specific linting; `eslint-config-next` is
  auto-installed too if it's missing. Any other hand-written customizations in your previous
  `eslint.config.mjs` are not preserved — back it up under a different name first if you need them.

  `eslint-config-next` changed shape between major versions, so the generated entry point checks
  the actually-installed version and picks the matching pattern automatically:
  - **v16+** (current): ships a native flat-config array
    (`import nextCoreWebVitals from "eslint-config-next/core-web-vitals"`, spread directly). Mixing
    this with our own module-boundary plugins (which resolve the same plugin _names_ — `react`,
    `jsx-a11y`, `import`, etc. — through a separate loader) would otherwise throw `Cannot redefine
plugin ...`; the generated config strips those redundant re-registrations automatically so both
    rule sets apply cleanly.
  - **v15 and earlier**: still ships the legacy eslintrc-style object, so the generated config uses
    `FlatCompat.extends("next/core-web-vitals", "next/typescript")` instead — the same bridge
    `create-next-app@15` itself generates.

  (An earlier version of this tool hardcoded the v15-style pattern unconditionally, which crashed
  with `TypeError: Converting circular structure to JSON` on projects using `eslint-config-next@16+`
  — fixed by detecting the installed version instead of assuming one.)

`.prettierrc.js` is written/refreshed the same way — **always overwritten** with the latest
template (same behavior as the `commit-msg`/`pre-commit` hooks). This trade-off is intentional:
zero manual steps for the common case, at the cost of not preserving bespoke prior ESLint/Prettier
setups.

The module list for the boundary rule isn't hardcoded — it's read straight from the `modules`
array in your root `.commitsheriffrc.json` (the same list the commit-msg/branch-name hooks use
for the `[MODULE]` tag), lowercased. For older installs still using `package.json`'s
`commitGuard.modules`, that's used as a fallback. If neither is set, a small illustrative default
(`auth`, `billing`, `reports`, `settings`) is used — open the generated config and replace it, or
just fill in `modules` in `.commitsheriffrc.json` and it picks it up automatically.

This template assumes a `src/app/<module>/...` folder layout with `<module>.public.ts` barrel
files; adjust the paths inside the generated config if your structure differs.

It installs whatever it needs automatically (via `npm install --save-dev`, same as `init` does for
`lint-staged`/`eslint`/`prettier`), skipping anything already present:

```bash
npm install --save-dev eslint@^9 typescript@^5 @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin @eslint/js@^9 @eslint/eslintrc eslint-plugin-sonarjs \
  eslint-plugin-import eslint-plugin-prettier eslint-config-prettier eslint-plugin-react \
  eslint-plugin-react-hooks eslint-plugin-jsx-a11y eslint-plugin-testing-library \
  @vitest/eslint-plugin eslint-plugin-jest prettier
```

`eslint`, `@eslint/js`, and `typescript` are pinned on purpose rather than left to resolve to
whatever `latest` is — the plugin ecosystem here regularly lags behind both. Two concrete
conflicts this has already caused: `@eslint/js`'s own `latest` declares a hard peer on
`eslint@^10`, so leaving it unpinned next to `eslint@^9` is an instant `ERESOLVE`; and
`@typescript-eslint/eslint-plugin` currently only supports `typescript` up to `<6.1.0`, so an
unpinned `typescript` install (which resolves to its own `latest`, e.g. `7.x`) crashes plugin
loading with "typescript-eslint does not support TS 7.0". Pinning `eslint`/`@eslint/js` together
to `^9` and `typescript` to `^5` keeps the whole toolchain on versions that are actually
compatible with each other today.

If the install fails (offline, registry issue, etc.), it prints this exact command so you can run
it yourself.

#### Why flat config?

ESLint 9+ looks for `eslint.config.*` first and, if one is found, **ignores `.eslintrc.js`
entirely** — there's no fallback. Since frameworks like Next.js already scaffold their own
`eslint.config.mjs`, a legacy-only `.eslintrc.js` template would sit right next to it and never
actually run (this was a real bug: an unused `useState` import went completely unflagged because
the module-boundary config was silently dead). The flat config here uses `FlatCompat` (the same
official migration helper Next.js's own generated config uses internally) so the exact same rule
set works natively under ESLint 9+, whether or not the project already had its own flat config.

A legacy `.eslintrc.js` version of this template (`eslintrc.module-boundaries.js`) still ships
inside the package for reference/manual use on pure ESLint 8 projects with no flat config support
at all, but the CLI no longer writes it by default.

## Examples

**Minimal project (no modules)** — `.commitsheriffrc.json`:

```json
{
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
  "types": ["feat", "fix", "docs", "chore", "test"]
}
```

```bash
git checkout -b bugfix/PROJ-1093-fix-validation
git commit -m "(PROJ-1093) fix: correct validation on empty input"
```

**Project split into modules, with a locked list** — `.commitsheriffrc.json`:

```json
{
  "useModules": true,
  "project": "ACME",
  "modules": ["AUTH", "BILLING", "REPORTS"],
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
  "types": ["feat", "fix", "docs", "chore", "test"]
}
```

```bash
git checkout -b feature/AUTH-ACME-42-add-sso
git commit -m "(ACME-42) [AUTH] feat: add SSO login"
```

## Updating

When a new version of `commit-sheriff` is published:

```bash
npm install commit-sheriff@latest --save-dev
npx commit-sheriff init
```

`npm install` updates the package; `npx commit-sheriff init` re-copies the (possibly changed) `.husky/commit-msg` and `.husky/pre-commit` scripts. It will **not** touch your existing `.commitsheriffrc.json` (or legacy `commitGuard` in `package.json`) or `lint-staged` config.

## Skipping / bypassing hooks

Not recommended as a habit, but for emergencies Git supports:

```bash
git commit --no-verify -m "..."
```

Merge, revert, `fixup!`, and `squash!` commits are already exempted from the commit-message format check automatically.

## Troubleshooting

**"Could not load commitGuard config — is Node.js installed and is this running from the repo root?"**
The hook runs `node -e "..."` against `./.commitsheriffrc.json` (falling back to `./package.json`'s `commitGuard` block for older installs). Make sure Node.js is on your `PATH` and that you're committing from the repository root (or that your Git client runs hooks with the repo root as the working directory — some GUI clients get this wrong).

**A commit is accepted even though the message looks wrong**
Check which branch/tool you actually committed from — hooks only run for the local Git client that has Husky's `core.hooksPath` configured (`git config core.hooksPath` should print `.husky/_`). GUI clients or CI systems that bypass local hooks (or commit via the GitHub/GitLab API) will not trigger them.

**Branch name rejected right after `git checkout -b ...`**
Detached HEAD is exempt, but a normal new branch is checked immediately on first commit — rename it with `git branch -m <valid-name>` and try again.

**`useModules: true` but every module code is accepted**
That's expected if `modules` is empty/omitted in `.commitsheriffrc.json` — see [`modules`](#modules). Add an explicit list to restrict it.

## Releasing this package

```bash
npm version patch   # or minor / major
npm publish
```

(`npm version` runs on a properly named branch per this repo's own hooks, then fast-forward it into `main`.)

## License

ISC

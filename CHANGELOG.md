# Changelog

All notable changes to `commit-sheriff` are documented here. Versions follow
[semver](https://semver.org/).

## [3.0.1]

- docs: clarified the module placeholder in the branch-name example (`PRO` read like a typo'd
  project code next to `PROJ` — replaced with `MOD`).

## [3.0.0]

**Breaking:** `add-lint-staged` and `add-eslint-react` are replaced by a single command,
`add-eslint`.

- `add-eslint` always writes the full TypeScript/React module-boundary ESLint setup plus the
  `lint-staged` config block and its dependencies — there's no separate "plain" variant anymore.
- The `lint-staged` block in `package.json` is now **always overwritten** by `add-eslint`
  (previously only written if missing), matching the overwrite policy already used for the
  generated ESLint/Prettier files themselves.

## [2.0.0]

**Breaking:** `init` no longer installs ESLint/Prettier/lint-staged, and no longer auto-detects
react+typescript to run the ESLint template automatically.

- `init` now only sets up Husky, the git hooks, and `.commitsheriffrc.json`.
- Added `add-lint-staged` (installs lint-staged/eslint/prettier + the config block) and kept
  `add-eslint-react` as separate opt-in commands — both had to be run explicitly.
- Added a `modules: []` field to the default `.commitsheriffrc.json` scaffold so
  `useModules: true` projects have an obvious place to list module codes.

## [1.7.7]

- fix: the commit-msg format hint/error output used `feature(...)` as the example type, but only
  `feat` is a valid type by default — fixed the example to `feat`.

## [1.7.6]

- fix(commit-msg): the ticket regex only checked the generic shape `[A-Z]+-[0-9]+` and never
  enforced the configured `project` code, so a typo'd or wrong project prefix (e.g. `HUSCM-12`
  instead of `HUSCOM-12`) passed validation. The ticket is now validated against the actual
  configured project, same as the branch-name check already did.

## [1.7.5]

- chore: version-only bump published from a separate branch (unrelated repo housekeeping); no
  functional changes to the package contents.

## [1.7.4]

- docs: added `repository`/`homepage`/`bugs` links to `package.json` so the npm registry page
  links back to the GitHub repo.

## [1.7.3]

- All CLI console messages and hook script output translated to English.
- README simplified — the "Advanced: ESLint module-boundary template" section condensed into a
  shorter table-based format.

## [1.7.2]

- fix(lint-staged): ESLint warnings no longer block the commit — only actual errors (non-zero
  exit) do. Added `--verbose` to the `lint-staged` invocation so warnings stay visible instead of
  being silently swallowed on a successful (warning-only) run.

## [1.7.1]

- fix(eslint-react-template): detect the installed `eslint-config-next` version and generate the
  matching config shape — v16+ ships a native flat-config array, while v15 and earlier ships a
  legacy eslintrc-style object consumed via `FlatCompat`. Using the wrong pattern crashed with a
  circular-JSON error.
- Fixed a related plugin-registration conflict (`Cannot redefine plugin ...`) between Next's native
  flat config and the module-boundary template's own plugin registrations.

## [1.7.0]

- feat(eslint-react-template): `eslint.config.mjs` is now auto-generated and always overwritten —
  no manual merge step required, including automatic Next.js detection.

## [1.6.2]

- fix(eslint-react-template): pinned `typescript` and `@eslint/js` to compatible ranges — the
  plugin ecosystem regularly lags behind the newest majors of both.

## [1.6.1]

- fix: ESLint warnings now fail the `lint-staged` step, not just errors (later revisited and
  reversed in 1.7.2 based on how the team actually wanted this to behave).

## [1.6.0]

- feat: `lint-staged`/`eslint`/`prettier` are auto-installed if missing, and the pre-commit hook
  now fails loudly (with instructions) instead of silently skipping the lint/format check when a
  `lint-staged` config exists but the package itself isn't installed.

## [1.5.0]

- fix: the ESLint module-boundary template ships as flat config (`eslint.config.*`), not the
  legacy `.eslintrc.js` format — ESLint 9+ ignores `.eslintrc.js` entirely once a flat config is
  present, which had silently disabled the module-boundary rules.

## [1.4.0]

- feat: `add-eslint-react` always overwrites `.eslintrc.js`/`.prettierrc.js` with the latest
  template on every run, instead of only writing them once.

## [1.3.1]

- chore: dropped the redundant `feature` commit type, keeping only `feat`.

## [1.3.0]

- feat: moved configuration out of `package.json`'s `commitGuard` block into a dedicated root-level
  `.commitsheriffrc.json` file (with backward-compatible fallback to the old location).

## [1.2.0]

- feat: `init` auto-runs `add-eslint-react` during setup when `react` and `typescript` are both
  detected in the project's dependencies.

## [1.1.1]

- docs: added a Quick start section to the README.

## [1.1.0]

- feat: added the optional advanced ESLint/Prettier module-boundary template
  (`add-eslint-react`), for projects that split feature code into modules and want import
  boundaries enforced.

## [1.0.0]

Initial release under the current name, **`commit-sheriff`**, published unscoped to npm.

Carries forward the full feature set built up under this package's earlier names (`naic-hooks`,
then `commit-guard`, published briefly under an `@huseyn01` npm scope due to a name-similarity
policy conflict):

- Husky `commit-msg` and `pre-commit` hooks enforcing ticket-based commit messages and branch
  naming.
- Configurable project key, module tags, branch types, and commit types.
- `lint-staged` integration, run automatically before every commit.

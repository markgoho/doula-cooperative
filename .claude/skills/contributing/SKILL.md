---
description: Commit conventions and changelog generation for this repo. Use when creating commits, writing commit messages, or generating changelogs.
---

# Contributing — Commit Conventions

When creating commits in this repo, follow the conventional commit format enforced by commitlint.

## Commit message format

```
<type>(<scope>): <description>
```

### Types

Use the standard conventional commit types:

- `feat` — new feature or capability
- `fix` — bug fix
- `refactor` — code change that neither fixes a bug nor adds a feature
- `chore` — maintenance (deps, config, scripts, CI)
- `docs` — documentation only
- `test` — adding or updating tests
- `style` — formatting, whitespace, semicolons (no logic change)
- `perf` — performance improvement
- `ci` — CI/CD pipeline changes

### Scopes

Choose the scope based on which folder the changes primarily affect:

| Scope                          | Folder                                        |
| ------------------------------ | --------------------------------------------- |
| `members`                      | `members/`                                    |
| `forms-api`                    | `functions/src/forms-api/`                    |
| `members-api`                  | `functions/src/members-api/`                  |
| `profiles-api`                 | `functions/src/profiles-api/`                 |
| `admin-members-api`            | `functions/src/admin-members-api/`            |
| `admin-messages-api`           | `functions/src/admin-messages-api/`           |
| `admin-match-requests-api`     | `functions/src/admin-match-requests-api/`     |
| `admin-unclaimed-profiles-api` | `functions/src/admin-unclaimed-profiles-api/` |
| `stripe-webhook-api`           | `functions/src/stripe-webhook-api/`           |
| `profile-webhook-api`          | `functions/src/profile-webhook-api/`          |
| `shared-api`                   | `functions/src/shared-api/`                   |
| `hugo`                         | `hugo/`                                       |
| `deps`                         | dependency updates                            |

Scopes are optional but encouraged. Omit the scope for cross-cutting changes that don't map to a single folder.

### How to choose the right scope

- **Single folder changed** → use that folder's scope: `fix(members): correct login redirect`
- **`shared-api` changed alongside a consumer** → scope to the consumer: `feat(profiles-api): add auth validation` (even if `shared-api/auth.ts` was modified)
- **`shared-api` changed alone** → use `shared-api`: `refactor(shared-api): simplify middleware`
- **Multiple unrelated folders** → omit scope: `chore: update eslint config`
- **Dependency updates** → use `deps`: `chore(deps): update Angular to v21`

### Examples

```
feat(members): add dark mode toggle
fix(profiles-api): handle null profile image
refactor(shared-api): extract email template helper
chore(deps): update Angular packages to v21.2
test(admin-members-api): add coverage for role validation
docs: update CLAUDE.md with new conventions
ci: add changelog generation to deploy pipeline
```

## Multi-scope changes

When a change spans multiple scopes, prefer granular scoped commits over a single large commit. This produces better changelogs since each entry lands in the right folder's `CHANGELOG.md` with a targeted description.

**Split into separate commits when** the changes for each scope are independently valid — staging just one scope's files wouldn't leave the repo broken:

```
feat(profiles-api): add bio field to profile schema
feat(members): add bio input to edit profile form
test(profiles-api): add bio field validation tests
```

**Use a single unscoped commit when** the changes are tightly coupled and splitting them would leave the app in a broken intermediate state:

```
feat: add bio field to profiles
```

A single commit touching multiple folders will appear in every matching changelog (since `--commit-path` includes any commit that touched files in the folder), but with a generic description instead of a targeted one.

## Pre-commit checks

Before creating a commit, inspect the staged and unstaged changed files to see whether `members/` and/or `functions/` changed, then run the relevant checks.

### Members checks

If any changed files are under `members/`, run these commands from `members/` in order:

```bash
bun run lint
bun run test
bun run build
bun run e2e
```

### Functions checks

If any changed files are under `functions/`, run these commands from `functions/` in order:

```bash
npm run lint
bun test src/
npm run build
npm run typecheck:tests
```

### Rules

- If both `members/` and `functions/` changed, run both sets of checks.
- If neither `members/` nor `functions/` changed, skip these checks.
- Fail fast: stop on the first failing command and do not create the commit until it passes.
- Report the failing command and its error output to the user.

## Changelogs

This repo uses `conventional-changelog-cli` to auto-generate per-folder `CHANGELOG.md` files from conventional commits. Run:

```bash
bun run changelog
```

This generates 10 changelogs (one for `members/` and one for each API folder in `functions/src/`). Filtering is based on which files a commit touched, not the scope in the message — but using the correct scope improves changelog readability.

`shared-api/` does not have its own changelog. Changes there appear in the consuming API's changelog when committed together.

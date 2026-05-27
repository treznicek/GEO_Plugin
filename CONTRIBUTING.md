# Contributing to GEO Plugin

Thank you for your interest in contributing. This guide covers everything you need to get oriented, write consistent code, and get your changes merged.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Branching Strategy](#branching-strategy)
3. [Commit Messages](#commit-messages)
4. [Coding Standards](#coding-standards)
5. [CSS Conventions](#css-conventions)
6. [Testing Requirements](#testing-requirements)
7. [Pull Request Process](#pull-request-process)
8. [PR Size Policy](#pr-size-policy)

---

## Getting Started

1. Fork the repository and clone your fork locally.
2. Load the extension unpacked in Chrome (see [README — Installation](README.md#installation-development)).
3. Create a branch for your work (see [Branching Strategy](#branching-strategy)).
4. Make changes, test manually, then open a pull request against `main`.

There is no build step. Edit the source files directly and reload the extension in `chrome://extensions`.

---

## Branching Strategy

All work happens on **short-lived feature or bugfix branches**. Direct pushes to `main` are blocked — all changes must arrive via pull request.

### Branch naming

| Type | Pattern | Example |
|---|---|---|
| New feature | `feature/<short-description>` | `feature/bam-file-support` |
| Bug fix | `bugfix/<issue-number>` | `bugfix/42` or `bugfix/42-igv-blank-tab` |
| Documentation | `docs/<short-description>` | `docs/update-architecture` |
| Refactor | `refactor/<short-description>` | `refactor/extract-soft-parser` |
| Chore / tooling | `chore/<short-description>` | `chore/update-gitignore` |

Use lowercase and hyphens. Keep descriptions short (2–4 words).

### Staying in sync

Pull from `origin/main` into your feature branch frequently to minimise merge conflicts:

```bash
git fetch origin
git merge origin/main
```

Do this at least once a day on active branches and always before opening a pull request.

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>: <short imperative summary>

[optional body — explain WHY, not WHAT]
```

### Types

| Type | When to use |
|---|---|
| `feat` | A new feature visible to the user |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace — no logic change |
| `refactor` | Code restructuring with no behaviour change |
| `test` | Adding or correcting tests |
| `chore` | Tooling, dependencies, CI, gitignore |

### Examples

```
feat: add BAM file detection in GSM supplementary files

fix: resolve blank IGV tab caused by unclosed script tag

docs: document SOFT text parsing in README architecture section

refactor: extract genome-detection logic into standalone function

chore: add .gitignore entries for JetBrains IDE files
```

### Rules

- Summary line: 72 characters max, imperative mood ("add", "fix", "remove" — not "added" or "fixes")
- Do not end the summary with a period
- Reference GitHub issues where relevant: `fix: handle missing organism field (#37)`

---

## Coding Standards

### Language

- **Vanilla JavaScript only** — no npm packages, no bundler, no framework
- Target ES2020 (Chrome's built-in JS engine; no transpilation)
- All content-script code must remain inside the top-level IIFE in `content.js`

### Style

- **2-space indentation**, spaces not tabs
- Single quotes for strings
- Semicolons required
- One `const` / `let` declaration per line
- Prefer `const`; use `let` only when the binding is reassigned
- `function` declarations for named functions (not arrow functions assigned to `const`), except for short inline callbacks

### Naming

| Target | Convention | Example |
|---|---|---|
| Variables / functions | `camelCase` | `detectGenome`, `gseFiles` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_SAMPLES_SHOWN`, `GEO_URL` |
| DOM IDs | `geo-plugin-kebab-case` | `geo-plugin-cart-footer` |
| CSS classes | `geo-plugin-kebab-case` | `geo-plugin-bw-label` |

### Error handling

- All `fetch` calls must have a `.catch` or `try/catch` block
- Errors in the content script must never propagate to the host page's console unhandled
- The outer `try/catch` in the panel section is a last-resort guard — do not rely on it for expected error paths
- Show user-facing error messages inline (not `alert`); always include a fallback "View on NCBI →" link

### No-ops to avoid

- Do not add `console.log` statements in committed code
- Do not modify `document.title` or `window.location`
- Do not store user data in `localStorage` or `chrome.storage` without explicit user consent

---

## CSS Conventions

- **All selectors must be prefixed with `geo-plugin-`** — this prevents style collisions with journal page CSS
- Use IDs (`#geo-plugin-panel`) for unique singleton elements; classes (`.geo-plugin-link`) for repeated elements
- Avoid `!important`
- Animations use CSS transitions, not JavaScript timers
- `z-index` values follow this hierarchy:

| Element | z-index |
|---|---|
| Overlay | 2147483645 |
| Panel | 2147483646 |
| Badge | 2147483647 |

---

## Testing Requirements

There is no automated test suite. All testing is manual. Before opening a pull request, verify the following:

### Core functionality

- [ ] Red badge appears on a page that contains GEO accessions
- [ ] Badge count matches the number of unique accessions on the page
- [ ] Badge disappears when the panel opens; reappears when it closes
- [ ] Panel slides in and out with animation; overlay click closes it

### GSE tree

- [ ] Expanding a GSE shows title, super-series, sub-series, and sample list
- [ ] "View all N samples" link appears when more than 10 samples exist
- [ ] Failed fetch shows error message with NCBI fallback link
- [ ] Re-clicking a failed expand retries the fetch

### GSM / BigWig cart

- [ ] Expanding a GSM shows BigWig files (or "No BigWig files found")
- [ ] Checking a file adds it to the cart; unchecking removes it
- [ ] Cart footer appears with correct count; hides when cart is empty
- [ ] "Add all" per-sample adds all BigWig files for that GSM
- [ ] "Add all loaded" per-series adds all fetched BigWig files across expanded GSMs
- [ ] Count on "Add all loaded" button increments as GSMs are expanded

### IGV checkout

- [ ] "Open in IGV" opens a new tab
- [ ] IGV browser renders with the selected genome
- [ ] Tracks appear in the browser for at least one known-good BigWig URL
- [ ] Genome selector dropdown works and "Reload with genome" re-initialises the browser

### Recommended test pages

| Purpose | URL |
|---|---|
| Multiple accession types | `https://pmc.ncbi.nlm.nih.gov/articles/PMC12136341/` |
| GEO series with sub-series | `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE68849` |
| No accessions (badge should not appear) | Any non-genomics page |

---

## Pull Request Process

### Opening a Draft PR

All pull requests must start as a **Draft** until all manual tests pass. This signals to reviewers that the work is in progress and not yet ready for a final review.

**Via the GitHub web UI:**
1. Push your branch and open a new PR
2. Click the **dropdown arrow** next to "Create pull request"
3. Select **"Create draft pull request"**
4. Fill in the template (see below), then submit

**Via the GitHub CLI** (if installed):
```bash
gh pr create --draft --title "feat: your title" --body "$(cat .github/pull_request_template.md)"
```

When the work is complete and tests pass, click **"Ready for review"** to move it out of draft.

### PR template

Every PR is pre-populated with three required sections:

| Section | Purpose |
|---|---|
| **Summary** | Explain what changed and why; link related issues |
| **Testing** | List every step taken to verify the change; check off as you go |
| **Scope** | State whether the change is breaking; name key files touched |

Fill in all three before marking the PR ready for review.

### Review and merge

1. Ensure your branch is up to date with `origin/main`
2. Verify all manual test cases pass and check off the Testing section
3. At least **one approving review** is required before merge
4. Do not merge your own pull request without a review
5. Squash or rebase before merging to keep the history linear (preferred over merge commits)

---

## PR Size Policy

PRs must stay **small and focused** — one concern per PR (one feature, one fix, one refactor).

### Limits (enforced by CI)

| Lines changed | Outcome |
|---|---|
| 0 – 200 | Pass |
| 201 – 300 | Warning in CI — consider splitting if adding more |
| 301+ | **CI fails** — PR cannot be merged until reduced |

Documentation-only changes (`*.md`, `NOTICE`, `LICENSE`) are excluded from the count. Only source files (`*.js`, `*.css`, `*.json`, `*.html`) are measured.

### Checking your own diff locally

```bash
git diff --numstat origin/main | awk '{add+=$1; del+=$2} END {print add+del}'
```

### How to split a large PR

- Break the work into **independently mergeable pieces** — e.g. refactor first, then feature on top
- A "preparation" PR that only renames or restructures (no behaviour change) is a valid standalone PR
- If the full feature genuinely cannot be split, document why in the Summary section and request a size-limit exception in the PR description

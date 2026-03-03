# CLAUDE.md — AI Assistant Guide

## Repository Overview

This is the **GitHub profile repository** for [ConstevoTechnologies](https://github.com/ConstevoTechnologies). GitHub treats the repository `<username>/<username>` as special: its `README.md` is rendered directly on the user's public GitHub profile page.

There is **no application code, build system, or test suite** in this repository. The entire meaningful content lives in `README.md`.

---

## Repository Structure

```
ConstevoTechnologies/
└── README.md   # GitHub profile page content (rendered publicly)
```

| File | Purpose |
|------|---------|
| `README.md` | Profile page displayed on https://github.com/ConstevoTechnologies |
| `CLAUDE.md` | This file — guidance for AI assistants working in this repo |

---

## Owner / Profile Context

- **Handle**: @ConstevoTechnologies / MadGan
- **Interests**: Cloud-native apps, Cloud, DevOps, DevSecOps, IaC, Cybersecurity, Web3, Coding
- **Contact**: Not yet specified in README (placeholder `📫 How to reach me ...`)
- **Pronouns**: MadGan

---

## Development Workflows

### Making changes to the profile README

1. Edit `README.md` directly — it is the sole deliverable.
2. Preview rendering locally with a Markdown viewer or by pushing to the branch and checking the GitHub preview link.
3. Commit with a clear message describing what changed (e.g. `Add contact links`, `Update interests section`).
4. Push to the designated branch and open a pull request targeting `main`.

### Branch conventions

- Feature / AI branches follow the pattern `claude/<short-description>-<sessionId>`.
- Default production branch is `main` (remote) / `master` (local default).
- **Never push directly to `main`** — always use a branch and PR.

### Git push

```bash
git push -u origin <branch-name>
```

Retry on network errors with exponential back-off (2 s → 4 s → 8 s → 16 s, max 4 retries).

---

## README Conventions

- Written in **GitHub Flavored Markdown (GFM)**.
- Uses GitHub-rendered emojis (`:wave:`, `👋`, etc.) for personality.
- The HTML comment block at the bottom is intentional — it is GitHub's auto-generated hint and should be preserved.
- Keep the tone friendly and first-person.
- Placeholders (`...`, `How to reach me ...`) should be filled in before the profile is considered complete.

### Suggested sections to add / complete

| Section | Status |
|---------|--------|
| Bio / intro | Done |
| Interests | Done |
| Currently learning | Done |
| Looking to collaborate | Done |
| Contact / reach me | **Placeholder — needs content** |
| Fun fact | **Placeholder — needs content** |
| GitHub stats badges | Not present |
| Tech stack / tools badges | Not present |
| Social links | Not present |

---

## Key Conventions for AI Assistants

1. **No code to run** — there are no tests, linters, build scripts, or CI pipelines. Do not attempt to install dependencies or run commands.
2. **Only file to edit is `README.md`** — unless the task explicitly involves other files (e.g. adding GitHub Actions workflows).
3. **Preserve existing tone** — the profile uses a casual, emoji-friendly, first-person voice. Match that style when adding content.
4. **Do not delete the HTML comment** at the bottom of `README.md`; it is part of the original GitHub template.
5. **Commit and push to the correct branch** (`claude/add-claude-documentation-Pii7G` for this session) — never to `main` directly.
6. **No secrets** — do not commit email addresses, API keys, or personal tokens into this repository.

---

## Common Tasks

| Task | Action |
|------|--------|
| Update interests | Edit the relevant bullet in `README.md` |
| Add contact info | Replace `📫 How to reach me ...` with actual links |
| Add GitHub stats | Insert a `![GitHub Stats](https://github-readme-stats.vercel.app/...)` badge |
| Add tech badges | Use shields.io or simple-icons badge URLs |
| Add social links | Add markdown links below the contact bullet |

---

## No Build / CI Notes

- No `package.json`, `requirements.txt`, `Makefile`, or any build artifact exists.
- No linter configuration is present.
- No GitHub Actions workflows exist (`.github/` directory is absent).
- If GitHub Actions are added in the future, document them here.

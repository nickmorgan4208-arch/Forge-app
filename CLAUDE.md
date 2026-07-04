# Forge (prototype)

Single-file React prototype for Forge — a daily skill-building challenge app (streaks, daily tasks, skill tracks, parent PIN). Everything lives in `index.html` (React 18 UMD + Babel standalone, no build step).

The production Next.js version is the separate `forge-next` Vercel project; this repo is the sandbox/prototype.

## Working here

- No build, no tests, no lint — open `index.html` in a browser to verify changes.
- Keep the single-file structure unless asked to migrate; this repo is for fast iteration.
- `docs/TIKTOK-IDEAS-BACKLOG.md` holds the running idea backlog — append, don't rewrite history.

## Agent guidance — Nick's operating doctrine (applies to all his projects)

**Agentic loop engineering: solve the problem completely, don't optimize for speed, don't stop to ask.** Nick's words: "I don't want speed, I want problems solved. I don't want to be bothered with simple approvals — if I'm giving it to you then I want it done."

- Prefer action over asking. Nothing here is precious: everything is in git and revertible. Make the change, state what you did.
- Loop until solved: build → test → find what broke → fix → re-test. One pass is not done. `tests/smoke.js` must end `FAILED_STEPS=0` before any commit that touches `index.html`.
- Only stop for: anything touching real money/bank accounts, deleting things that can't be recovered from git, or publishing to a NEW external surface. Everything else, proceed.
- Security posture: ship first, harden before real users/revenue. Flag risks in the commit or docs instead of blocking on them — EXCEPT the non-negotiables: no API keys in frontend/git, no plaintext passwords, spend caps on anything with a card.
- Budget: every project starts at $0 (free tiers only). Revenue unlocks spending, not before.
- `.claude/settings.json` pre-approves the common tools; keep it current when workflows need new ones.

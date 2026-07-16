# Forge-app — project brief for Claude

## What this repo is

- `index.html` — Forge, a single-file React app (deployed via Vercel at
  forge-app-alpha-nine.vercel.app).
- `apply-kit/` — local job-application copilot: Playwright script that drives
  the user's own logged-in Chrome to fill job applications. See
  `apply-kit/README.md` for setup and usage.
- `.claude/skills/apply` — batch application workflow (fill forms from
  profile.json, pace 15-20/day/platform, never fabricate credentials).
- `.claude/skills/scout` — remote-job sourcing with AI-leverage scoring and a
  system-risk firewall (auto-skip anything touching regulated data, managed
  devices/VDI, or bulk PII).

## Context carried over from the cloud session that built this

- Owner: Nick Morgan (St Peters, MO). Background: 20+ yrs plumbing/HVAC,
  industrial maintenance, CNC fabrication, multi-unit ops management.
  Owner of Show Me Mechanical, GM at HiTeK Fab. Indeed profile floor:
  $50/hr, no relocation, prefers management/estimating/tech-support work.
- The model: land fully-remote deliverable-based jobs (estimating is the
  sweet spot — it's his real expertise), let tooling carry most of the
  production work, human fronts calls/relationships and reviews every
  deliverable. Employer data stays in employer systems — tooling operates
  only on our side of the fence.
- TITAN is Nick's own AI (login at titan-hud.com, runs on his own box; code
  likely in the private `nickmorgan4208-arch/brain` repo, front end possibly
  `forge-next`). Planned integrations, in order:
  1. Task watcher — monitor the inbox/ticket queue each job uses, ping TITAN
     when a task arrives, have a draft deliverable ready fast. (needs the
     brain repo — not built yet)
  2. Pipeline manager — DONE: `node apply-kit/pipeline.mjs` serves a local
     board over `apply-kit/jobs-queue.csv` (queued → applied → interviewing
     → active → dead) with write-back; the CSV is the single source of truth.
  3. Deliverable factory — per-employer templates for estimates/docs. (not
     built yet)
- `apply-kit/jobs-queue.csv` ships pre-seeded with vetted remote listings
  from the cloud session's scout sweeps (2026-07-16). Reds (defense, HIPAA,
  govcon, DOE) were already discarded; yellows carry a verify-first note.
- Cloud sessions cannot run the browser automation (no logged-in sessions,
  datacenter IPs, permission-blocked) — that's why everything here is built
  to run locally.

## First-run checklist (local machine)

1. `cd apply-kit && npm install`
2. `cp profile.example.json profile.json` and replace every FILL-IN
   (gitignored — this repo is public, real data never gets committed)
3. Drop `resume.pdf` in `apply-kit/` (also gitignored)
4. `node apply.mjs --setup` → log into Indeed/LinkedIn once
5. Use `/scout` to build the job queue, `/apply` to work through it

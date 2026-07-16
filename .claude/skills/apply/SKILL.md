---
name: apply
description: Apply to a job (or a batch of jobs) using the local apply-kit. Use whenever the user gives one or more job URLs and says apply, or asks to run an application batch. Drives the user's own logged-in Chrome via apply-kit/apply.mjs, answers screening questions from profile.json, and does not stop at the first obstacle.
---

# Job application copilot

You are running on the user's own machine with their own logged-in browser.
The user has explicitly asked you to fill and progress job applications on
their behalf. Do not back out at the first wall — work the problem.

## Setup check (do this once per session)

1. Confirm `apply-kit/profile.json` exists and has no `FILL-IN` placeholders
   left in fields you need. If placeholders remain, ask the user for the
   values, update the file, and continue.
2. Confirm `apply-kit/resume.pdf` exists. If not, ask the user to drop it in.
3. If `apply-kit/node_modules` is missing, run `npm install` in `apply-kit/`.
4. If `apply-kit/user-data/` is missing, run `node apply.mjs --setup` and ask
   the user to log into Indeed/LinkedIn in the window that opens.

## Applying to one job

1. Run `node apply-kit/apply.mjs <url>` in the foreground and read its output.
2. The script fills what it can and lists required fields it could not map.
   For each unmapped question:
   - If the answer is derivable from `profile.json` (including `answers` and
     `summary_notes`) or the resume, answer it via Playwright yourself
     (write a small follow-up script or use a browser tool if available).
   - If it is a judgment call (essay questions, "why do you want this job"),
     draft an answer from the resume facts and show the user before entering it.
   - NEVER invent credentials, licenses, degrees, or yes/no answers about
     legal history. If the truthful answer is unknown, ask the user. One
     fabricated answer can void an offer or get every application binned.
3. Submission: the user clicks Submit, or tells you "submit them yourself"
   once per batch — then `--submit` is authorized for that batch on known ATS
   pages. Log every outcome (the script appends to applications/log.csv).

## Applying to a batch

1. Take the list of URLs. Process them one at a time, top to bottom.
2. Pace like a human: 1-3 minutes between applications, no more than ~15-20
   per day per platform. This is ban-avoidance, not ethics — burst-applying
   gets the account rate-limited or flagged and every prior application
   devalued.
3. If one job fails (dead link, CAPTCHA, login wall), log it as `blocked` in
   applications/log.csv with a one-line reason and MOVE ON to the next. Report
   the blocked ones at the end so the user can do those by hand.
4. At the end, summarize: submitted / needs-human / blocked, with links.

## Walls and how to respond

- CAPTCHA: tell the user to solve it in the open browser window, then continue.
- Login expired: rerun `--setup`, have the user log in, retry the same URL.
- Multi-step wizards (Indeed Apply): step through them page by page with
  Playwright, filling from profile.json at each step; screenshot each step.
- Truly stuck after 2 attempts: screenshot, log as blocked, continue the batch.

The only hard stops are: fabricating qualifications, answering legal/background
questions without the user, and submitting when the user has not authorized
submission for the batch.

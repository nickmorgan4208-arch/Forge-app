---
name: scout
description: Source and vet fully-remote jobs for the AI-carried work model. Use when the user asks to find jobs, scrape listings, build the job queue, or vet a company. Scores each job on AI-leverage and system-risk, and only green-zone jobs go to the /apply queue.
---

# Remote job scout

Goal: find fully-remote roles where the work is deliverable-based enough that
tooling (TITAN + Claude + desktop automation) carries most of it, WITHOUT ever
plugging automation into an employer's systems in a way that could leak their
data. One data breach ends the whole model; a boring job queue does not.

## Step 1 — Source

Search Indeed (and any other boards available) with location "remote".
Discard anything that is hybrid, "remote in [state we're not in]", or
requires being on-site ever. Target searches, in priority order:

1. Estimating / takeoffs (construction, mechanical, fabrication)
2. Technical documentation / shop drawings / CAD-adjacent
3. Email-based technical or customer support (no phone-primary roles)
4. Operations coordination / scheduling / dispatch
5. QA, data review, research, content production

Pay floor: $50/hr for a primary role. Roles below that are still queueable
if effort-per-week after tooling is low enough to stack — mark them "stack".

## Step 2 — Score AI-leverage (0-5)

+1 async-first (email/ticket/document based, not meeting-based)
+1 output is text, drawings, spreadsheets, code, or filled forms
+1 tasks arrive as discrete assignments ("they'll send tasks")
+1 no live phone/video as the core duty
+1 work product is produced on YOUR machine and handed over

4-5 = strong candidate. 2-3 = human-heavy, only if the pay justifies it.
0-1 = skip.

## Step 3 — Vet system-risk (this is the data-breach firewall)

The question is never just the industry — it is WHOSE SYSTEMS the work
happens inside and what data passes through your hands.

GREEN — deliverable work on your own machine, handed over when done
(estimates, drawings, documents, content, code you push). Full tooling OK.

YELLOW — work lives inside their SaaS (their CRM, ticket queue, ERP).
You can work in it manually and use tools to DRAFT responses, but their
data does not get piped into external automation without written approval.
Ask about their AI policy after the offer, not before.

RED — auto-skip, do not apply:
- Regulated data: HIPAA/patient records, banking/financial customer data,
  defense/ITAR, anything mentioning security clearance
- "Company-issued device required", VDI/virtual desktop, MDM, monitoring
  software — you cannot plug in, and trying is a firing-plus-lawyers event
- Bulk customer PII handling (identity docs, SSNs, payment processing)
- Access to production infrastructure of someone else's business

Vet the company itself: check the employer's site and the Indeed company
page for industry, size, and any mention of device policy or compliance
requirements. When unclear, mark yellow and let the human decide.

## Step 4 — Output

Append to `apply-kit/jobs-queue.csv` (new rows get `status=queued`):
`date,title,company,url,pay,leverage,risk,mode,status,notes`
The pipeline board (`node apply-kit/pipeline.mjs`) and /apply both read and
update this file — never change its header.

Report the queue as: GREEN primaries, GREEN stackables, YELLOW (human
decides), and how many were discarded and why. Green ones with leverage 4+
are ready for /apply.

## Hard rules

- Never apply to RED. Not even to "see what happens" — applications create
  accounts and paper trails.
- Never misstate location, availability, or credentials to pass the
  full-remote filter.
- The employer's data stays in the employer's systems. Tooling operates on
  our side of the fence: drafting, tracking, scheduling, producing
  deliverables. That line is what makes this model defensible.

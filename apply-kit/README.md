# apply-kit — local job-application copilot

Fills job applications using **your own computer and your own logged-in
Chrome**. This is the architecture every working "AI applies for you" repo
uses, because it is the only one that works: your sessions (Indeed, LinkedIn)
live in your browser, and job boards block cloud/datacenter traffic on sight.

The default mode fills everything it can, screenshots the result, and **stops
before Submit so you click it**. That keeps you in control of what goes out
under your name — and accounts that pace like humans don't get flagged.

## One-time setup (on your PC or Mac, not in the cloud)

```bash
git clone https://github.com/nickmorgan4208-arch/Forge-app.git
cd Forge-app/apply-kit
npm install                        # installs Playwright
cp profile.example.json profile.json
# edit profile.json - replace every FILL-IN. This file is gitignored;
# your phone/address/answers never get committed to the (public!) repo.
# drop your resume in this folder as resume.pdf (also gitignored)
node apply.mjs --setup             # opens Chrome; log into Indeed etc.
```

## Applying

```bash
node apply.mjs "https://www.indeed.com/viewjob?jk=..."      # fill + pause
node apply.mjs "https://boards.greenhouse.io/..." --submit  # fill + submit
```

Every run screenshots the filled form into `applications/` and appends to
`applications/log.csv` so you have a record of where you applied.

## Batch mode with Claude Code

Install [Claude Code](https://claude.com/claude-code) locally, open this repo,
and say:

> /apply — here are 10 job links, work through them

The skill in `.claude/skills/apply/` tells Claude to: fill each one, answer
screening questions from your `profile.json`, draft essay answers from your
real resume, pace 1-3 minutes between applications, log CAPTCHAs/dead links
as blocked and keep moving, and report submitted / needs-you / blocked at the
end. It will not fabricate credentials and it will not answer background-check
questions without you — those are the two things that torch offers.

## Ground rules that keep the account alive

- **15-20 applications per platform per day, max.** Boards detect bursts.
- **Targeted beats volume.** Feed it jobs that match the resume; auto-blasting
  mismatches trains recruiters' filters to bin you.
- **Never lie in answers.** Automation gets you to the interview faster; the
  interview still checks the claims.

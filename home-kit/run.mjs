// One-shot runner: scrape -> brief -> save. This is the single entrypoint to hand
// TITAN (or a scheduler): `node run.mjs`. It cd's to its own folder, so it works no
// matter where it's invoked from.
//
//   - runs scrape.mjs (pull + diff + store)
//   - runs brief.mjs (change-only summary)
//   - writes the latest brief to brief.latest.txt (TITAN can read/surface this)
//   - appends every run to brief.log with a timestamp
//
// Exit code 0 = ran; nonzero = a step crashed (check the log).

import { spawnSync } from "node:child_process";
import { writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

process.chdir(dirname(fileURLToPath(import.meta.url)));

const step = (script) => spawnSync(process.execPath, [script], { encoding: "utf8" });
const stamp = new Date().toISOString();

const s = step("scrape.mjs");
if (s.stdout) process.stdout.write(s.stdout);
if (s.stderr) process.stderr.write(s.stderr);

const b = step("brief.mjs");
if (b.stderr) process.stderr.write(b.stderr);
const brief = (b.stdout || "").trim();

if (brief) {
  writeFileSync("brief.latest.txt", brief);
  appendFileSync("brief.log", `\n===== ${stamp} =====\n${brief}\n`);
  process.stdout.write("\n" + brief + "\n");
} else {
  appendFileSync("brief.log", `${stamp}  no changes\n`);
  process.stdout.write(`${stamp}  no changes\n`);
}

process.exit(s.status || b.status || 0);

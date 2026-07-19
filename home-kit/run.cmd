@echo off
REM Windows wrapper so Task Scheduler / TITAN can run home-kit reliably.
REM Sets the working dir to this file's folder, runs the one-shot, logs output.
cd /d "%~dp0"
node run.mjs >> run.out.log 2>&1

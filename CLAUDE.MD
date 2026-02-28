# OpenClawMaster – Claude Code Project Guide

## Goal
Build and operate an “agent swarm control plane”:
- Develop locally on Windows 11
- Manage an Ubuntu VPS over SSH
- Manage deployments hosted in Coolify
- Persist project history/decisions in NotebookLM via notebooklm-mcp-cli

## Operating model (2-tier)
- Orchestrator mindset: decide scope, acceptance criteria, prioritize, write prompts.
- Executors: Claude CLI sessions (and later other agents) implement code, run tests, open PRs.

## Definition of Done (for any task/PR)
A change is “done” only if:
1) Branch is up-to-date with main (no conflicts)
2) CI is green (lint/typecheck/tests)
3) PR description includes: what changed + how to verify
4) If UI changed: include screenshot(s) in PR description

## Safety / Permissions
- Never commit secrets. Use .env files and keep them out of git.
- Before destructive ops (delete, stop, rm -rf, database changes) require explicit confirmation.
- Prefer least-privilege tokens (Coolify, GitHub).
- If running with --dangerously-skip-permissions, behave as if you still need confirmations.

## Repo conventions
- Use feature branches: feat/*, fix/*, chore/*
- Prefer small PRs. If >300 lines, split.
- Always run: lint + tests before PR.

## Useful slash commands (project skills)
- /brainstorm … -> turn a vague idea into an implementation plan
- /ssh … -> safely run remote VPS operations
- /coolify … -> deployments/logs/resources via Coolify
- /notebooklm … -> write & query project history in NotebookLM
- /github … -> PR workflow, checks, review gates

## Environment assumptions
- Windows 11 dev machine — native PowerShell, NOT WSL or Linux
- Prefer PowerShell commands over bash/sh scripts for local operations
- Scripts targeting the local machine must be .ps1 (PowerShell), not .sh
- .sh scripts are only for remote Ubuntu VPS operations over SSH
- Ubuntu VPS reachable via SSH config alias (recommended)
- gh CLI installed for GitHub operations
- Coolify managed deployments
- notebooklm-mcp-cli installed for NotebookLM history
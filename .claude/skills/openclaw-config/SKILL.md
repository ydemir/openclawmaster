---
name: openclaw-config
description: Diagnose and fix OpenClaw bot issues - troubleshoot WhatsApp/Telegram/Signal/Discord/Slack failures, manage sessions, cron jobs, multi-agent orchestration, memory, config hot-reload, WebSocket RPC API, channels, security, autopilot settings, and building a management UI for OpenClaw.
version: 4.0.0
---

# OpenClaw Operations Runbook

> **Önemli:** Bu komutlar Ubuntu VPS üzerinde çalışır. Yerel Windows'tan değil, SSH ile bağlanarak çalıştır.
> Hızlı bağlantı: `ssh <vps-alias>` → sonra komutları çalıştır.

Diagnose and fix real problems. Every command here is tested and works.

---

## Quick Health Check

Run this first when anything seems wrong. Copy-paste the whole block:

```bash
echo "=== GATEWAY ===" && \
ps aux | grep -c "[o]penclaw" && \
echo "=== CONFIG JSON ===" && \
python3 -m json.tool ~/.openclaw/openclaw.json > /dev/null 2>&1 && echo "JSON: OK" || echo "JSON: BROKEN" && \
echo "=== CHANNELS ===" && \
cat ~/.openclaw/openclaw.json | jq -r '.channels | to_entries[] | "\(.key): policy=\(.value.dmPolicy // "n/a") enabled=\(.value.enabled // "implicit")"' && \
echo "=== PLUGINS ===" && \
cat ~/.openclaw/openclaw.json | jq -r '.plugins.entries | to_entries[] | "\(.key): \(.value.enabled)"' && \
echo "=== CREDS ===" && \
ls ~/.openclaw/credentials/whatsapp/default/ 2>/dev/null | wc -l | xargs -I{} echo "WhatsApp keys: {} files" && \
for d in ~/.openclaw/credentials/telegram/*/; do bot=$(basename "$d"); [ -f "$d/token.txt" ] && echo "Telegram $bot: OK" || echo "Telegram $bot: MISSING"; done && \
[ -f ~/.openclaw/credentials/bird/cookies.json ] && echo "Bird cookies: OK" || echo "Bird cookies: MISSING" && \
echo "=== CRON ===" && \
cat ~/.openclaw/cron/jobs.json | jq -r '.jobs[] | "\(.name): enabled=\(.enabled) status=\(.state.lastStatus // "never") \(.state.lastError // "")"' && \
echo "=== RECENT ERRORS ===" && \
tail -10 ~/.openclaw/logs/gateway.err.log 2>/dev/null && \
echo "=== MEMORY DB ===" && \
sqlite3 ~/.openclaw/memory/main.sqlite "SELECT COUNT(*) || ' chunks, ' || (SELECT COUNT(*) FROM files) || ' files indexed' FROM chunks;" 2>/dev/null
```

---

## File Map

```
~/.openclaw/
├── openclaw.json                    # MAIN CONFIG — channels, auth, gateway, plugins, skills
├── openclaw.json.bak*               # Auto-backups (.bak, .bak.1, .bak.2 ...)
├── exec-approvals.json              # Exec approval socket config
│
├── agents/main/
│   ├── agent/auth-profiles.json     # Anthropic auth tokens
│   └── sessions/
│       ├── sessions.json            # SESSION INDEX — keys are like agent:main:whatsapp:+1234
│       └── *.jsonl                  # Session transcripts (one JSON per line)
│
├── workspace/                       # Agent workspace (git-tracked)
│   ├── SOUL.md                      # Personality, writing style, tone rules
│   ├── IDENTITY.md                  # Name, creature type, vibe
│   ├── USER.md                      # Owner context and preferences
│   ├── AGENTS.md                    # Session behavior, memory rules, safety
│   ├── BOOT.md                      # Boot instructions (autopilot notification protocol)
│   ├── HEARTBEAT.md                 # Periodic task checklist (empty = skip heartbeat)
│   ├── MEMORY.md                    # Curated long-term memory (main session only)
│   ├── TOOLS.md                     # Contacts, SSH hosts, device nicknames
│   ├── memory/                      # Daily logs: YYYY-MM-DD.md, topic-chat.md
│   └── skills/                      # Workspace-level skills
│
├── memory/main.sqlite               # Vector memory DB (Gemini embeddings, FTS5 search)
│
├── logs/
│   ├── gateway.log                  # Runtime: startup, channel init, config reload, shutdown
│   ├── gateway.err.log              # Errors: connection drops, API failures, timeouts
│   └── commands.log                 # Command execution log
│
├── cron/
│   ├── jobs.json                    # Job definitions (schedule, payload, delivery target)
│   └── runs/                        # Per-job run logs: {job-uuid}.jsonl
│
├── credentials/
│   ├── whatsapp/default/            # Baileys session: ~1400 app-state-sync-key-*.json files
│   ├── telegram/{botname}/token.txt # Bot tokens (one per bot account)
│   └── bird/cookies.json            # X/Twitter auth cookies
│
├── extensions/{name}/               # Custom plugins (TypeScript)
│   ├── openclaw.plugin.json         # {"id", "channels", "configSchema"}
│   ├── index.ts                     # Entry point
│   └── src/                         # channel.ts, actions.ts, runtime.ts, types.ts
│
├── identity/                        # device.json, device-auth.json
├── devices/                         # paired.json, pending.json
├── media/inbound/                   # Received images, audio files
├── media/browser/                   # Browser screenshots
├── browser/openclaw/user-data/      # Chromium profile (~180MB)
├── tools/signal-cli/                # Signal CLI binary
├── subagents/runs.json              # Sub-agent execution log
├── canvas/index.html                # Web canvas UI
└── telegram/
    ├── update-offset-coder.json     # {"lastUpdateId": N} — Telegram polling cursor
    └── update-offset-sales.json     # Reset these to 0 to replay missed messages
```

---

## Troubleshooting: WhatsApp

### "I sent a message but got no reply"

This is the #1 issue. The message arrives but the bot doesn't respond. Check in this order:

```bash
# 1. Is the bot actually running?
grep -i "whatsapp.*starting\|whatsapp.*listening" ~/.openclaw/logs/gateway.log | tail -5

# 2. Check for 408 timeout drops (WhatsApp web disconnects frequently)
grep -i "408\|499\|retry" ~/.openclaw/logs/gateway.err.log | tail -10
# If you see "Web connection closed (status 408). Retry 1/12" — this is normal,
# it auto-recovers. But if retries reach 12/12, the session dropped completely.

# 3. Check for cross-context messaging blocks
grep -i "cross-context.*denied" ~/.openclaw/logs/gateway.err.log | tail -10
# Common: "Cross-context messaging denied: action=send target provider "whatsapp" while bound to "signal""
# This means the agent was in a Signal session and tried to reply on WhatsApp.
# FIX: The message needs to come through in the WhatsApp session context, not Signal.

# 4. Check the session exists for that contact
cat ~/.openclaw/agents/main/sessions/sessions.json | jq -r 'to_entries[] | select(.key | test("whatsapp")) | "\(.key) | \(.value.origin.label // "?")"'

# 5. Check if the sender is allowed
cat ~/.openclaw/openclaw.json | jq '.channels.whatsapp | {dmPolicy, allowFrom, selfChatMode, groupPolicy}'
# If dmPolicy is "allowlist" and the sender isn't in allowFrom, message is silently dropped.

# 6. Check if it's a group message (groups are disabled by default)
cat ~/.openclaw/openclaw.json | jq '.channels.whatsapp.groupPolicy'
# "disabled" means ALL group messages are ignored.

# 7. Check for lane congestion (agent busy with another task)
grep "lane wait exceeded" ~/.openclaw/logs/gateway.err.log | tail -5
# If the agent is stuck on a long LLM call, new messages queue up.

# 8. Check for agent run timeout
grep "embedded run timeout" ~/.openclaw/logs/gateway.err.log | tail -5
# Hard limit is 600s (10 min). If the agent's response takes longer, it's killed.
```

### "WhatsApp fully disconnected"

```bash
# Check credential files exist (should be ~1400 files)
ls ~/.openclaw/credentials/whatsapp/default/ | wc -l

# If 0 files: session was never created or got wiped
# Fix: re-pair with `openclaw configure`

# Check for QR/pairing events
grep -i "pair\|link\|qr\|scan\|logged out" ~/.openclaw/logs/gateway.log | tail -10

# Check for Baileys errors
grep -i "baileys\|DisconnectReason\|logout\|stream:error" ~/.openclaw/logs/gateway.err.log | tail -20

# Nuclear fix: delete credentials and re-pair
# rm -rf ~/.openclaw/credentials/whatsapp/default/
# openclaw configure
```

---

## Troubleshooting: Telegram

### "Bots have issues / forget things"

Two separate problems that look the same:

```bash
# 1. Check for config validation errors (THE COMMON ONE)
grep -i "telegram.*unrecognized\|telegram.*invalid\|telegram.*policy" ~/.openclaw/logs/gateway.err.log | tail -10
# Known issue: the keys "token" and "username" under accounts are not recognized.
# The correct field is "botToken", not "token".

# 2. Check the actual config
cat ~/.openclaw/openclaw.json | jq '.channels.telegram'
# Verify each bot has "botToken" (not "token") and "name" fields.

# 3. Check polling status — bots die after getUpdates timeout
grep -i "telegram.*exit\|telegram.*timeout\|getUpdates" ~/.openclaw/logs/gateway.err.log | tail -10
# "[telegram] [sales] channel exited: Request to 'getUpdates' timed out after 500 seconds"
# This means the bot lost connection to Telegram's API and stopped listening.
# Fix: restart gateway — `openclaw gateway restart`

# 4. Check the polling offset (if bot "forgets" or replays old messages)
cat ~/.openclaw/telegram/update-offset-coder.json
cat ~/.openclaw/telegram/update-offset-sales.json
# If lastUpdateId is stuck or 0, the bot will reprocess old messages.
# To skip to latest: the gateway sets this automatically on restart.

# 5. Check if both bots are starting
grep -i "telegram.*starting\|telegram.*coder\|telegram.*sales" ~/.openclaw/logs/gateway.log | tail -10

# 6. "Bot forgets" — this is usually a session issue, not Telegram
# Each Telegram user gets their own session in sessions.json.
# Check if the session exists:
cat ~/.openclaw/agents/main/sessions/sessions.json | jq -r 'to_entries[] | select(.key | test("telegram")) | "\(.key) | \(.value.origin.label // "?")"'

# 7. Check if compaction happened (context window pruned = "forgot")
SESS_ID="paste-session-id"
grep '"compaction"' ~/.openclaw/agents/main/sessions/$SESS_ID.jsonl | wc -l
# If compaction count > 0, old messages were pruned from context.
# The agent's compaction mode is:
cat ~/.openclaw/openclaw.json | jq '.agents.defaults.compaction'
```

### Telegram config fix template

```bash
# Correct Telegram config structure:
cat ~/.openclaw/openclaw.json | jq '.channels.telegram = {
  "enabled": true,
  "accounts": {
    "coder": {
      "name": "Bot Display Name",
      "enabled": true,
      "botToken": "your-bot-token-here"
    },
    "sales": {
      "name": "Sales Bot Name",
      "enabled": true,
      "botToken": "your-bot-token-here"
    }
  },
  "dmPolicy": "pairing",
  "groupPolicy": "disabled"
}' > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json
```

---

## Troubleshooting: Signal

### "Signal RPC Failed to send message"

This blocks cron jobs and cross-channel notifications.

```bash
# 1. Check if signal-cli process is alive
ps aux | grep "[s]ignal-cli"

# 2. Check the RPC endpoint
grep -i "signal.*starting\|signal.*8080\|signal.*rpc" ~/.openclaw/logs/gateway.log | tail -10
# Should see: "[signal] [default] starting provider (http://127.0.0.1:8080)"

# 3. Check for connection instability
grep -i "HikariPool\|reconnecting\|SSE stream error\|terminated" ~/.openclaw/logs/gateway.err.log | tail -10
# "HikariPool-1 - Thread starvation or clock leap detected" = signal-cli internal DB issue
# "SSE stream error: TypeError: terminated" = lost connection to signal-cli daemon

# 4. Check for rate limiting
grep -i "signal.*rate" ~/.openclaw/logs/gateway.err.log | tail -5
# "Signal RPC -5: Failed to send message due to rate limiting"

# 5. Check for wrong target format
grep -i "unknown target" ~/.openclaw/logs/gateway.err.log | tail -5
# "Unknown target "adi" for Signal. Hint: <E.164|uuid:ID|...>"
# The agent must use phone numbers (+1...) or uuid: format, not names.

# 6. Fix profile name warning spam
grep -c "No profile name set" ~/.openclaw/logs/gateway.err.log
# If high count: run signal-cli updateProfile to set a name

# 7. Test signal-cli directly
ACCT=$(cat ~/.openclaw/openclaw.json | jq -r '.channels.signal.account')
echo "Account: $ACCT"
# signal-cli -a $ACCT send -m "test" +TARGET_NUMBER

# 8. Check if the signal-cli daemon needs restart
# The gateway manages signal-cli as a subprocess.
# Restart the whole gateway: openclaw gateway restart
```

---

## Troubleshooting: Cron Jobs

```bash
# 1. Overview of all jobs
cat ~/.openclaw/cron/jobs.json | jq -r '.jobs[] | "\(.enabled | if . then "ON " else "OFF" end) \(.state.lastStatus // "never" | if . == "error" then "FAIL" elif . == "ok" then "OK  " else .  end) \(.name)"'

# 2. Failing jobs with error details
cat ~/.openclaw/cron/jobs.json | jq '.jobs[] | select(.state.lastStatus == "error") | {name, error: .state.lastError, lastRun: (.state.lastRunAtMs | . / 1000 | todate), id}'

# 3. Read the actual run log for a failing job
JOB_ID="paste-job-uuid-here"
tail -20 ~/.openclaw/cron/runs/$JOB_ID.jsonl | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        obj = json.loads(line)
        if obj.get('type') == 'message':
            role = obj['message']['role']
            text = ''.join(c.get('text','') for c in obj['message'].get('content',[]) if isinstance(c,dict))
            if text.strip():
                print(f'[{role}] {text[:300]}')
    except: pass
"

# 4. Common cron failure causes:
#    - "Signal RPC -1" → Signal daemon down, see Signal section above
#    - "gateway timeout after 10000ms" → gateway was restarting when cron fired
#    - "Brave Search 429" → free tier rate limit hit (2000 req/month)
#    - "embedded run timeout" → job took longer than 600s

# 5. Next scheduled run times
cat ~/.openclaw/cron/jobs.json | jq -r '.jobs[] | select(.enabled) | "\(.name): \((.state.nextRunAtMs // 0) | . / 1000 | todate)"'

# 6. Disable a broken job temporarily
cat ~/.openclaw/cron/jobs.json | jq '(.jobs[] | select(.name == "JOB_NAME")).enabled = false' > /tmp/cron.json && mv /tmp/cron.json ~/.openclaw/cron/jobs.json
```

---

## Troubleshooting: Memory / "It Forgot"

The memory system has 3 layers. When the agent "forgets," one of these broke:

### Layer 1: Context window (within a session)

```bash
# Check compaction count for a session (compaction = old messages pruned)
grep -c '"compaction"' ~/.openclaw/agents/main/sessions/SESSION_ID.jsonl
# 7 compactions = the agent has "forgotten" its earliest messages 7 times.

# Check compaction mode
cat ~/.openclaw/openclaw.json | jq '.agents.defaults.compaction'
# "safeguard" = only compacts when hitting context limit
```

### Layer 2: Workspace memory files

```bash
# What daily memory files exist
ls -la ~/.openclaw/workspace/memory/

# What's in MEMORY.md (long-term curated)
cat ~/.openclaw/workspace/MEMORY.md

# Search memory files for something specific
grep -ri "KEYWORD" ~/.openclaw/workspace/memory/
```

### Layer 3: Vector memory database (SQLite + Gemini embeddings)

```bash
# What files are indexed
sqlite3 ~/.openclaw/memory/main.sqlite "SELECT path, size, datetime(mtime/1000, 'unixepoch') as modified FROM files;"

# How many chunks (text fragments) exist
sqlite3 ~/.openclaw/memory/main.sqlite "SELECT COUNT(*) FROM chunks;"

# Search chunks by text (FTS5 full-text search)
sqlite3 ~/.openclaw/memory/main.sqlite "SELECT substr(text, 1, 200) FROM chunks_fts WHERE chunks_fts MATCH 'KEYWORD' LIMIT 5;"

# Check embedding config
sqlite3 ~/.openclaw/memory/main.sqlite "SELECT value FROM meta WHERE key='memory_index_meta_v1';" | python3 -m json.tool

# Check for Gemini embedding rate limits (breaks indexing)
grep -i "gemini.*batch.*failed\|RESOURCE_EXHAUSTED\|429" ~/.openclaw/logs/gateway.err.log | tail -10
# "embeddings: gemini batch failed (2/2); disabling batch" = indexing degraded

# Rebuild memory index (re-index all workspace files)
# Delete the DB and restart gateway — it will rebuild:
# rm ~/.openclaw/memory/main.sqlite && openclaw gateway restart
```

---

## Searching Sessions

### Find a person's conversations

```bash
# Search session index by name (case-insensitive)
cat ~/.openclaw/agents/main/sessions/sessions.json | jq -r 'to_entries[] | select(.value.origin.label // "" | test("NAME"; "i")) | "\(.value.sessionId) | \(.value.lastChannel) | \(.value.origin.label)"'
```

### Find sessions by channel

```bash
cat ~/.openclaw/agents/main/sessions/sessions.json | jq -r 'to_entries[] | select(.value.lastChannel == "whatsapp") | "\(.value.sessionId) | \(.value.origin.label // .key)"'
# Replace "whatsapp" with: signal, telegram, or check .key for cron sessions
```

### Most recent sessions

```bash
cat ~/.openclaw/agents/main/sessions/sessions.json | jq -r '[to_entries[] | {id: .value.sessionId, updated: .value.updatedAt, label: (.value.origin.label // .key), ch: (.value.lastChannel // "cron")}] | sort_by(.updated) | reverse | .[:10][] | "\(.updated | . / 1000 | todate) | \(.ch) | \(.label)"'
```

### Search message content across all sessions

```bash
# Quick: find which session files contain a keyword
grep -l "KEYWORD" ~/.openclaw/agents/main/sessions/*.jsonl

# Detailed: show matching messages with timestamps
grep "KEYWORD" ~/.openclaw/agents/main/sessions/*.jsonl | python3 -c "
import sys, json
for line in sys.stdin:
    path, data = line.split(':', 1)
    try:
        obj = json.loads(data)
        if obj.get('type') == 'message':
            role = obj['message']['role']
            text = ''.join(c.get('text','') for c in obj['message'].get('content',[]) if isinstance(c,dict))
            if text.strip():
                sid = path.split('/')[-1].replace('.jsonl','')[:8]
                ts = obj.get('timestamp','')[:19]
                print(f'{ts} [{sid}] [{role}] {text[:200]}')
    except: pass
" | head -30
```

### Read a specific session transcript

```bash
# Last 30 messages from a session
tail -50 ~/.openclaw/agents/main/sessions/SESSION_ID.jsonl | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        obj = json.loads(line)
        if obj.get('type') == 'message':
            role = obj['message']['role']
            text = ''.join(c.get('text','') for c in obj['message'].get('content',[]) if isinstance(c,dict))
            if text.strip() and role != 'toolResult':
                print(f'[{role}] {text[:300]}')
                print()
    except: pass
"
```

---

## Config Editing

### Safe edit pattern

Always: backup, edit with jq, restart.

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak.manual
jq 'YOUR_EDIT_HERE' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json
openclaw gateway restart
```

### Common edits

```bash
# Switch WhatsApp to allowlist
jq '.channels.whatsapp.dmPolicy = "allowlist" | .channels.whatsapp.allowFrom = ["+1XXXXXXXXXX"]' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# Enable WhatsApp autopilot (bot responds as you to everyone)
jq '.channels.whatsapp += {dmPolicy: "open", selfChatMode: false, allowFrom: ["*"]}' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# Add number to Signal allowlist
jq '.channels.signal.allowFrom += ["+1XXXXXXXXXX"]' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# Change model
jq '.agents.defaults.models = {"anthropic/claude-sonnet-4": {"alias": "sonnet"}}' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# Set concurrency
jq '.agents.defaults.maxConcurrent = 10 | .agents.defaults.subagents.maxConcurrent = 10' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# Disable a plugin
jq '.plugins.entries.imessage.enabled = false' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json
```

### Restore from backup

```bash
# Latest backup
cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json

# List all backups by date
ls -lt ~/.openclaw/openclaw.json.bak*

# Validate JSON before restart
python3 -m json.tool ~/.openclaw/openclaw.json > /dev/null && echo "OK" || echo "BROKEN"

# Nuclear reset
openclaw configure
```

---

## Channel Security Modes

| Mode | Behavior | Risk |
|---|---|---|
| `open` + `allowFrom: ["*"]` | Anyone can message, bot responds to all | HIGH — burns API credits, bot speaks as you |
| `allowlist` + `allowFrom: ["+1..."]` | Only listed numbers get through | LOW — explicit control |
| `pairing` | Unknown senders get a code, you approve | LOW — approval gate |
| `disabled` | Channel completely off | NONE |

### Check current security posture

```bash
cat ~/.openclaw/openclaw.json | jq '{
  whatsapp: {policy: .channels.whatsapp.dmPolicy, from: .channels.whatsapp.allowFrom, groups: .channels.whatsapp.groupPolicy, selfChat: .channels.whatsapp.selfChatMode},
  signal: {policy: .channels.signal.dmPolicy, from: .channels.signal.allowFrom, groups: .channels.signal.groupPolicy},
  telegram: {policy: .channels.telegram.dmPolicy, groups: .channels.telegram.groupPolicy, bots: [.channels.telegram.accounts | to_entries[] | "\(.key)=\(.value.enabled)"]},
  imessage: {enabled: .channels.imessage.enabled, policy: .channels.imessage.dmPolicy}
}'
```

---

## Workspace Files

| File | What | When to edit |
|---|---|---|
| `SOUL.md` | Personality: tone, style ("no em dashes, lowercase casual") | To change how the bot talks |
| `IDENTITY.md` | Name (Jarvis), creature type, emoji | To rebrand |
| `USER.md` | Owner info, preferences | When user context changes |
| `AGENTS.md` | Operating rules: memory protocol, safety, group chat behavior, heartbeat instructions | To change bot behavior |
| `BOOT.md` | Startup instructions (autopilot notification protocol: WA → Signal) | To change what happens on boot |
| `HEARTBEAT.md` | Periodic checklist (empty = no heartbeat API calls) | To add/remove periodic tasks |
| `MEMORY.md` | Curated long-term memory (loaded only in main/direct sessions) | Bot manages this itself |
| `TOOLS.md` | Contacts, SSH hosts, device nicknames | To add local tool notes |
| `memory/*.md` | Daily raw logs, topic-specific chat logs | Bot writes automatically |

---

## Session JSONL Format

Each `.jsonl` file has one JSON object per line. Types:

| type | What |
|---|---|
| `session` | Session header: id, timestamp, cwd |
| `message` | Conversation turn: role (user/assistant/toolResult), content, model, usage |
| `custom` | Metadata: `model-snapshot`, `openclaw.cache-ttl` |
| `compaction` | Context window was pruned (old messages dropped) |
| `model_change` | Model was switched mid-session |
| `thinking_level_change` | Thinking level adjusted |

Session index (`sessions.json`) keys:
- Pattern: `agent:main:{channel}:{contact}` or `agent:main:cron:{job-uuid}`
- Fields: `sessionId` (UUID = filename), `lastChannel`, `origin.label` (human name), `origin.from` (canonical address), `updatedAt` (epoch ms), `chatType` (direct/group)

---

## Gateway Startup Sequence

Normal startup takes ~3 seconds:
```
[heartbeat] started
[gateway] listening on ws://127.0.0.1:18789
[browser/service] Browser control service ready
[hooks] loaded 3 internal hook handlers (boot-md, command-logger, session-memory)
[whatsapp] [default] starting provider
[signal] [default] starting provider (http://127.0.0.1:8080)
[telegram] [coder] starting provider
[telegram] [sales] starting provider
[whatsapp] Listening for personal WhatsApp inbound messages.
[signal] signal-cli: Started HTTP server on /127.0.0.1:8080
```

If any line is missing, that component failed to start. Check `gateway.err.log`.

---

## Known Error Patterns

| Error | Meaning | Fix |
|---|---|---|
| `Web connection closed (status 408)` | WhatsApp web timeout, auto-retries up to 12x | Usually self-heals. If reaches 12/12, restart gateway |
| `Signal RPC -1: Failed to send message` | signal-cli daemon lost connection | Restart gateway |
| `Signal RPC -5: Failed to send message due to rate limiting` | Signal rate limit | Wait and retry, reduce message frequency |
| `No profile name set` (signal-cli WARN) | Floods logs, harmless | `signal-cli -a +ACCOUNT updateProfile --given-name "Name"` |
| `Cross-context messaging denied` | Agent tried to send across channels | Not a bug — security guardrail. Message must originate from correct channel session |
| `getUpdates timed out after 500 seconds` | Telegram bot lost polling connection | Restart gateway |
| `Unrecognized keys: "token", "username"` | Wrong config keys for Telegram bots | Use `botToken` not `token` in openclaw.json |
| `RESOURCE_EXHAUSTED` (Gemini 429) | Embedding rate limit | Reduce workspace file churn, or upgrade Gemini quota |
| `lane wait exceeded` | Agent blocked on long LLM call | Wait, or restart if stuck > 2 min |
| `embedded run timeout: timeoutMs=600000` | Agent response exceeded 10 min | Break task into smaller pieces |
| `gateway timeout after 10000ms` | Gateway unreachable during restart window | Cron fired while gateway was down — transient |

---

## Extending OpenClaw

OpenClaw has 4 extension layers. Each solves a different problem:

| Layer | What | Where | How to add |
|---|---|---|---|
| **Skills** | Knowledge + workflows the agent loads on demand | `/opt/homebrew/lib/node_modules/openclaw/skills/` or `~/.openclaw/workspace/skills/` | `clawdhub install <slug>` or `npx add-skill <repo>` |
| **Extensions** | Custom channel plugins (TypeScript) | `~/.openclaw/extensions/{name}/` | Create `openclaw.plugin.json` + TypeScript source |
| **Channels** | Messaging platforms (built-in) | `openclaw.json → channels.*` + `plugins.entries.*` | Configure in openclaw.json, add credentials |
| **Cron jobs** | Scheduled autonomous tasks | `~/.openclaw/cron/jobs.json` | Agent creates them via tool, or edit jobs.json directly |

### Skills: ClawdHub Ecosystem

Skills are the primary way to extend what the agent knows and can do. They're markdown files with optional scripts/assets that get loaded into context when relevant.

```bash
# Search for skills (vector search across the registry)
clawdhub search "postgres optimization"
clawdhub search "image generation"

# Browse latest skills
clawdhub explore

# Install a skill
clawdhub install supabase-postgres-best-practices
clawdhub install nano-banana-pro

# Install a specific version
clawdhub install my-skill --version 1.2.3

# List what's installed
clawdhub list

# Update all installed skills
clawdhub update --all

# Update a specific skill
clawdhub update my-skill
clawdhub update my-skill --force  # overwrite local changes
```

**Currently installed skills (bundled with OpenClaw):**

| Category | Skills |
|---|---|
| **Messaging** | discord, slack, imsg, wacli, voice-call |
| **Social/Web** | bird (X/Twitter), blogwatcher, github, trello, notion |
| **Google** | gog, google-workspace-mcp, goplaces, local-places |
| **Media** | nano-banana-pro (Gemini image gen), openai-image-gen, video-frames, gifgrep, pixelation, sag (TTS), openai-whisper, sherpa-onnx-tts, songsee, camsnap |
| **Coding agents** | coding-agent (Codex/Claude Code/Pi), ccbg (background runner), tmux |
| **Productivity** | apple-notes, apple-reminders, bear-notes, things-mac, obsidian, himalaya (email) |
| **Smart home** | openhue (Philips Hue), eightctl (Eight Sleep), sonoscli, blucli (BluOS) |
| **Dev tools** | github, worktree, starter, desktop, supabase-postgres-best-practices, superdesign |
| **Content** | remotion-best-practices, remotion-fastest-tech-stack, humanizer, summarize, market, buildinpublic |
| **Meta** | skill-creator, clawdhub, find-skills, add-skill, model-usage, session-logs, recentplans, canvas |

### Creating Your Own Skill

A skill is just a folder with a `SKILL.md`:

```
my-skill/
├── SKILL.md              # Required: YAML frontmatter + markdown instructions
├── scripts/              # Optional: executable scripts
├── references/           # Optional: docs loaded on demand
└── assets/               # Optional: templates, images
```

**SKILL.md format:**
```markdown
---
name: my-skill
description: What this does and WHEN to trigger it. The description is the primary
  trigger — the agent reads this to decide whether to load the full skill.
---

# My Skill

Instructions go here. Only loaded AFTER the skill triggers.
Keep under 500 lines. Split large content into references/ files.
```

**Key principle: the context window is a shared resource.** Only include what the agent doesn't already know. Prefer concise examples over verbose explanations.

```bash
# Publish to ClawdHub
clawdhub login
clawdhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0

# Or publish to GitHub for npx add-skill
# (see add-skill skill for details)
```

### Multi-Agent Orchestration

OpenClaw can spawn other AI agents (Codex, Claude Code, Pi) as background workers. This is how you run parallel coding tasks, reviews, or any work that benefits from multiple agents.

**The pattern:** `bash pty:true background:true workdir:/path command:"agent 'task'"`

```bash
# Spawn Codex to build something (background, auto-approve)
bash pty:true workdir:~/project background:true command:"codex exec --full-auto 'Build a REST API for todos'"
# Returns sessionId for tracking

# Spawn Claude Code on a different task
bash pty:true workdir:~/other-project background:true command:"claude 'Refactor the auth module'"

# Monitor all running agents
process action:list

# Check output of a specific agent
process action:log sessionId:XXX

# Send input if agent asks a question
process action:submit sessionId:XXX data:"yes"

# Kill a stuck agent
process action:kill sessionId:XXX
```

**Parallel PR reviews:**
```bash
# Fetch all PR refs
git fetch origin '+refs/pull/*/head:refs/remotes/origin/pr/*'

# Launch one agent per PR
bash pty:true workdir:~/project background:true command:"codex exec 'Review PR #86. git diff origin/main...origin/pr/86'"
bash pty:true workdir:~/project background:true command:"codex exec 'Review PR #87. git diff origin/main...origin/pr/87'"
```

**Parallel issue fixing with git worktrees:**
```bash
git worktree add -b fix/issue-78 /tmp/issue-78 main
git worktree add -b fix/issue-99 /tmp/issue-99 main

bash pty:true workdir:/tmp/issue-78 background:true command:"codex --yolo 'Fix issue #78: description. Commit and push.'"
bash pty:true workdir:/tmp/issue-99 background:true command:"codex --yolo 'Fix issue #99: description. Commit and push.'"
```

**Auto-notify when agent finishes:**
```bash
bash pty:true workdir:~/project background:true command:"codex --yolo exec 'Your task.

When completely finished, run: openclaw gateway wake --text \"Done: summary\" --mode now'"
```

### Adding a New Channel

Channels are messaging platforms the agent can communicate through. Built-in: WhatsApp, Signal, Telegram, iMessage, Discord, Slack.

**Enable a built-in channel:**
```bash
# 1. Enable the plugin
jq '.plugins.entries.discord.enabled = true' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# 2. Add channel config
jq '.channels.discord = {enabled: true, dmPolicy: "pairing", groupPolicy: "disabled"}' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# 3. Add credentials (channel-specific)
# 4. Restart gateway
openclaw gateway restart
```

**Build a custom channel extension:**

```
~/.openclaw/extensions/{name}/
├── openclaw.plugin.json    # {"id": "name", "channels": ["name"], "configSchema": {...}}
├── package.json            # Standard npm package
├── index.ts                # Entry point
└── src/
    ├── channel.ts          # Inbound message handling + outbound send
    ├── actions.ts          # Tool actions the agent can invoke
    ├── runtime.ts          # Lifecycle: start, stop, health check
    ├── config-schema.ts    # JSON schema for plugin config
    └── types.ts            # TypeScript types
```

```bash
# List installed extensions
ls ~/.openclaw/extensions/

# View extension manifests
cat ~/.openclaw/extensions/*/openclaw.plugin.json | jq .

# Check extension source files
find ~/.openclaw/extensions/ -name "*.ts" -not -path "*/node_modules/*"
```

### Cross-Channel Communication

The agent can receive on one channel and send on another, but there are guardrails:

```bash
# Check cross-context settings
cat ~/.openclaw/openclaw.json | jq '.tools.message.crossContext'
# allowAcrossProviders: true = agent CAN send across channels
# marker.enabled: false = no "[via Signal]" prefix on cross-channel messages

# If you see "Cross-context messaging denied" errors:
# The agent tried to send from a session bound to channel A to channel B.
# This is a security feature. To allow it:
jq '.tools.message.crossContext.allowAcrossProviders = true' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json
```

**BOOT.md notification protocol** (already configured):
The agent receives WhatsApp messages, responds on WhatsApp, then sends a notification summary to Signal. This is the primary cross-channel pattern — autopilot on one channel, control center on another.

### Canvas: Web UI for Connected Devices

Push HTML/games/dashboards to connected Mac/iOS/Android nodes:

```bash
# Check canvas config
cat ~/.openclaw/openclaw.json | jq '.canvasHost // "not configured"'

# List connected nodes
openclaw nodes list

# Present HTML content on a node
# canvas action:present node:<node-id> target:http://localhost:18793/__moltbot__/canvas/my-page.html

# Canvas files live in:
ls ~/.openclaw/canvas/
```

### Voice Calls

Initiate phone calls via Twilio/Telnyx/Plivo:

```bash
# Check if voice-call plugin is enabled
cat ~/.openclaw/openclaw.json | jq '.plugins.entries["voice-call"] // "not configured"'

# CLI usage
openclaw voicecall call --to "+15555550123" --message "Hello"
openclaw voicecall status --call-id <id>
```

### Cron: Scheduled Autonomous Tasks

```bash
# View all jobs
cat ~/.openclaw/cron/jobs.json | jq '.jobs[] | {name, enabled, schedule: .schedule, channel: .payload.channel, to: .payload.to}'

# Job schedule types:
# "kind": "at", "atMs": <epoch>          — one-shot at specific time
# "kind": "every", "everyMs": <ms>       — recurring interval

# Job delivery targets:
# channel + to fields determine where results go (signal, whatsapp, telegram)
# sessionTarget: "isolated" = fresh context each run (no memory of previous runs)

# To add a job, the agent creates it via tool, or edit jobs.json:
# See existing jobs as templates in ~/.openclaw/cron/jobs.json
```

---

---

## WebSocket RPC API

Gateway WebSocket'e doğrudan bağlanarak tüm operasyonları yönetebilirsin.

**Bağlantı:** `ws://127.0.0.1:18789` (varsayılan port)
**Auth:** `operator` veya `node` rolü gerekir.

### Frame Tipleri

```typescript
// Client → Server
RequestFrame  { id, method, params }

// Server → Client (cevap)
ResponseFrame { id, result | error }

// Server → Client (push notification)
EventFrame    { event, data }
```

### RPC Namespace Özeti

| Namespace | Metod | Ne Yapar |
|---|---|---|
| `agent.*` | `agent.run`, `agent.identity`, `agent.wait` | Agent çalıştırma |
| `chat.*` | `chat.history`, `chat.send`, `chat.abort`, `chat.inject` | Konuşma yönetimi |
| `sessions.*` | `sessions.list`, `sessions.patch`, `sessions.reset`, `sessions.delete` | Session CRUD |
| `cron.*` | `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.list`, `cron.runs.read` | Zamanlanmış görevler |
| `config.*` | `config.get`, `config.apply`, `config.patch` | Config yönetimi |
| `nodes.*` | `nodes.status`, `nodes.invoke` | iOS/macOS/Android node'ları |
| `mesh.*` | — | Multi-gateway routing |

### Önemli RPC Örnekleri

```bash
# WebSocket üzerinden config patch (örnek curl WebSocket değil, jq ile göster)
# Gerçekte openclaw CLI üzerinden veya Control UI üzerinden yapılır.

# Config'i oku
openclaw config get

# Config patch (JSON merge patch)
openclaw config patch '{"agents":{"defaults":{"maxConcurrent":10}}}'

# Session listesi
openclaw sessions list

# Belirli bir session'ı sıfırla
openclaw sessions reset agent:main:whatsapp:+1234567890

# Cron job ekle
openclaw cron add --name "daily-report" --schedule '{"kind":"cron","expr":"0 9 * * *"}' \
  --message "Günlük rapor hazırla ve Signal'den gönder"

# Cron job zorla çalıştır
openclaw cron run <job-id>

# Chat geçmişini oku
openclaw chat history agent:main:telegram:12345
```

---

## Config Hot-Reload

`openclaw.json` değiştiğinde gateway otomatik uygular.

```bash
# Reload modu kontrol
cat ~/.openclaw/openclaw.json | jq '.gateway.reload.mode'
# "hybrid" (varsayılan): channel/agent değişiklikleri hot-apply, port/TLS → restart
# "hot": sadece güvenli değişiklikler
# "restart": her değişiklikte restart
# "off": izleme kapalı

# Config'i validate et (restart olmadan)
python3 -m json.tool ~/.openclaw/openclaw.json > /dev/null && echo "JSON: OK"

# Env var referansı (config içinde)
# "${ANTHROPIC_API_KEY}" → .env'den okur
# SecretRef ile hassas değerleri inline tutma

# $include ile config split
# openclaw.json içinde: "$include": "./channels.json5"
# Büyük config'leri modüler tut
```

---

## Config Reference: Önemli Alanlar

```jsonc
{
  "gateway": {
    "port": 18789,
    "reload": { "mode": "hybrid" }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-6",
        "fallbacks": ["anthropic/claude-haiku-4-5"]
      },
      "maxConcurrent": 5,
      "subagents": { "maxConcurrent": 10 },
      "compaction": "safeguard",
      "sandbox": { "mode": "non-main" },
      "workspace": "~/.openclaw/workspace"
    },
    "list": [
      {
        "id": "main",
        "workspace": "~/.openclaw/workspace"
      },
      {
        "id": "sales-agent",
        "workspace": "~/.openclaw/workspace-sales"
      }
    ]
  },
  "session": {
    "reset": { "mode": "daily" }
    // "mode": "daily" | "idle" | "none"
    // idle: { "mode": "idle", "idleMinutes": 60 }
  }
}
```

---

## Multi-Agent Mimarisi

OpenClaw'da multi-agent iki farklı şekilde çalışır:

### Tip 1: Birden Fazla Named Agent (config'den)

Her agent kendi workspace'i, modeli ve session'larıyla izole çalışır.

```bash
# config'de birden fazla agent tanımla
cat ~/.openclaw/openclaw.json | jq '.agents.list'

# Her agent'ın kendi workspace dizini olur:
ls ~/.openclaw/workspace-sales/
# SOUL.md, IDENTITY.md, AGENTS.md, MEMORY.md ...

# Belirli bir agent'ın session'larını gör
cat ~/.openclaw/agents/sales-agent/sessions/sessions.json | jq 'keys'

# Agent session key formatı:
# agent:{agentId}:{channel}:{contact}
# agent:main:whatsapp:+90500123
# agent:sales-agent:telegram:987654
```

### Tip 2: Subagent Spawning (runtime)

Ana agent, görev delegasyonu için yeni agent instance'ları spawn eder.

```bash
# Agent, bash tool ile subagent spawn eder:
# bash pty:true workdir:~/project background:true command:"claude 'task'"
# bash pty:true workdir:~/project background:true command:"codex --yolo 'task'"

# Çalışan tüm subagent'ları izle
process action:list

# Belirli subagent'ın çıktısını oku
process action:log sessionId:XXX

# Input gönder (agent soru sorduysa)
process action:submit sessionId:XXX data:"yes"

# Stuck agent'ı kill et
process action:kill sessionId:XXX

# Subagent run log
cat ~/.openclaw/subagents/runs.json | jq '.[-5:]'
```

### Tip 3: Discord Thread Bindings

Discord'da her thread ayrı bir agent session'ına bağlanır.

```bash
# Thread binding config
cat ~/.openclaw/openclaw.json | jq '.channels.discord.threadBindings'
# enabled: true → subagent'lar doğrudan thread'e post edebilir
```

### Paralel Görev Örüntüleri

```bash
# Paralel PR review (birden fazla subagent)
git fetch origin '+refs/pull/*/head:refs/remotes/origin/pr/*'
bash pty:true workdir:~/project background:true command:"codex exec 'Review PR #86. git diff origin/main...origin/pr/86'"
bash pty:true workdir:~/project background:true command:"codex exec 'Review PR #87. git diff origin/main...origin/pr/87'"

# Paralel fix (git worktree ile izole)
git worktree add -b fix/issue-78 /tmp/issue-78 main
git worktree add -b fix/issue-99 /tmp/issue-99 main
bash pty:true workdir:/tmp/issue-78 background:true command:"codex --yolo 'Fix issue #78. Commit and push.'"
bash pty:true workdir:/tmp/issue-99 background:true command:"codex --yolo 'Fix issue #99. Commit and push.'"

# Bitince bildir
bash pty:true workdir:~/project background:true command:"claude 'task here.
When done: openclaw gateway wake --text \"Done\" --mode now'"
```

---

## WhatsApp Yönetimi (Detaylı)

WhatsApp, Baileys SDK üzerinden WebSocket bağlantısı kurar.

```bash
# Bağlantı durumu
grep -i "whatsapp.*listening\|whatsapp.*starting\|whatsapp.*connected" ~/.openclaw/logs/gateway.log | tail -5

# Tüm WhatsApp config
cat ~/.openclaw/openclaw.json | jq '.channels.whatsapp'

# WhatsApp için full config şablonu:
cat ~/.openclaw/openclaw.json | jq '.channels.whatsapp = {
  "enabled": true,
  "dmPolicy": "pairing",
  "groupPolicy": "disabled",
  "allowFrom": [],
  "selfChatMode": false,
  "textChunkLimit": 4096,
  "streaming": "off",
  "requireMention": false
}' > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# Credential dosyaları (Baileys session)
# ~1400 app-state-sync-key-*.json = normal, tam pair
ls ~/.openclaw/credentials/whatsapp/default/ | wc -l

# Yeni pairing başlat (QR kodu ile)
openclaw configure
# veya telefon numarası ile (QR'sız):
# openclaw configure --phone +90500XXXXXXX

# WhatsApp'ı tamamen sıfırla
# ⚠️ DESTRUCTIVE: tüm WhatsApp session silinir, yeniden pair gerekir
# rm -rf ~/.openclaw/credentials/whatsapp/default/
# openclaw configure

# Grup mesajlarını aç (dikkatli — token tüketir)
jq '.channels.whatsapp.groupPolicy = "open"' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# Gruba izin ver (allowlist modunda)
jq '.channels.whatsapp.groupAllowFrom += ["120363XXXXXXXXXX@g.us"]' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# Bot'un kendi numarasından mesaj göndermesini engelle
jq '.channels.whatsapp.selfChatMode = false' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# Typing indicator ayarı
jq '.channels.whatsapp.typingIndicator = true' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json

# ACK reaction (mesaj geldiğinde emoji ile onay)
jq '.channels.whatsapp.ackReaction = "👍"' ~/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json ~/.openclaw/openclaw.json
```

### WhatsApp Bağlantı Döngüsü

```
408 timeout → retry 1/12 → ... → retry 12/12 → tam kopuş
Normal: 408 oluşur ama auto-recover olur
Kritik: 12/12 → gateway restart gerekir
```

```bash
# Retry sayısını izle
grep "Retry [0-9]*/12" ~/.openclaw/logs/gateway.err.log | tail -5

# 12/12 durumunda:
openclaw gateway restart
```

---

## Session Yönetimi (Detaylı)

### Session Key Formatı

```
agent:{agentId}:{channel}:{contact}
agent:main:whatsapp:+905001234567
agent:main:telegram:123456789
agent:main:signal:+905001234567
agent:main:discord:channel:987654321
agent:main:cron:{job-uuid}
```

### Session Metadata Alanları

- `sessionId` — UUID (JSONL dosya adı)
- `updatedAt` — epoch ms
- `totalTokens` — birikmiş token sayısı
- `model` / `modelProvider` — kullanılan model
- `label` — atanan isim
- `forkedFromParent` — parent session'dan fork mu

### Session CRUD

```bash
# CLI ile session listesi
openclaw sessions list

# Belirli agent'ın session'ları
openclaw sessions list --agent sales-agent

# Session'ı reset et (konuşma sıfırlanır, eski transcript .reset.{ts} olarak arşivlenir)
openclaw sessions reset agent:main:whatsapp:+905001234567

# Session'ı sil (transcript da silinir)
openclaw sessions delete agent:main:telegram:123456789

# Session'a label ekle
openclaw sessions patch agent:main:whatsapp:+905001234567 --label "VIP Müşteri"

# Auto-reset politikası
cat ~/.openclaw/openclaw.json | jq '.session.reset'
# daily: her gün 04:00'da sıfırla
# idle: N dakika hareketsizlikte sıfırla
# none: hiç sıfırlama
```

---

## Cron Job Yönetimi (RPC ile)

```bash
# Tüm job'ları listele
openclaw cron list

# Job ekle — scheduled
openclaw cron add \
  --name "morning-briefing" \
  --schedule '{"kind":"cron","expr":"0 8 * * 1-5","timezone":"Europe/Istanbul"}' \
  --message "Günlük brifing hazırla" \
  --session-target "isolated" \
  --delivery "announce" \
  --channel "signal" \
  --to "+905001234567"

# Job ekle — interval
openclaw cron add \
  --name "health-check" \
  --schedule '{"kind":"every","everyMs":3600000}' \
  --message "Sistem sağlık kontrolü yap"

# Job ekle — one-shot
openclaw cron add \
  --name "deploy-reminder" \
  --schedule '{"kind":"at","atMs":1735689600000}' \
  --message "Bugün deployment var, hazırlıkları kontrol et"

# Job zorla çalıştır
openclaw cron run <job-id>

# Job güncelle
openclaw cron update <job-id> --enabled false

# Job sil
openclaw cron remove <job-id>

# Job çalışma geçmişi
openclaw cron runs read <job-id> --limit 10
```

### Cron sessionTarget Seçenekleri

| Değer | Davranış |
|---|---|
| `main` | Mevcut session'a inject eder |
| `isolated` | Her çalışmada temiz context (önceki çalışmaları hatırlamaz) |

### Cron delivery Seçenekleri

| Değer | Davranış |
|---|---|
| `none` | Sonuç iletilmez |
| `announce` | `channel` + `to` hedefine gönderilir |
| `webhook` | Belirtilen URL'ye POST |

---

## Tüm Kanal Yapılandırması

OpenClaw 15+ kanal destekler:

| Kanal | Tip | Notlar |
|---|---|---|
| WhatsApp | Core | Baileys SDK, ~1400 credential dosyası |
| Telegram | Core | grammY, multi-bot, long polling veya webhook |
| Discord | Core | @buape/carbon, slash commands, thread bindings |
| Slack | Core | Socket Mode veya HTTP |
| Signal | Core | signal-cli JSON-RPC, lokal daemon |
| iMessage | Core | Sadece macOS |
| Matrix | Extension | |
| Feishu | Extension | |
| MS Teams | Extension | |
| Google Chat | Extension | |
| Zalo | Extension | |
| IRC | Extension | |
| Mattermost | Extension | |

```bash
# Aktif kanalları gör
cat ~/.openclaw/openclaw.json | jq '{
  whatsapp: .channels.whatsapp.enabled,
  telegram: .channels.telegram.enabled,
  discord: .channels.discord.enabled,
  slack: .channels.slack.enabled,
  signal: .channels.signal.enabled
}'

# Discord multi-bot örneği
cat ~/.openclaw/openclaw.json | jq '.channels.discord = {
  "enabled": true,
  "accounts": {
    "main-bot": {
      "token": "${DISCORD_BOT_TOKEN}",
      "enabled": true
    }
  },
  "dmPolicy": "pairing",
  "groupPolicy": "disabled",
  "streaming": "partial",
  "threadBindings": { "enabled": true }
}'

# Slack Socket Mode
cat ~/.openclaw/openclaw.json | jq '.channels.slack = {
  "enabled": true,
  "accounts": {
    "workspace": {
      "appToken": "${SLACK_APP_TOKEN}",
      "botToken": "${SLACK_BOT_TOKEN}",
      "enabled": true
    }
  },
  "dmPolicy": "pairing"
}'
```

---

## Management UI Yapısı (ClawPal Referansı)

OpenClaw için web/desktop management UI yaparken şu API'leri kullan:

### Bağlantı

```typescript
// WebSocket RPC — ws://VPS_IP:18789
const ws = new WebSocket('ws://127.0.0.1:18789')

// HTTP endpoints
// POST /tools/invoke  — external tool çağrısı
// GET  /             — Control UI (LitElement, Vite)
// OpenAI-compatible API — model proxy olarak

// Auth
// operator role → full control
// node role → device capability provider
```

### UI Bölümleri ve Karşılık Gelen RPC

| UI Bölümü | RPC Metod | Açıklama |
|---|---|---|
| Dashboard | `sessions.list`, `agent.identity` | Aktif session'lar, agent durumu |
| Chat | `chat.history`, `chat.send`, `chat.abort`, `chat.inject` | Konuşmaları yönet/izle |
| Sessions | `sessions.list`, `sessions.patch`, `sessions.reset`, `sessions.delete` | Session CRUD |
| Config Editor | `config.get`, `config.apply`, `config.patch` | openclaw.json düzenle |
| Cron | `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run` | Job yönetimi |
| Nodes | `nodes.status`, `nodes.invoke` | iOS/macOS/Android cihazlar |
| Logs | SSH ile `tail -f ~/.openclaw/logs/gateway.log` | Canlı log akışı |
| Memory | SQLite sorguları | Bellek içeriği |

### Tech Stack Önerileri (ClawPal + tenacitOS'tan)

```
Frontend:  React + TypeScript + Tailwind + Radix UI
Backend:   Next.js API routes veya Tauri (desktop için)
Transport: WebSocket (RPC) + SSH tüneli (remote VPS için)
Auth:      operator keypair ile WS auth
```

### Remote VPS Yönetimi

```bash
# SSH tüneli açarak local'den gateway'e bağlan
ssh -L 18789:127.0.0.1:18789 <vps-alias> -N &

# Artık ws://127.0.0.1:18789 lokal gibi çalışır
# UI bu adrese bağlanır
```

### Exec Approvals UI

```bash
# exec-approvals.json — hangi komutlar onay ister
cat ~/.openclaw/exec-approvals.json

# Onay bekleyen komutları gör (Control UI üzerinden veya terminal)
openclaw approvals list

# Onayla
openclaw approvals approve <approval-id>

# Reddet
openclaw approvals deny <approval-id>
```

---

## OpenAI-Compatible API

OpenClaw, OpenAI API formatında endpoint sunar — başka tool'larla entegrasyon için.

```bash
# Base URL: http://127.0.0.1:18789
# Endpoint: /v1/chat/completions (OpenAI uyumlu)

# Test et
curl http://127.0.0.1:18789/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "main",
    "messages": [{"role": "user", "content": "Merhaba"}]
  }'
```

---

## License

MIT

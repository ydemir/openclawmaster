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
5) NotebookLM'e [TAMAMLANDI] notu yazıldı
6) 3+ dosya değiştiyse repomix sync yapıldı

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
- repomix installed globally: `npm install -g repomix`

## NotebookLM + Repomix Protokolü (ZORUNLU — İSTİSNASIZ UYGULANIR)

### SESSION BAŞLANGICI — Her Zaman
Kullanıcı ilk mesajı gönderdiğinde, herhangi bir iş yapmadan önce:
1. `docs/notebooklm-notebook-id.txt` dosyasını oku → notebook ID'yi al
2. `notebook_query` ile şunu sor: "projenin mevcut durumu, son tamamlanan işler ve açık görevler neler?"
3. Sonucu kullanıcıya özetle — "Geçen seferden: ..."

### PROMPT / GÖREV AKIŞI

**Görev başlamadan önce:**
- Konuyla ilgili geçmiş var mı? → `notebook_query` ile sorgula
- Daha önce aynı hata yaşandı mı? → `notebook_query "bu hata daha önce yaşandı mı"`
- Benzer bir karar alındı mı? → `notebook_query` ile kontrol et

**Görev tamamlandıktan sonra — SORMADAN yap:**
- `note` ile [TAMAMLANDI] notu ekle
- 3+ dosya değiştiyse → Repomix sync yap (aşağıya bak)

### HATA YÖNETİMİ AKIŞI

**Hata ilk karşılaşıldığında:**
1. **DEBUG notebook'unu** sorgula: `notebook_query "bu hata daha önce yaşandı mı: {hata mesajı}"`
2. Geçmişte çözüm varsa → direkt uygula, zaman kaybetme
3. Geçmişte yoksa → araştır ve çöz

**Hata çözüldükten sonra — SORMADAN yap:**
1. `note` ile **DEBUG notebook'una** [BUG-COZUM] notu ekle:
   - Hata ne idi
   - Neden oldu (kök neden)
   - Nasıl çözüldü
   - Tekrar olmaması için ne yapıldı
2. Eğer 3+ dosya değiştiyse → Repomix sync yap

### REPOMIX SYNC — Ne Zaman (ZORUNLU)
Aşağıdaki durumlarda repomix sync YAPILMADAN görev bitmez:
- 3 veya daha fazla dosya değiştiğinde
- Yeni skill eklendiğinde / güncellendiğinde
- Feature veya fix tamamlandığında
- Session sonunda önemli değişiklik varsa

**Repomix Sync Adımları (PowerShell):**
```powershell
# 1. Paketle
npx repomix@latest --style markdown --compress --ignore "docs/repomix-output.md,repomix-output.xml" --output docs/repomix-output.md

# 2. Eski snapshot'ı NotebookLM'den sil (source_delete)
# 3. Yeni snapshot'ı ekle (source_add, title: "Codebase Snapshot — YYYY-MM-DD")
# 4. [REPOMIX-SYNC] notu ekle
```

### NOT YAZMA KURALLARI
- Notlar kısa ve madde madde olur — paragraf değil
- Her not başında kategori etiketi: [TAMAMLANDI] [BUG-COZUM] [KARAR] [DEPLOYMENT] [REPOMIX-SYNC]
- Tarih formatı: YYYY-MM-DD
- Kullanıcı "kaydet" demese de önemli olaylarda yaz
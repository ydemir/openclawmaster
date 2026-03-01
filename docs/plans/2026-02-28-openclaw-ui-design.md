# OpenClaw UI — Design Document
**Tarih:** 2026-02-28
**Yaklaşım:** TenacitOS fork + shadcn-ui-kit bileşenleri
**Konum:** `apps/openclaw-ui/` (OpenClawMaster monorepo)

---

## Genel Mimari

TenacitOS (OpenClaw'a özel dashboard) fork edilir ve `apps/openclaw-ui/` altına taşınır. shadcn-ui-kit'ten layout shell, Chat UI, DataTable ve tema sistemi bileşenleri uyarlanır. WebSocket RPC katmanı eklenerek hibrit veri erişimi sağlanır.

### Konum

```
c:\github\openclawmaster\
└── apps\
    └── openclaw-ui\
        ├── src\app\
        ├── src\lib\
        ├── package.json
        └── .env.local
```

### Katmanlar

```
┌─────────────────────────────────────────┐
│       Next.js 15 (App Router)            │
│  React 19 · Tailwind v4 · shadcn/ui     │
├───────────────────┬─────────────────────┤
│  Dosya Okuma      │   WebSocket RPC      │
│  (Server-side)    │   (Client-side)      │
│                   │                      │
│  sessions.json    │  chat.send           │
│  cron/jobs.json   │  chat.history        │
│  logs/*.log       │  sessions.reset      │
│  memory/*.sqlite  │  cron.run/add        │
│  openclaw.json    │  config.patch        │
│  workspace/*.md   │  agent.run           │
├───────────────────┴─────────────────────┤
│         SSH Tünel / Direct VPS           │
│    ws://127.0.0.1:18789 (OpenClaw GW)   │
└─────────────────────────────────────────┘
```

### Deployment

```
Windows Local                VPS (Ubuntu)
─────────────              ─────────────────────────
openclaw-ui (dev)  ──SSH──▶  openclaw-ui (Coolify)
ssh -L 18789:...  tünel          ↓
                            ~/.openclaw/ (dosyalar)
                            ws://127.0.0.1:18789
```

---

## Sayfa Yapısı

| Route | Başlık | Bileşen Kaynağı | Veri Kaynağı |
|---|---|---|---|
| `/` | Overview Dashboard | TenacitOS page.tsx | Dosya + WS RPC |
| `/sessions` | Session Listesi | TenacitOS + shadcn DataTable | sessions.json |
| `/sessions/[id]` | Session Konuşması | shadcn-ui-kit AI Chat V2 | `chat.history` RPC |
| `/channels` | Kanal Durumu | Yeni | openclaw.json |
| `/agents` | Agent Listesi | TenacitOS agents | agents config |
| `/agents/[id]` | Agent Workspace | TenacitOS + shadcn | workspace/*.md |
| `/cron` | Cron Job Yönetimi | TenacitOS + shadcn DataTable | jobs.json + `cron.*` RPC |
| `/logs` | Gateway Log Stream | TenacitOS logs | gateway.log SSE |
| `/memory` | Memory Browser | TenacitOS memory | memory/main.sqlite |
| `/config` | Config Editörü | Yeni (Monaco Editor) | `config.get/patch` RPC |
| `/system` | VPS Metrikleri | TenacitOS system | /proc + df + top |
| `/terminal` | Read-only Terminal | TenacitOS terminal | allowlist komutları |
| `/settings` | UI Ayarları | shadcn-ui-kit settings | .env.local |

### TenacitOS'tan Korunanlar
- `agents`, `system`, `terminal`, `memory`, `logs`, `cron` veri katmanı
- Auth middleware (httpOnly cookie, rate limiting)
- SQLite okuma (`better-sqlite3`)
- VPS metrik okuma mantığı

### shadcn-ui-kit'ten Taşınanlar
- Sidebar + Header layout shell (collapsible, inset)
- AI Chat V2 → `/sessions/[id]`
- DataTable (columns, filters, pagination) → `/sessions`, `/cron`
- Settings sayfaları → `/settings`
- Card, Badge, Chart, Spinner, Toast, Skeleton

### Yeni Yazılanlar
- WebSocket RPC client (Zustand store)
- `/config` sayfası (Monaco Editor)
- `/channels` sayfası (kanal durumu kartları)
- SSH tünel env konfigürasyonu

---

## Veri Akışı

### İki Kanal

**Server Components (dosya okuma):**
- `sessions.json` — session listesi
- `cron/jobs.json` — job listesi
- `gateway.log` — log stream (SSE)
- `memory/main.sqlite` — memory arama
- `openclaw.json` — config okuma
- `workspace/*.md` — agent dosyaları

**Client Components (WebSocket RPC):**
- `chat.history`, `chat.send`, `chat.abort`, `chat.inject`
- `sessions.reset`, `sessions.delete`, `sessions.patch`
- `cron.run`, `cron.add`, `cron.update`, `cron.remove`
- `config.get`, `config.apply`, `config.patch`
- `agent.run`, `agent.identity`

### WebSocket Store (Zustand)

```typescript
{
  status: "connected" | "disconnected" | "reconnecting",
  send: (method: string, params: object) => Promise<result>,
  subscribe: (event: string, handler: fn) => void,
}
```

Reconnect: exponential backoff. Header'da bağlantı durumu göstergesi.

### Log Stream (SSE)

```
GET /api/logs/stream → text/event-stream
                        tail -f gateway.log satır satır push
```

### Hata Yönetimi

| Hata | Davranış |
|---|---|
| WS kopukluk | Toast + otomatik reconnect, işlemler queue'a alınır |
| Dosya bulunamadı | Empty state, "OpenClaw kurulu değil" mesajı |
| RPC hata | Toast notification + detay drawer |
| Auth timeout | Middleware redirect `/login` |

---

## Authentication

### Login Flow

```
/login → şifre formu
          ↓ POST /api/auth/login
        bcrypt.compare(input, DASHBOARD_PASSWORD_HASH)
          ↓ başarılı
        httpOnly cookie (7 gün, secure, sameSite=strict)
          ↓
        / dashboard

Rate limiting: 5 başarısız → 15 dk IP kilit (in-memory)
```

### Şifre Kurulumu

```bash
node -e "const b=require('bcryptjs'); console.log(b.hashSync('sifren',12))"
# Çıktıyı .env.local → DASHBOARD_PASSWORD_HASH'e koy
```

---

## Environment Variables

```bash
# .env.local (gitignore'da — asla commit etme)
DASHBOARD_PASSWORD_HASH=...         # bcrypt hash
OPENCLAW_DIR=/root/.openclaw        # VPS openclaw dizini
OPENCLAW_WS=ws://127.0.0.1:18789   # gateway WebSocket
SESSION_SECRET=...                  # openssl rand -hex 32
NODE_ENV=production
```

---

## Deployment: Coolify

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY apps/openclaw-ui/ .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Coolify Ayarları

```yaml
Port: 3000
Network: host              # ws://127.0.0.1:18789 erişimi için kritik
Volume: /root/.openclaw → /app/.openclaw (read-only mount)
Env: Coolify secrets'tan inject edilir
```

### Local Geliştirme (Windows PowerShell)

```powershell
# 1. SSH tünel aç
ssh -L 18789:127.0.0.1:18789 vps-alias -N

# 2. .env.local ayarla
# OPENCLAW_WS=ws://127.0.0.1:18789
# OPENCLAW_DIR= (SSH üzerinden okuma veya WSL path)

# 3. Dev server
cd apps\openclaw-ui
npm run dev
```

---

## Tech Stack

| Katman | Teknoloji |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind v4, shadcn/ui |
| State | Zustand (WS store) |
| Data Fetching | Server Components + React Query (client) |
| Database | better-sqlite3 (memory okuma) |
| Charts | Recharts |
| Editor | Monaco Editor (config sayfası) |
| 3D (opsiyonel) | React Three Fiber (TenacitOS office — sonraki fazda) |
| Auth | bcryptjs + httpOnly cookie |
| Log Stream | SSE (Server-Sent Events) |

---

## Kabul Kriterleri (MVP)

- [ ] Login çalışıyor, rate limiting aktif
- [ ] Dashboard overview açılıyor (agent sayısı, aktif session'lar, sistem metrikleri)
- [ ] `/sessions` — tüm session'lar listeleniyor, filtrelenebilir
- [ ] `/sessions/[id]` — konuşma geçmişi görünüyor, mesaj gönderilebiliyor
- [ ] `/cron` — job'lar listeleniyor, manuel çalıştırılabiliyor, yeni job eklenebiliyor
- [ ] `/logs` — gateway.log canlı akıyor
- [ ] `/config` — openclaw.json görüntülenip düzenlenebiliyor
- [ ] `/channels` — kanal durumları görünüyor
- [ ] Coolify deploy çalışıyor
- [ ] Local SSH tünel ile geliştirme çalışıyor

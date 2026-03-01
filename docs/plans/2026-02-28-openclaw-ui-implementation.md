# OpenClaw UI Implementation Plan (Revize)

> **For Codex/Claude:** REQUIRED EXECUTION MODE: Bu plan, proje "hazir" olana kadar kesintisiz uygulanir. Yalnizca kullanici karari gerektiren blocker olursa durulur.

**Goal:** TenacitOS fork'unu `apps/openclaw-ui/` altina tasiyip OpenClaw icin calisan bir yonetim paneli cikarmak: session yonetimi, chat, cron, logs, config ve channels.

**Architecture:** Next.js 15 App Router uzerinde server-side dosya okuma + client-side WebSocket RPC hibrit modeli. UI tarafinda shadcn bileşenleri ve Zustand tabanli baglanti durumu yonetimi.

**Tech Stack:** Next.js 15, React 19, Tailwind v4, shadcn/ui, Zustand, @tanstack/react-table, @monaco-editor/react, sonner, better-sqlite3 (opsiyonel), SSE.

---

## Kilit Kararlar (Degistirilmeyecek)
1. Windows gelistirme ortami native PowerShell olarak kalir.
2. WebSocket client env anahtari `NEXT_PUBLIC_OPENCLAW_WS` olur.
3. Session detail route URL parametresi `sessionId` olur; RPC icin server tarafinda `sessionKey` resolve edilir.
4. Log streaming `tail -f` ile degil, Node.js dosya izleme ile cross-platform calisir.
5. Coolify deploy'da `Base Directory = apps/openclaw-ui`, `Dockerfile path = Dockerfile` kullanilir.
6. Uygulama tamamlanana kadar "implement -> test -> fix -> retest" dongusu kirilmaz.

---

## Continuous Execution Loop (Zorunlu)
Her gorevde su dongu uygulanir:
1. Gorev alt adimini uygula.
2. Hemen ilgili lokal dogrulamayi calistir.
3. Hata varsa ayni adimda duzelt.
4. Testleri tekrar calistir.
5. Sonraki alt adima gec.

Durma kosullari:
- Harici secret/credential gerekiyor ve repodan bulunamiyor.
- Veri kaybi riski olan destructive karar icin kullanici onayi gerekiyor.
- Net urun karari gerekiyor ve teknik olarak turetilemiyor.

Bu kosullar disinda gorev akisi durdurulmaz.

---

## Task 1: Proje Iskeleti + Ortam Sozlesmesi

**Files:**
- Create: `apps/openclaw-ui/` (TenacitOS fork)
- Modify: `apps/openclaw-ui/package.json`
- Create: `apps/openclaw-ui/.env.local.example`
- Create/Modify: `apps/openclaw-ui/.gitignore`

**Steps:**
1. `apps/openclaw-ui` klasorune TenacitOS fork'u kopyala.
2. Fork icindeki `.git` dizinini sil.
3. `package.json` icinde `name` alanini `openclaw-ui` yap.
4. `.env.local.example` olustur:
```bash
DASHBOARD_PASSWORD_HASH=
OPENCLAW_DIR=/root/.openclaw
OPENCLAW_WS=ws://127.0.0.1:18789
NEXT_PUBLIC_OPENCLAW_WS=ws://127.0.0.1:18789
SESSION_SECRET=
NODE_ENV=development
```
5. `.gitignore` icinde en az su girdiler olsun:
```text
.env.local
.next/
node_modules/
```

**Verification:**
- `npm install`
- `npm run dev`
- `http://localhost:3000` aciliyor mu kontrol et.

---

## Task 2: UI Temel Bilesenleri ve Bagimliliklar

**Files:**
- Modify: `apps/openclaw-ui/package.json`
- Modify: `apps/openclaw-ui/src/app/layout.tsx` (veya mevcut root layout dosyasi)

**Steps:**
1. UI ve runtime bagimliliklarini ekle:
```bash
npm install zustand @tanstack/react-table @monaco-editor/react sonner
```
2. shadcn bilesenlerini ekle:
```bash
npx shadcn@latest add sidebar badge separator scroll-area table input button textarea avatar card sonner
```
3. Root layout'a `Toaster` mount et (sonner icin zorunlu).

**Verification:**
- Build hatasi olmadan component importlari cozulmeli.
- Toast cagrisi yapilan sayfalarda UI'da gorunmeli.

---

## Task 3: Dashboard Shell (Sidebar + Header)

**Files:**
- Modify: `apps/openclaw-ui/src/app/(dashboard)/layout.tsx`
- Create: `apps/openclaw-ui/src/components/layout/app-sidebar.tsx`
- Create: `apps/openclaw-ui/src/components/layout/site-header.tsx`

**Steps:**
1. Dashboard layout'ta `SidebarProvider` yapisini kur.
2. Sol sidebar'a su nav route'larini kilitle:
   - `/`
   - `/sessions`
   - `/sessions/[sessionId]`
   - `/cron`
   - `/logs`
   - `/config`
   - `/channels`
3. Header sagina WebSocket durum gostergesi yerlestir.

**Verification:**
- Sidebar collapse/expand calisiyor.
- Her route'a navigation calisiyor.

---

## Task 4: WebSocket RPC Katmani (Hardened)

**Files:**
- Create: `apps/openclaw-ui/src/lib/ws-store.ts`
- Create: `apps/openclaw-ui/src/hooks/use-rpc.ts`
- Create: `apps/openclaw-ui/src/components/ws-status-indicator.tsx`

**Steps:**
1. Zustand store'da durumlar:
   - `disconnected | connecting | connected | reconnecting`
2. `connect()` icinde URL kaynagi:
   - `process.env.NEXT_PUBLIC_OPENCLAW_WS`
   - fallback `ws://127.0.0.1:18789`
3. `manualClose` flag'i ekle:
   - `disconnect()` cagrildiginda `manualClose = true`
   - `onclose` icinde `manualClose` ise reconnect yapma
4. Reconnect exponential backoff: `1s -> 2s -> 4s ... max 30s`.
5. `send()` icinde RPC timeout (30s) ve pending map cleanup.
6. `WsStatusIndicator` icinde `useEffect` cleanup ile `disconnect()` cagir.

**Verification:**
- Gateway kapaliysa badge `Disconnected`.
- Gateway acilinca otomatik `Connected`.
- `disconnect()` sonrasi istemsiz reconnect olmuyor.

---

## Task 5: Dosya Okuma Katmani + Session Mapping

**Files:**
- Create: `apps/openclaw-ui/src/lib/openclaw-fs.ts`

**Steps:**
1. Ortak yardimci fonksiyonlar:
   - `getOpenClawPath(...segments)`
   - `readJsonFile<T>(relativePath)`
2. Session indeks fonksiyonlari:
   - `readSessionsIndex()`
   - `readSessions()` (listeleme icin satir modeli)
   - `resolveSessionKeyFromSessionId(sessionId)` (kritik)
3. Cron ve channels fonksiyonlari:
   - `readCronJobs()`
   - `readChannelConfig()`
4. Hata durumlarinda throw yerine bos donus/fallback kullan.

**Verification:**
- `OPENCLAW_DIR` yoksa sayfalar crash etmeden empty-state vermeli.
- Session listesi okunuyorsa en az key/label/channel gorunmeli.

---

## Task 6: Reusable DataTable Bileseni

**Files:**
- Create: `apps/openclaw-ui/src/components/ui/data-table.tsx`

**Steps:**
1. `@tanstack/react-table` ile generic DataTable component yaz:
   - props: `columns`, `data`, `searchKey?`
2. Arama kutusu, temel pagination ve bos durum gorseli ekle.

**Verification:**
- Sessions sayfasinda `DataTable` importu dogrudan bu dosyadan cozulmeli.
- Search input ile `label` filtrelemesi calismali.

---

## Task 7: Sessions List ve Session Detail

**Files:**
- Create: `apps/openclaw-ui/src/app/(dashboard)/sessions/page.tsx`
- Create: `apps/openclaw-ui/src/app/(dashboard)/sessions/columns.tsx`
- Create: `apps/openclaw-ui/src/app/(dashboard)/sessions/[id]/page.tsx`

**Steps:**
1. Sessions listesinde link formati:
   - `href=/sessions/${encodeURIComponent(sessionId)}`
2. Detail page server tarafinda:
   - `sessionId = decodeURIComponent(params.id)`
   - `sessionKey = resolveSessionKeyFromSessionId(sessionId)`
3. `sessionKey` bulunamazsa anlamli empty-state goster.

**Verification:**
- Liste satirina tiklayinca detail aciliyor.
- Yanlis `sessionId` icin uygulama patlamadan "Session bulunamadi" mesaji veriyor.

---

## Task 8: ChatView (RPC: history/send)

**Files:**
- Create: `apps/openclaw-ui/src/app/(dashboard)/sessions/[id]/chat-view.tsx`

**Steps:**
1. `ChatView` props:
   - `sessionId: string`
   - `sessionKey: string`
2. Yukleme akisi:
   - `rpc("chat.history", { sessionKey })`
3. Gonderim akisi:
   - `rpc("chat.send", { sessionKey, text })`
4. Hata UI'si:
   - Toast + mesaj paneline hata satiri.

**Verification:**
- History yukleniyor.
- Enter ile mesaj gonderiliyor.
- WS bagli degilken net hata gorunuyor.

---

## Task 9: Cron Sayfasi (Liste + Run/Toggle)

**Files:**
- Create: `apps/openclaw-ui/src/app/(dashboard)/cron/page.tsx`
- Create: `apps/openclaw-ui/src/app/(dashboard)/cron/cron-table.tsx`
- Modify: `apps/openclaw-ui/src/lib/openclaw-fs.ts`

**Steps:**
1. `readCronJobs()` ile tablo datasini server tarafinda oku.
2. Client tabloda aksiyonlar:
   - `cron.run`
   - `cron.update` (`enabled` toggle)
3. Her aksiyonda toast sonucu goster.

**Verification:**
- Run ve toggle butonlari RPC cevabiyla calisiyor.
- Basarisiz RPC durumunda toast hata cikiyor.

---

## Task 10: Log Streaming (Cross-Platform SSE)

**Files:**
- Create: `apps/openclaw-ui/src/app/api/logs/stream/route.ts`
- Create: `apps/openclaw-ui/src/app/(dashboard)/logs/page.tsx`
- Create: `apps/openclaw-ui/src/app/(dashboard)/logs/log-viewer.tsx`

**Steps:**
1. `route.ts` icinde `export const runtime = "nodejs"` tanimla.
2. `tail -f` kullanma. Bunun yerine:
   - Baslangicta log dosyasinin son N satirini oku.
   - `setInterval` ile dosya boyutunu kontrol et.
   - Buyume varsa yeni byte araligini `fs.createReadStream` ile oku.
   - Truncate olursa offset'i sifirla.
3. `req.signal.abort` durumunda interval ve stream cleanup yap.

**Verification:**
- Windows local dev'de `/logs` calisiyor.
- Linux/Coolify ortaminda da ayni endpoint calisiyor.
- Baglantiyi kapatinca server tarafinda leak olusmuyor.

---

## Task 11: Config Editor + Channels

**Files:**
- Create: `apps/openclaw-ui/src/app/(dashboard)/config/page.tsx`
- Create: `apps/openclaw-ui/src/app/(dashboard)/config/config-editor.tsx`
- Create: `apps/openclaw-ui/src/app/(dashboard)/channels/page.tsx`
- Modify: `apps/openclaw-ui/src/lib/openclaw-fs.ts`

**Steps:**
1. Config Editor:
   - `rpc("config.get")` ile metni yukle
   - Kaydetmeden once `JSON.parse` validasyonu yap
   - `rpc("config.apply", { text })` ile uygula
2. Channels sayfasi:
   - `readChannelConfig()` ile kart bazli durum gostergesi
   - `enabled`, `dmPolicy`, `groupPolicy`, `accounts` ozetleri

**Verification:**
- Gecerli JSON kaydediliyor.
- Gecersiz JSON'da kayit engelleniyor.
- Channels kartlari empty-state ile guvenli aciliyor.

---

## Task 12: Docker + Coolify Deploy

**Files:**
- Create: `apps/openclaw-ui/Dockerfile`
- Create: `apps/openclaw-ui/.dockerignore`
- Modify: `apps/openclaw-ui/next.config.js` veya `next.config.ts`

**Steps:**
1. Next standalone build'i aktif et:
```js
module.exports = { output: "standalone" };
```
2. Multi-stage Dockerfile yaz:
   - builder: `npm ci && npm run build`
   - runner: `.next/standalone`, `.next/static`, `public`
3. Coolify ayari:
   - Source repo: `openclawmaster`
   - Base Directory: `apps/openclaw-ui`
   - Dockerfile path: `Dockerfile`
   - Port: `3000`
   - Network mode: `host`
   - Volume: `/root/.openclaw -> /root/.openclaw` (read-only)
4. Coolify env variables:
```text
DASHBOARD_PASSWORD_HASH=...
OPENCLAW_DIR=/root/.openclaw
OPENCLAW_WS=ws://127.0.0.1:18789
NEXT_PUBLIC_OPENCLAW_WS=ws://127.0.0.1:18789
SESSION_SECRET=...
NODE_ENV=production
```

**Verification:**
- Deploy sonrasi login sayfasi aciliyor.
- WS ve log endpoint production'da calisiyor.

---

## Task 13: Test Matrix ve Kabul

**Functional:**
1. Login + rate limit calisiyor.
2. Sidebar tum hedef sayfalara gidiyor.
3. WS badge dogru durum gosteriyor.
4. `/sessions` liste + filtreleme calisiyor.
5. `/sessions/[id]` history + send calisiyor.
6. `/cron` run/toggle calisiyor.
7. `/logs` SSE canli akiyor (Windows + Linux).
8. `/config` load/validate/save calisiyor.
9. `/channels` kartlar dogru gosteriliyor.
10. Coolify deploy HTTPS uzerinden aciliyor.

**Quality:**
1. `npm run lint`
2. `npm run typecheck` (varsa)
3. `npm run build`

---

## Task 14: Calisma Ritmi (Durmadan Tamamlama Plani)

Bu plan su ritimde uygulanir:
1. Phase'i uygula.
2. Hemen dogrula.
3. Hata varsa ayni phase icinde kapat.
4. Sonraki phase'e gec.
5. Her 1-2 phase sonunda ara durum raporu cikar.
6. Tum MVP + DoD tamamlanmadan "bitti" raporu verme.

Final rapor yalnizca su durumda atilir:
- Tum kabul kriterleri gecti.
- Build/lint/test temiz.
- Deploy dogrulandi.
- NotebookLM `[TAMAMLANDI]` ve gerekirse `[REPOMIX-SYNC]` notlari yazildi.

---

## NotebookLM ve Repomix Zorunlu Kayitlar

1. Gorev basinda:
   - `docs/notebooklm-notebook-id.txt` dosyasini oku
   - `ACTIVE` notebook'tan son durum sorgula
2. Gorev sonunda:
   - `[TAMAMLANDI] YYYY-MM-DD` notu yaz
3. Bug fix varsa:
   - `DEBUG` notebook'a `[BUG-COZUM]` notu yaz
4. 3+ dosya degisimi varsa:
```powershell
npx repomix@latest --style markdown --compress --ignore "docs/repomix-output.md,repomix-output.xml" --output docs/repomix-output.md
```
   - Eski snapshot'i sil
   - Yeni snapshot'i ekle
   - `[REPOMIX-SYNC]` notunu yaz

---

## Commit Stratejisi
1. `feat(ui): scaffold openclaw-ui base`
2. `feat(ui): add dashboard shell and ws status`
3. `feat(ui): add sessions list and session resolver`
4. `feat(ui): add chat rpc integration`
5. `feat(ui): add cron management page`
6. `feat(ui): add cross-platform log streaming`
7. `feat(ui): add config editor and channels page`
8. `feat(ui): add docker and coolify deployment setup`
9. `chore(ui): finalize tests and acceptance checks`


# Coolify Manager Skill — Hibrit Tasarım

**Tarih:** 2026-02-28
**Durum:** Onaylandı
**Kapsam:** Mevcut `coolify-manager` skill'ini .env auto-config + tam hibrit CLI/API desteğiyle genişletmek

---

## Hedef

`.env` dosyasındaki `COOLIFY_BASE_URL` ve `COOLIFY_API_TOKEN` değerlerini okuyarak Coolify CLI'yi otomatik configure eden, CLI'nin desteklemediği yetenekler için direkt API call yapan, tam yetenekli bir hibrit skill.

---

## Mimari

```
Kullanıcı skill'i tetikler
  → setup.ps1: .env oku → coolify context add
  → Komut CLI ile yapılabilir mi?
      Evet → coolify <komut>
      Hayır → api_call.ps1 → direkt HTTP → Coolify API
```

---

## Dosya Yapısı

```
.agents/skills/coolify-manager/
├── SKILL.md                      ← Genişletilecek (hibrit workflow)
├── scripts/
│   ├── setup.ps1                 ← YENİ: .env → coolify context add
│   ├── install_cli.ps1           ← YENİ: Windows CLI installer
│   ├── api_call.ps1              ← YENİ: API helper (CLI dışı endpoint'ler)
│   ├── install_coolify_cli.sh    ← Mevcut (VPS için, dokunulmaz)
│   └── check_health.sh           ← Mevcut (dokunulmaz)
└── references/
    ├── cli_commands.md           ← v4.x ile güncellenecek
    ├── api_full.md               ← YENİ: CLI'de olmayan tüm API endpoint'leri
    ├── api_endpoints.md          ← Mevcut (dokunulmaz)
    └── wordpress_fixes.md        ← Mevcut (dokunulmaz)
```

---

## CLI Katmanı (Mevcut + Genişletilecek)

Aşağıdaki operasyonlar `coolify` CLI binary üzerinden yapılır:

- **Context:** add, list, use, verify, remove
- **Servers:** list, get, add, validate, domains, remove
- **Applications:** list, get, start, stop, restart, logs, update, delete
- **App Env Vars:** list, get, set, delete, .env sync
- **Services:** list, get, start, stop, restart, delete
- **Databases:** list, get, start, stop, restart, backup, backups
- **Deployments:** deploy, list, get
- **Projects:** list, get, envs
- **Resources:** list (tümü)
- **Teams:** list, get, members
- **Private Keys:** list, get, add, delete
- **GitHub Apps:** list, get

---

## API Katmanı (CLI'de Olmayan Yetenekler)

Aşağıdaki operasyonlar `api_call.ps1` üzerinden direkt HTTP ile yapılır:

| Kategori | Method | Endpoint |
|---|---|---|
| **Webhooks** | GET | `/api/v1/webhooks` |
| **Webhooks** | POST | `/api/v1/webhooks` |
| **Webhooks** | DELETE | `/api/v1/webhooks/{uuid}` |
| **PR Preview** | GET | `/api/v1/applications/{uuid}/preview` |
| **Sentinel Metrics** | GET | `/api/v1/servers/{uuid}/metrics` |
| **Proxy Restart** | POST | `/api/v1/servers/{uuid}/proxy/restart` |
| **Audit Logs** | GET | `/api/v1/activities` |
| **Custom Domains** | GET | `/api/v1/domains` |
| **Custom Domains** | POST | `/api/v1/domains` |
| **Token Yönetimi** | GET | `/api/v1/security/tokens` |
| **Instance Ayarları** | GET | `/api/v1/settings` |
| **Instance Ayarları** | PATCH | `/api/v1/settings` |

---

## .env Entegrasyonu

`setup.ps1` şunu yapar:

```powershell
# 1. .env dosyasını oku
# 2. COOLIFY_BASE_URL ve COOLIFY_API_TOKEN al
# 3. coolify context add production $url $token
# 4. coolify context verify
```

Gerekli `.env` değişkenleri:
```
COOLIFY_BASE_URL=https://coolify.tulli.cloud
COOLIFY_API_TOKEN=<token>
```

---

## Güvenlik

| Kural | Uygulama |
|---|---|
| Secret commit etme | `.gitignore`'a `.env` eklenir |
| Destructive op onayı | delete/stop/restart öncesi Claude onay ister |
| Token maskeleme | `--show-sensitive` olmadan token görünmez |
| Least-privilege | Token: read + write + deploy ability |

`.gitignore` eklemeleri:
```
.env
.env.local
*.env
```

---

## Platform

- **Geliştirme makinesi:** Windows 11 — native PowerShell (WSL değil)
- **Yerel scriptler:** `.ps1` (PowerShell)
- **VPS scriptler:** `.sh` (bash, SSH üzerinden)
- **CLI binary:** Windows amd64

---

## Kabul Kriterleri

1. `.env` dosyası varsa skill otomatik bağlanır, manuel `coolify context add` gerekmez
2. Tüm CLI komutları skill'den erişilebilir
3. CLI'de olmayan 12 API endpoint skill'den çağrılabilir
4. Destructive operasyonlar onay ister
5. `.env` git'e commit edilmez

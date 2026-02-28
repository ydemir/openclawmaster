# Coolify Manager Hybrid Skill — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** coolify-manager skill'ini .env auto-config + tam hibrit CLI/API desteğiyle genişletmek

**Architecture:** Skill tetiklendiğinde setup.ps1 .env'i okuyup Coolify CLI'yi otomatik configure eder. CLI'nin desteklediği operasyonlar CLI üzerinden, desteklemedikleri (webhook, metrics, proxy, audit, domain, settings) api_call.ps1 PowerShell helper'ı üzerinden direkt HTTP ile yapılır.

**Tech Stack:** PowerShell 5.1+, Coolify CLI v4.x (Windows amd64), Coolify REST API v1, .env dosyası

---

### Task 1: .gitignore oluştur

**Files:**
- Create: `.gitignore`

**Step 1: .gitignore yaz**

```
.env
.env.local
*.env
```

**Step 2: Dosyayı oluştur**

Proje kökünde `/c/github/openclawmaster/.gitignore` oluştur, yukarıdaki içeriği yaz.

**Step 3: Doğrula**

```powershell
Get-Content .gitignore
```
Expected: 3 satır, .env dahil

**Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore to protect .env secrets"
```

---

### Task 2: Windows CLI Installer (install_cli.ps1)

**Files:**
- Create: `.agents/skills/coolify-manager/scripts/install_cli.ps1`

**Step 1: Script yaz**

```powershell
# install_cli.ps1 - Coolify CLI Windows Installer
param(
    [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"

Write-Host "Coolify CLI kurulum basliyor..."

# Versiyon belirle
if ($Version -eq "latest") {
    $release = Invoke-RestMethod "https://api.github.com/repos/coollabsio/coolify-cli/releases/latest"
    $Version = $release.tag_name -replace '^v', ''
}

Write-Host "Versiyon: $Version"

# Platform: Windows amd64
$fileName = "coolify-cli_${Version}_windows_amd64.zip"
$url = "https://github.com/coollabsio/coolify-cli/releases/download/v${Version}/${fileName}"
$dest = "$env:USERPROFILE\.local\bin"
$zipPath = "$env:TEMP\coolify-cli.zip"

# Dizin olustur
if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

# Indir
Write-Host "Indiriliyor: $url"
Invoke-WebRequest -Uri $url -OutFile $zipPath

# Cikart
Expand-Archive -Path $zipPath -DestinationPath $dest -Force
Remove-Item $zipPath

# PATH kontrolu
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$dest*") {
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$dest", "User")
    Write-Host "PATH guncellendi: $dest eklendi"
    Write-Host "Degisikliklerin gecerli olması icin terminali yeniden ac."
}

Write-Host "Kurulum tamamlandi. Versiyon kontrol:"
& "$dest\coolify.exe" version
```

**Step 2: Dogrula — syntax kontrolu**

```powershell
powershell -NoProfile -Command "& { . '.agents/skills/coolify-manager/scripts/install_cli.ps1' -WhatIf }" 2>&1
```

Expected: Syntax hatasi yok

**Step 3: Commit**

```bash
git add .agents/skills/coolify-manager/scripts/install_cli.ps1
git commit -m "feat(coolify-skill): add Windows PowerShell CLI installer"
```

---

### Task 3: .env Auto-Config Script (setup.ps1)

**Files:**
- Create: `.agents/skills/coolify-manager/scripts/setup.ps1`

**Step 1: Script yaz**

```powershell
# setup.ps1 - .env dosyasindan Coolify CLI context configure eder
param(
    [string]$EnvFile = ".env",
    [string]$ContextName = "production"
)

$ErrorActionPreference = "Stop"

# .env dosyasini bul (proje koku veya belirtilen yol)
$envPath = $EnvFile
if (-not [System.IO.Path]::IsPathRooted($envPath)) {
    $envPath = Join-Path (Get-Location) $EnvFile
}

if (-not (Test-Path $envPath)) {
    Write-Error ".env dosyasi bulunamadi: $envPath"
    exit 1
}

# .env parse et
$envVars = @{}
Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line -match "^([^=]+)=(.*)$") {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

# Gerekli degiskenleri kontrol et
$url = $envVars["COOLIFY_BASE_URL"]
$token = $envVars["COOLIFY_API_TOKEN"]

if (-not $url) {
    Write-Error ".env icinde COOLIFY_BASE_URL bulunamadi"
    exit 1
}
if (-not $token) {
    Write-Error ".env icinde COOLIFY_API_TOKEN bulunamadi"
    exit 1
}

Write-Host "Coolify baglantiyor: $url"

# Mevcut context varsa guncelle, yoksa ekle
$existing = coolify context list 2>&1
if ($existing -match $ContextName) {
    Write-Host "Context '$ContextName' zaten var, guncelleniyor..."
    coolify context remove $ContextName --force 2>&1 | Out-Null
}

coolify context add $ContextName $url $token

# Dogrula
Write-Host "Baglanti dogrulanıyor..."
coolify context verify

Write-Host "Hazir. Context: $ContextName -> $url"
```

**Step 2: Manuel test**

```powershell
powershell -File .agents/skills/coolify-manager/scripts/setup.ps1
```

Expected:
```
Coolify baglantiyor: https://coolify.tulli.cloud
Baglanti dogrulanıyor...
Hazir. Context: production -> https://coolify.tulli.cloud
```

**Step 3: Commit**

```bash
git add .agents/skills/coolify-manager/scripts/setup.ps1
git commit -m "feat(coolify-skill): add .env auto-config PowerShell script"
```

---

### Task 4: API Helper Script (api_call.ps1)

**Files:**
- Create: `.agents/skills/coolify-manager/scripts/api_call.ps1`

**Step 1: Script yaz**

```powershell
# api_call.ps1 - Coolify REST API helper (CLI'de olmayan endpoint'ler icin)
param(
    [Parameter(Mandatory)][string]$Method,
    [Parameter(Mandatory)][string]$Endpoint,
    [string]$Body = "",
    [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

# .env oku
$envPath = Join-Path (Get-Location) $EnvFile
$envVars = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$baseUrl = $envVars["COOLIFY_BASE_URL"]
$token = $envVars["COOLIFY_API_TOKEN"]

if (-not $baseUrl -or -not $token) {
    Write-Error ".env icinde COOLIFY_BASE_URL veya COOLIFY_API_TOKEN eksik"
    exit 1
}

# URL olustur
$url = "$baseUrl/api/v1/$($Endpoint.TrimStart('/'))"

# Headers
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
    "Accept"        = "application/json"
}

# Istek at
$params = @{
    Method  = $Method
    Uri     = $url
    Headers = $headers
}

if ($Body -and $Method -in @("POST", "PUT", "PATCH")) {
    $params.Body = $Body
}

try {
    $response = Invoke-RestMethod @params
    $response | ConvertTo-Json -Depth 10
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Error "API Hatasi [$statusCode]: $($_.Exception.Message)"
    exit 1
}
```

**Step 2: Test — instance ayarlarini oku**

```powershell
powershell -File .agents/skills/coolify-manager/scripts/api_call.ps1 -Method GET -Endpoint "/settings"
```

Expected: JSON formatinda Coolify instance ayarlari

**Step 3: Commit**

```bash
git add .agents/skills/coolify-manager/scripts/api_call.ps1
git commit -m "feat(coolify-skill): add PowerShell API helper for CLI-missing endpoints"
```

---

### Task 5: api_full.md — Eksik API Endpoint Referansi

**Files:**
- Create: `.agents/skills/coolify-manager/references/api_full.md`

**Step 1: Referans dosyasini yaz**

```markdown
# Coolify API — CLI'de Olmayan Endpoint'ler

Bu endpoint'ler `api_call.ps1` ile kullanilir:
`powershell -File scripts/api_call.ps1 -Method <METHOD> -Endpoint "<ENDPOINT>"`

Base URL: .env'deki COOLIFY_BASE_URL
Auth: .env'deki COOLIFY_API_TOKEN (Bearer)

## Webhooks

### Listele
`api_call.ps1 -Method GET -Endpoint "/webhooks"`

### Olustur
`api_call.ps1 -Method POST -Endpoint "/webhooks" -Body '{"url":"...","events":["deploy"]}'`

### Sil
`api_call.ps1 -Method DELETE -Endpoint "/webhooks/{uuid}"`

## PR Preview

### Listele
`api_call.ps1 -Method GET -Endpoint "/applications/{uuid}/preview"`

## Sentinel Metrics

### Sunucu metrikleri
`api_call.ps1 -Method GET -Endpoint "/servers/{uuid}/metrics"`

## Proxy

### Traefik/Caddy yeniden baslat
`api_call.ps1 -Method POST -Endpoint "/servers/{uuid}/proxy/restart"`

## Audit Logs

### Aktivite gecmisi
`api_call.ps1 -Method GET -Endpoint "/activities"`

## Custom Domains

### Listele
`api_call.ps1 -Method GET -Endpoint "/domains"`

### Ekle
`api_call.ps1 -Method POST -Endpoint "/domains" -Body '{"domain":"example.com","resource_uuid":"..."}'`

## Token Yonetimi

### Listele
`api_call.ps1 -Method GET -Endpoint "/security/tokens"`

## Instance Ayarlari

### Oku
`api_call.ps1 -Method GET -Endpoint "/settings"`

### Guncelle
`api_call.ps1 -Method PATCH -Endpoint "/settings" -Body '{"fqdn":"https://coolify.tulli.cloud"}'`
```

**Step 2: Commit**

```bash
git add .agents/skills/coolify-manager/references/api_full.md
git commit -m "docs(coolify-skill): add full API reference for CLI-missing endpoints"
```

---

### Task 6: cli_commands.md Guncelle (v4.x)

**Files:**
- Modify: `.agents/skills/coolify-manager/references/cli_commands.md`

**Step 1:** Mevcut dosyayi oku, v1.0.3 referanslarini v4.x ile degistir.

**Step 2:** Eksik komutlari ekle:
- `coolify app env` komutlarina `.env` sync ekle
- Database backup komutlarini ekle
- GitHub Apps komutlarini ekle
- Shell completion (PowerShell) ekle

**Step 3: Commit**

```bash
git add .agents/skills/coolify-manager/references/cli_commands.md
git commit -m "docs(coolify-skill): update CLI reference to v4.x"
```

---

### Task 7: SKILL.md Guncelle

**Files:**
- Modify: `.agents/skills/coolify-manager/SKILL.md`

**Step 1:** Mevcut SKILL.md'ye eklenecekler:

1. **Otomatik Kurulum Bolumu:**
```markdown
## Otomatik Kurulum (.env ile)

### 1. CLI Kur (ilk seferinde)
```powershell
powershell -File scripts/install_cli.ps1
```

### 2. Otomatik Baglan
```powershell
powershell -File scripts/setup.ps1
```
.env dosyasindaki COOLIFY_BASE_URL ve COOLIFY_API_TOKEN kullanilir.
```

2. **Hibrit Workflow bolumu** — CLI vs API karar agaci
3. **CLI disi operasyonlar** — api_call.ps1 kullanimi
4. **Guvenlik notu** — destructive op onay gerektiriyor

**Step 2: Commit**

```bash
git add .agents/skills/coolify-manager/SKILL.md
git commit -m "feat(coolify-skill): add hybrid CLI+API workflow and auto-setup"
```

---

## Kabul Kriterleri Kontrol Listesi

- [ ] `.gitignore` .env'i koruyor
- [ ] `install_cli.ps1` Windows'ta coolify CLI kuruyor
- [ ] `setup.ps1` .env'den okuyup `coolify context verify` geciyor
- [ ] `api_call.ps1` ile `/settings` endpoint'i JSON donduruyor
- [ ] `api_full.md` 12 endpoint kategorisini iceriyor
- [ ] `SKILL.md` hibrit workflow'u acikliyor

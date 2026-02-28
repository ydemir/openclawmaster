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
    coolify context remove $ContextName 2>&1 | Out-Null
}

coolify context add $ContextName $url $token --force
coolify context use $ContextName

# Dogrula (direkt API ile - CLI verify komutu beta API ile uyumsuz olabilir)
Write-Host "Baglanti dogrulanıyor..."
try {
    $testResult = Invoke-RestMethod -Uri "$($url.TrimEnd('/'))/api/v1/version" -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
    Write-Host "Baglanti basarili. Coolify versiyon: $testResult"
} catch {
    Write-Warning "API dogrulama basarisiz: $($_.Exception.Message)"
}

Write-Host "Hazir. Context: $ContextName -> $url"

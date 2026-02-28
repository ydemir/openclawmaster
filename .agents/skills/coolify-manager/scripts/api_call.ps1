# api_call.ps1 - Coolify REST API helper (CLI'de olmayan endpoint'ler icin)
param(
    [Parameter(Mandatory)][string]$Method,
    [Parameter(Mandatory)][string]$Endpoint,
    [string]$Body = "",
    [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

# .env oku
$envPath = $EnvFile
if (-not [System.IO.Path]::IsPathRooted($envPath)) {
    $envPath = Join-Path (Get-Location) $EnvFile
}

if (-not (Test-Path $envPath)) {
    Write-Error ".env dosyasi bulunamadi: $envPath"
    exit 1
}

$envVars = @{}
Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line -match "^([^=]+)=(.*)$") {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$baseUrl = $envVars["COOLIFY_BASE_URL"]
$token = $envVars["COOLIFY_API_TOKEN"]

if (-not $baseUrl) {
    Write-Error ".env icinde COOLIFY_BASE_URL bulunamadi"
    exit 1
}
if (-not $token) {
    Write-Error ".env icinde COOLIFY_API_TOKEN bulunamadi"
    exit 1
}

# URL olustur
$url = "$($baseUrl.TrimEnd('/'))/api/v1/$($Endpoint.TrimStart('/'))"

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
    $message = $_.Exception.Message
    Write-Error "API Hatasi [$statusCode]: $message"
    exit 1
}

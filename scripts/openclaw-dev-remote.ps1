param(
  [string]$SshTarget = "root@72.60.131.100",
  [string]$RemoteConfigDir = "/opt/openclaw/data/config",
  [string]$GatewayContainer = "openclaw-openclaw-gateway-1",
  [int]$LocalGatewayPort = 18789,
  [switch]$NoSync,
  [switch]$NoTunnel,
  [switch]$KeepTunnel
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Sync-RemoteConfig {
  param(
    [string]$Target,
    [string]$SourceDir,
    [string]$LocalRoot
  )

  if (-not (Test-Path $LocalRoot)) {
    New-Item -ItemType Directory -Path $LocalRoot -Force | Out-Null
  }

  $localConfig = Join-Path $LocalRoot "config"
  if (Test-Path $localConfig) {
    Remove-Item -Recurse -Force $localConfig
  }

  Write-Host "Remote config sync basladi: $Target:$SourceDir -> $localConfig"
  & scp -r "$Target`:$SourceDir" "$LocalRoot"

  $configPath = Join-Path $localConfig "openclaw.json"
  if (-not (Test-Path $configPath)) {
    throw "Senkronizasyon sonrasi openclaw.json bulunamadi: $configPath"
  }

  Write-Host "Remote config sync tamamlandi."
}

function Get-GatewayIp {
  param(
    [string]$Target,
    [string]$Container
  )

  $cmd = "docker inspect $Container --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'"
  $ip = (& ssh $Target $cmd).Trim()
  if (-not $ip) {
    throw "Gateway container IP tespit edilemedi: $Container"
  }
  return $ip
}

function Start-GatewayTunnel {
  param(
    [string]$Target,
    [string]$GatewayIp,
    [int]$LocalPort
  )

  try {
    $inUse = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction Stop
    if ($inUse) {
      throw "Local port $LocalPort zaten kullanimda. Once kapatip tekrar deneyin."
    }
  } catch {
    # No listener found, continue.
  }

  $argList = @(
    "-N",
    "-L",
    "$LocalPort`:$GatewayIp`:18789",
    $Target
  )

  $proc = Start-Process -FilePath "ssh" -ArgumentList $argList -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 2

  if ($proc.HasExited) {
    throw "SSH tunnel baslatilamadi."
  }

  Write-Host "Tunnel acildi: ws://127.0.0.1:$LocalPort -> $GatewayIp:18789 ($($proc.Id))"
  return $proc
}

$repoRoot = Resolve-RepoRoot
$uiDir = Join-Path $repoRoot "apps/openclaw-ui"
$mirrorRoot = Join-Path $repoRoot ".remote-openclaw"
$mirrorConfig = Join-Path $mirrorRoot "config"
$tunnelProc = $null

try {
  if (-not $NoSync) {
    Sync-RemoteConfig -Target $SshTarget -SourceDir $RemoteConfigDir -LocalRoot $mirrorRoot
  }

  if (-not (Test-Path (Join-Path $mirrorConfig "openclaw.json"))) {
    throw "Local mirror config eksik. NoSync kullandiysan once sync yapin."
  }

  if (-not $NoTunnel) {
    $gatewayIp = Get-GatewayIp -Target $SshTarget -Container $GatewayContainer
    $tunnelProc = Start-GatewayTunnel -Target $SshTarget -GatewayIp $gatewayIp -LocalPort $LocalGatewayPort
  }

  $env:OPENCLAW_DIR = $mirrorConfig
  $env:OPENCLAW_WORKSPACE = (Join-Path $mirrorConfig "workspace")
  $env:OPENCLAW_WS = "ws://127.0.0.1:$LocalGatewayPort"
  $env:NEXT_PUBLIC_OPENCLAW_WS = "ws://127.0.0.1:$LocalGatewayPort"

  Write-Host ""
  Write-Host "Local dev remote profile:"
  Write-Host "  OPENCLAW_DIR=$($env:OPENCLAW_DIR)"
  Write-Host "  OPENCLAW_WS=$($env:OPENCLAW_WS)"
  Write-Host ""

  Push-Location $uiDir
  npm run dev
  $exitCode = $LASTEXITCODE
  Pop-Location

  if ($exitCode -ne 0) {
    exit $exitCode
  }
} finally {
  if ($tunnelProc -and -not $KeepTunnel) {
    if (-not $tunnelProc.HasExited) {
      Stop-Process -Id $tunnelProc.Id -Force
      Write-Host "Tunnel kapatildi: PID $($tunnelProc.Id)"
    }
  } elseif ($tunnelProc -and $KeepTunnel) {
    Write-Host "Tunnel acik birakildi: PID $($tunnelProc.Id)"
  }
}

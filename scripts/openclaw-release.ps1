param(
  [Parameter(Mandatory = $true)]
  [string]$Message,
  [string]$Branch = "master",
  [string]$CoolifyAppUuid = "akkkcgkcwso8cwkoko4scsw0",
  [switch]$NoDeploy
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Wait-Deploy {
  param(
    [string]$DeploymentUuid
  )

  for ($i = 0; $i -lt 120; $i++) {
    $resp = coolify deploy get $DeploymentUuid --format json | ConvertFrom-Json
    $status = $resp.status
    $commit = $resp.commit
    Write-Host "[$i] $status $commit"
    if ($status -eq "finished" -or $status -eq "failed" -or $status -eq "canceled") {
      return $status
    }
    Start-Sleep -Seconds 5
  }
  return "timeout"
}

$repoRoot = Resolve-RepoRoot
$uiDir = Join-Path $repoRoot "apps/openclaw-ui"

Push-Location $uiDir
npm run typecheck
npm run lint
Pop-Location

Push-Location $repoRoot
$status = git status --short
if (-not $status) {
  Write-Host "Commitlenecek degisiklik yok."
} else {
  git add -A
  git commit -m $Message
}

git push origin $Branch

if (-not $NoDeploy) {
  $deployResp = coolify deploy uuid $CoolifyAppUuid --format json | ConvertFrom-Json
  $deploymentUuid = $deployResp.deployments[0].deployment_uuid
  Write-Host "Deploy queued: $deploymentUuid"
  $deployStatus = Wait-Deploy -DeploymentUuid $deploymentUuid
  if ($deployStatus -ne "finished") {
    throw "Deploy tamamlanmadi. Durum: $deployStatus"
  }
  Write-Host "Deploy basarili."
}
Pop-Location

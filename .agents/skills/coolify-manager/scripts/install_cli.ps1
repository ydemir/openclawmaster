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
    Write-Host "Degisikliklerin gecerli olmasi icin terminali yeniden ac."
}

Write-Host "Kurulum tamamlandi. Versiyon kontrol:"
& "$dest\coolify.exe" version

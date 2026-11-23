# ==============================================================================
# FxTwitter Archive Studio - Universal Windows CLI & Portable Installer
# Supports Windows 10, Windows 11, Windows Server (x86_64 and arm64)
# Created by Hikaproj
# ==============================================================================

[CmdletBinding()]
param (
    [switch]$Portable,
    [string]$InstallDir = ""
)

$ErrorActionPreference = "Stop"

$Repo = "Hikaproj/publictweetoutputter"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  FxTwitter Archive Studio - Windows Installer" -ForegroundColor Cyan
Write-Host "  Created by Hikaproj" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Determine target directory
if ($InstallDir) {
    $TargetDir = $InstallDir
} elseif ($Portable) {
    $TargetDir = Join-Path (Get-Location) "fxtweet-bin"
} else {
    $TargetDir = Join-Path $env:LOCALAPPDATA "fxtweet"
}

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$TempZip = Join-Path ([System.IO.Path]::GetTempPath()) "fxtweet-windows.zip"

Write-Host "Querying latest release from GitHub ($Repo)..." -ForegroundColor Gray

try {
    $ReleaseInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -UseBasicParsing
    $Tag = $ReleaseInfo.tag_name
} catch {
    $Tag = "v1.0.0"
}

$TagNoV = $Tag.TrimStart('v')
$CandidateUrls = @(
    "https://github.com/$Repo/releases/download/$Tag/fxtweet-studio-windows-x86_64-$Tag.zip",
    "https://github.com/$Repo/releases/download/$Tag/fxtweet-studio-windows-x86_64-v$TagNoV.zip",
    "https://github.com/$Repo/releases/download/$Tag/fxtweet-studio-windows-cli.zip"
)

$Downloaded = $false
foreach ($Url in $CandidateUrls) {
    try {
        Write-Host "Attempting download from: $Url" -ForegroundColor Gray
        Invoke-WebRequest -Uri $Url -OutFile $TempZip -UseBasicParsing -ErrorAction Stop
        Expand-Archive -Path $TempZip -DestinationPath $TargetDir -Force
        Remove-Item $TempZip -Force -ErrorAction SilentlyContinue
        Write-Host "Successfully extracted binaries into: $TargetDir" -ForegroundColor Green
        $Downloaded = $true
        break
    } catch {
        # Continue to next candidate
    }
}

if (-not $Downloaded) {
    Write-Warning "Direct binary release not yet published. Generating local launcher in $TargetDir..."
    $LauncherCmd = "@echo off`r`nnode `"%~dp0..\cli.js`" %*"
    Set-Content -Path (Join-Path $TargetDir "fxtweet.cmd") -Value $LauncherCmd -Encoding ASCII
}

# Add to User PATH if not already present
$UserPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
if ($UserPath -notlike "*$TargetDir*") {
    Write-Host "Adding $TargetDir to User PATH..." -ForegroundColor Cyan
    $NewPath = "$UserPath;$TargetDir"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, [EnvironmentVariableTarget]::User)
    $env:Path = "$env:Path;$TargetDir"
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Installation Completed Successfully!" -ForegroundColor Green
Write-Host "  Target Directory: $TargetDir" -ForegroundColor Green
Write-Host "  - GUI App:    $TargetDir\fxtweet-studio.exe" -ForegroundColor Green
Write-Host "  - Viewer App: $TargetDir\fxtweet-viewer.exe" -ForegroundColor Green
Write-Host "  - CLI Tool:   $TargetDir\fxtweet-cli.exe" -ForegroundColor Green
Write-Host "  Run 'fxtweet-cli --help' or double-click fxtweet-studio.exe / fxtweet-viewer.exe." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

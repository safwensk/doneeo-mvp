$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
$logsDirectory = Join-Path $projectDirectory '.local-run'
New-Item -ItemType Directory -Path $logsDirectory -Force | Out-Null

function Read-LocalHealth([string] $Url) {
    try { return Invoke-RestMethod -Uri $Url -TimeoutSec 3 } catch { return $null }
}

function Start-DoneeoService([string] $Launcher, [string] $Name, [string] $HealthUrl) {
    if (Read-LocalHealth $HealthUrl) {
        Write-Host "$Name is already running."
        return
    }
    Write-Host "Starting $Name..."
    $process = Start-Process -FilePath "$env:SystemRoot\System32\cmd.exe" -ArgumentList "/d /c $Launcher" -WorkingDirectory $projectDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logsDirectory "$Name.log") -RedirectStandardError (Join-Path $logsDirectory "$Name-error.log")
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (Read-LocalHealth $HealthUrl) { return }
        if ($process.HasExited) { throw "$Name stopped. Check the logs in $logsDirectory." }
        Start-Sleep -Seconds 1
    }
    throw "$Name is still starting. Check the logs in $logsDirectory."
}

Start-DoneeoService 'START_PLANNER_WINDOWS.bat' 'planner' 'http://127.0.0.1:5174/api/architecture'
Start-DoneeoService 'START_JAVA_WINDOWS.bat' 'backend' 'http://127.0.0.1:8080/api/health'
Start-DoneeoService 'START_REACT_WINDOWS.bat' 'website' 'http://localhost:5173/'
$backend = Read-LocalHealth 'http://127.0.0.1:8080/api/health'
if ($backend.mode -ne 'github-planner') {
    throw 'An older API is using port 8080. Close its window and start Doneeo again.'
}
Write-Host ''
Write-Host 'Doneeo is running at http://localhost:5173/'
Write-Host 'Describe a request, create an account or log in, and continue your saved plan.'

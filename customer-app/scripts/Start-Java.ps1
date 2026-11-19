$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
$env:MAVEN_SKIP_RC = '1'

if ($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))) {
    $env:PATH = "$(Join-Path $env:JAVA_HOME 'bin');$env:PATH"
}
if ($env:DONEEO_MAVEN_HOME) {
    $env:PATH = "$(Join-Path $env:DONEEO_MAVEN_HOME 'bin');$env:PATH"
}
if (!(Get-Command java.exe -ErrorAction SilentlyContinue)) { throw 'Install Java 21 and set JAVA_HOME or add java to PATH.' }
if (!(Get-Command mvn.cmd -ErrorAction SilentlyContinue)) { throw 'Install Maven 3.9+ and add mvn to PATH, or set DONEEO_MAVEN_HOME.' }
if (!$env:DONEEO_DATA_DIR) { $env:DONEEO_DATA_DIR = Join-Path $projectDirectory '.local-run' }
New-Item -ItemType Directory -Path $env:DONEEO_DATA_DIR -Force | Out-Null
Set-Location -LiteralPath (Join-Path $projectDirectory 'backend')
Write-Host 'Starting Doneeo Spring Boot API at http://localhost:8080/api/health'
& mvn.cmd spring-boot:run
exit $LASTEXITCODE

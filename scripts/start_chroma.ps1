# Start ChromaDB Local Server for AI Student Hub RAG Architecture
# Runs locally on http://127.0.0.1:8000 with persistent disk storage in ./chroma_data

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

$ChromaExe = Join-Path $ProjectRoot ".venv\Scripts\chroma.exe"
$DataDir = Join-Path $ProjectRoot "chroma_data"

if (-not (Test-Path $ChromaExe)) {
    Write-Host "Error: ChromaDB executable not found in .venv." -ForegroundColor Red
    Write-Host "Run: .\.venv\Scripts\python.exe -m pip install chromadb" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

Write-Host "Starting local ChromaDB server on http://127.0.0.1:8000..." -ForegroundColor Cyan
Write-Host "Persistence Directory: $DataDir" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Yellow

& $ChromaExe run --path $DataDir --host 127.0.0.1 --port 8000

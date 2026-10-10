$ErrorActionPreference = "Stop"
Write-Host "Installing the optional SQLite CLI with Windows Package Manager..."
winget install --id SQLite.SQLite -e
Write-Host "Open a NEW PowerShell window after installation and run: sqlite3 --version"
Write-Host "BlindMatch does not require sqlite3.exe to run; this CLI is for inspection/admin only."

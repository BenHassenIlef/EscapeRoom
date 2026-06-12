# ================================================================
#  SETUP_AUTOSTART.ps1
#  Run ONCE as Administrator to fix PostgreSQL auto-start.
# ================================================================

# Self-elevate if not admin
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Elevation requise — relancement en administrateur..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host ""
Write-Host "=== CONFIGURATION DU DEMARRAGE AUTOMATIQUE ===" -ForegroundColor Cyan
Write-Host ""

# 1. Switch PostgreSQL from AUTO to DELAYED-AUTO (starts after boot is stable)
Write-Host "[1/3] Configuration du service PostgreSQL (delayed-auto)..." -ForegroundColor White
$result = sc.exe config postgresql-x64-18 start= delayed-auto 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      OK: PostgreSQL configure en demarrage automatique differe" -ForegroundColor Green
} else {
    Write-Host "      ERREUR: $result" -ForegroundColor Red
}

# 2. Start PostgreSQL right now
Write-Host "[2/3] Demarrage de PostgreSQL maintenant..." -ForegroundColor White
Start-Service postgresql-x64-18 -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
$svc = Get-Service postgresql-x64-18
if ($svc.Status -eq "Running") {
    Write-Host "      OK: PostgreSQL est en cours d'execution (port 5433)" -ForegroundColor Green
} else {
    Write-Host "      ATTENTION: Le service n'a pas demarre. Verifiez les logs." -ForegroundColor Yellow
    Write-Host "      Logs: C:\Program Files\PostgreSQL\18\data\log\" -ForegroundColor Yellow
}

# 3. Create Task Scheduler entry so PostgreSQL starts at every login (backup safety net)
Write-Host "[3/3] Ajout d'une tache planifiee de securite au demarrage..." -ForegroundColor White
$action   = New-ScheduledTaskAction -Execute "powershell.exe" `
            -Argument "-WindowStyle Hidden -Command `"Start-Service postgresql-x64-18`""
$trigger  = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

try {
    Register-ScheduledTask -TaskName "PostgreSQL-AutoStart-EscapeRoom" `
        -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
    Write-Host "      OK: Tache planifiee creee (s'execute au demarrage de session)" -ForegroundColor Green
} catch {
    Write-Host "      ATTENTION: Impossible de creer la tache — $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Configuration terminee avec succes !" -ForegroundColor Green
Write-Host ""
Write-Host "  PostgreSQL demarrera automatiquement a chaque boot." -ForegroundColor White
Write-Host "  Pour lancer le site, double-cliquez sur START_ALL.bat" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
pause

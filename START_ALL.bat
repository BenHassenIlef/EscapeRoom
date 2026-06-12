@echo off
title The Room - Escape Game

:: -------------------------------------------------------
::  Auto-request admin rights if not already elevated
:: -------------------------------------------------------
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo Demande des droits administrateur...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cls
echo.
echo  ================================================
echo    THE ROOM - ESCAPE GAME  ^|  Demarrage...
echo  ================================================
echo.

:: -------------------------------------------------------
::  STEP 1 — PostgreSQL
:: -------------------------------------------------------
echo  [1/2] Verification de PostgreSQL (port 5433)...

sc query postgresql-x64-18 | findstr /I "RUNNING" >nul 2>&1
if %errorLevel% EQU 0 (
    echo        OK - PostgreSQL est deja en cours d'execution.
) else (
    echo        Demarrage du service PostgreSQL...
    net start postgresql-x64-18 >nul 2>&1
    timeout /t 4 /nobreak >nul
    sc query postgresql-x64-18 | findstr /I "RUNNING" >nul 2>&1
    if %errorLevel% EQU 0 (
        echo        OK - PostgreSQL demarre avec succes.
    ) else (
        echo.
        echo  [ERREUR] PostgreSQL n'a pas pu demarrer.
        echo  Consultez les logs : C:\Program Files\PostgreSQL\18\data\log\
        echo.
        pause
        exit /b 1
    )
)

:: -------------------------------------------------------
::  STEP 2 — Node.js backend
:: -------------------------------------------------------
echo.
echo  [2/2] Demarrage du backend Node.js...
echo.
echo  ================================================
echo    Serveur: http://localhost:8081
echo    Admin  : ouvrir admin.html dans le navigateur
echo    Quitter: fermer cette fenetre
echo  ================================================
echo.

cd /d "c:\Users\LENOVO\Desktop\escape - Copie"
npm start

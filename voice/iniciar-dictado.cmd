@echo off
title Asistente de Dictado Local
setlocal
cd /d "%~dp0"
echo ========================================================
echo   Iniciando Asistente de Dictado por Voz Local
echo ========================================================
.\.venv\Scripts\python.exe dictation\app.py %*
pause

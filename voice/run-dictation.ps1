$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Write-Output "Iniciando Asistente de Dictado por Voz Local..."
& "$PSScriptRoot/.venv/Scripts/python.exe" "$PSScriptRoot/dictation/app.py" @args

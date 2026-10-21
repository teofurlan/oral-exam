<#
.SYNOPSIS
    Create (or remove) a "Socra" shortcut that opens agent mode with one click.

.DESCRIPTION
    The shortcut runs `pythonw -m socra_server --agent` from this folder's
    virtual environment, so no console window stays open. If Socra is already
    running (for example as an exam MCP server), it only opens the agent page.
    Output that has no console goes to server/logs/socra-agent.log.

.PARAMETER Destination
    Folder for Socra.lnk. Defaults to the current user's desktop.

.PARAMETER Remove
    Delete the shortcut instead of creating it.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File server\install-shortcut.ps1
#>
param(
    [string]$Destination = [Environment]::GetFolderPath('Desktop'),
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$serverDir = $PSScriptRoot
$shortcutPath = Join-Path $Destination 'Socra.lnk'

if ($Remove) {
    if (Test-Path -LiteralPath $shortcutPath) {
        Remove-Item -LiteralPath $shortcutPath
        Write-Output "Removed $shortcutPath"
    } else {
        Write-Output "No shortcut at $shortcutPath"
    }
    return
}

$pythonw = Join-Path $serverDir '.venv\Scripts\pythonw.exe'
if (-not (Test-Path -LiteralPath $pythonw)) {
    throw "Missing $pythonw. Create the environment first: cd server; uv sync"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $pythonw
$shortcut.Arguments = '-m socra_server --agent'
$shortcut.WorkingDirectory = $serverDir
$shortcut.Description = 'Socra: work on a folder by voice'
$shortcut.Save()

Write-Output "Created $shortcutPath"

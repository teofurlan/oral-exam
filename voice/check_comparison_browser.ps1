$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-Location $PSScriptRoot
$browser = @(
    "${env:ProgramFiles(x86)}/Microsoft/Edge/Application/msedge.exe",
    "$env:ProgramFiles/Microsoft/Edge/Application/msedge.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) { Write-Error 'Browser check unavailable: Microsoft Edge executable was not found.'; exit 2 }
$output = Join-Path $PSScriptRoot 'comparison/checks'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$page = ([System.Uri](Join-Path $PSScriptRoot 'comparison/index.html')).AbsoluteUri
foreach ($viewport in @(@{name='desktop';size='1440,1000'}, @{name='mobile';size='390,844'})) {
    $image = Join-Path $output ($viewport.name + '.png')
    $profile = Join-Path $PSScriptRoot ('.browser-check/' + $viewport.name)
    $arguments = @('--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--disable-sync', '--hide-scrollbars', '--virtual-time-budget=1500', "--user-data-dir=$profile", "--screenshot=$image", "--window-size=$($viewport.size)", $page)
    $process = Start-Process -FilePath $browser -ArgumentList $arguments -Wait -PassThru
    if ($process.ExitCode -ne 0) { exit $process.ExitCode }
    if (-not (Test-Path -LiteralPath $image)) { throw "Screenshot missing: $image" }
    Write-Output "CAPTURED: $image"
}
Write-Output 'PASS: local listening page rendered at desktop and mobile viewport sizes.'

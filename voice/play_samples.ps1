$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Add-Type -AssemblyName System
$played = @()
foreach ($voice in @('ef_dora', 'em_alex')) {
    $path = Join-Path $PSScriptRoot "samples/$voice.wav"
    if (-not (Test-Path -LiteralPath $path)) { throw "Missing WAV: $path" }
    Write-Output "PLAYING: $voice"
    $player = New-Object System.Media.SoundPlayer $path
    try {
        $player.Load()
        $player.PlaySync()
        $played += $voice
        Write-Output "PLAYBACK_RETURNED: $voice"
    }
    finally { $player.Dispose() }
}
[pscustomobject]@{
    voices = $played
    playback_api = 'System.Media.SoundPlayer.PlaySync'
    completed_at = (Get-Date).ToString('o')
    audible_quality_verified = $false
    note = 'Playback calls completed; human confirmation is required for audibility and quality.'
} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'playback-results.json')

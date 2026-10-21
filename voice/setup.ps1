$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-Location $PSScriptRoot
$env:UV_CACHE_DIR = Join-Path $PSScriptRoot '.cache/uv'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $PSScriptRoot '.python'
$env:UV_PYTHON_DOWNLOADS = 'automatic'
$env:PYTHONUTF8 = '1'
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:HF_HOME = Join-Path $PSScriptRoot '.cache/huggingface'
$env:TMP = Join-Path $PSScriptRoot '.tmp'
$env:TEMP = $env:TMP
New-Item -ItemType Directory -Force -Path $env:TMP, 'models' | Out-Null
uv venv --python 3.12 .venv
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
uv pip install --python .venv/Scripts/python.exe kokoro-onnx soundfile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
uv pip freeze --python .venv/Scripts/python.exe | Out-File -Encoding utf8 requirements-resolved.txt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
foreach ($file in @('kokoro-v1.0.onnx', 'voices-v1.0.bin')) {
    $target = Join-Path $PSScriptRoot "models/$file"
    Write-Output "Downloading $file from the upstream model release"
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/$file" -OutFile $target -TimeoutSec 180
    if ((Get-Item $target).Length -eq 0) { throw "Empty download: $file" }
    Get-FileHash -Algorithm SHA256 $target | Format-List
}
Write-Output 'PASS: isolated environment and model files are ready.'

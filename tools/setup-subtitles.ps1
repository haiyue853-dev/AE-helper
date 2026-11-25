$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtime = Join-Path $workspace 'runtime\subtitles'
$pythonDir = Join-Path $runtime 'python'
$cache = Join-Path $runtime 'cache'
New-Item -ItemType Directory -Path $pythonDir,$cache -Force | Out-Null
$python = Join-Path $pythonDir 'python.exe'
if (!(Test-Path -LiteralPath $python)) {
    $archive = Join-Path $cache 'python-3.12.10-embed-amd64.zip'
    Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip' -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $pythonDir -Force
}
[IO.File]::WriteAllText((Join-Path $pythonDir 'python312._pth'), "python312.zip`n.`nLib/site-packages`nimport site`n", [Text.UTF8Encoding]::new($false))
if (!(Test-Path -LiteralPath (Join-Path $pythonDir 'Lib\site-packages\faster_whisper'))) {
    $getPip = Join-Path $cache 'get-pip.py'
    Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $getPip
    & $python $getPip --disable-pip-version-check --cache-dir (Join-Path $cache 'pip')
    if ($LASTEXITCODE) { throw '字幕环境的 pip 安装失败。' }
    & $python -m pip install --disable-pip-version-check --cache-dir (Join-Path $cache 'pip') 'faster-whisper==1.2.1' 'av==16.1.0'
    if ($LASTEXITCODE) { throw '本地字幕依赖安装失败。' }
}
$env:HF_HOME = Join-Path $cache 'huggingface'
$env:HF_HUB_DISABLE_TELEMETRY = '1'
$env:HF_HUB_DISABLE_XET = '1'
$model = Join-Path $workspace 'models\whisper-cpp'
& $python -c 'import sys; from huggingface_hub import hf_hub_download; [hf_hub_download("ggerganov/whisper.cpp", name, local_dir=sys.argv[1]) for name in ("ggml-large-v3-q5_0.bin", "ggml-small-q5_1.bin")]; print("Local subtitle models ready")' $model
if ($LASTEXITCODE) { throw '本地字幕模型下载失败。' }
if (!(Test-Path -LiteralPath (Join-Path $runtime 'universal\YueHaiAsr.exe'))) { throw '缺少随助手提供的 universal 识别引擎，请复制完整的 runtime/subtitles/universal 文件夹。' }
Write-Host '本地字幕环境准备完成。'

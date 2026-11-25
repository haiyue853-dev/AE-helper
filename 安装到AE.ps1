$ErrorActionPreference = 'Stop'
if (Get-Process -Name AfterFX -ErrorAction SilentlyContinue) {
    throw '请先关闭 After Effects，再运行安装。'
}
$source = Join-Path $PSScriptRoot 'YueHaiAssistant'
if (!(Test-Path -LiteralPath (Join-Path $source 'CSXS\manifest.xml'))) { throw '没有找到完整的 YueHaiAssistant 扩展目录。' }
$extensions = [System.IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\CEP\extensions'))
$destination = [System.IO.Path]::GetFullPath((Join-Path $extensions 'YueHaiAssistant'))
if ($destination -ne (Join-Path $extensions 'YueHaiAssistant')) { throw '安装路径验证失败。' }
if (Test-Path -LiteralPath $destination) {
    $existingManifest = Join-Path $destination 'CSXS\manifest.xml'
    if (!(Test-Path -LiteralPath $existingManifest)) { throw '目标位置存在其他文件，请自行检查 YueHaiAssistant 文件夹。' }
    [xml]$existing = Get-Content -LiteralPath $existingManifest -Raw
    if ($existing.ExtensionManifest.ExtensionBundleId -ne 'com.yuehai.assistant') { throw '目标位置不是 YueHai助手，停止安装。' }
    $backupRoot = Join-Path $PSScriptRoot 'artifacts\扩展备份'
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backup = Join-Path $backupRoot ('YueHaiAssistant-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff'))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    Get-ChildItem -LiteralPath $destination -Force | Where-Object Name -ne 'assets' | Copy-Item -Destination $backup -Recurse
    Write-Host "旧版本已备份：$backup"
}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Get-ChildItem -LiteralPath $source -Force | Where-Object Name -ne 'assets' | Copy-Item -Destination $destination -Recurse -Force
$sourceAssets = [IO.Path]::GetFullPath((Join-Path $source 'assets'))
$destinationAssets = [IO.Path]::GetFullPath((Join-Path $destination 'assets'))
if (!(Test-Path -LiteralPath $destinationAssets)) {
    New-Item -ItemType Junction -Path $destinationAssets -Target $sourceAssets | Out-Null
} elseif ((Get-Item -LiteralPath $destinationAssets).LinkType -ne 'Junction') {
    $assetBackup = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ('artifacts\旧扩展素材-' + (Get-Date -Format 'yyyyMMdd-HHmmssfff'))))
    $workspaceRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
    if (!$assetBackup.StartsWith($workspaceRoot, [StringComparison]::OrdinalIgnoreCase)) { throw '素材备份路径验证失败。' }
    New-Item -ItemType Directory -Path (Split-Path $assetBackup) -Force | Out-Null
    Move-Item -LiteralPath $destinationAssets -Destination $assetBackup
    New-Item -ItemType Junction -Path $destinationAssets -Target $sourceAssets | Out-Null
}
$previewSettings = @{ storageRoot = (Join-Path $PSScriptRoot '预览素材').Replace('\','/'); defaultImage = (Join-Path $PSScriptRoot '预览图.jpg').Replace('\','/') }
[IO.File]::WriteAllText((Join-Path $destination 'preview-settings.json'), ($previewSettings | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
$subtitleSettings = @{ workspaceRoot = $PSScriptRoot.Replace('\','/'); python = 'runtime/subtitles/python/python.exe'; model = 'models/faster-whisper-small'; nativeEngine = 'runtime/subtitles/universal/YueHaiAsr.exe' }
[IO.File]::WriteAllText((Join-Path $destination 'subtitle-settings.json'), ($subtitleSettings | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
foreach ($version in 9..12) {
    $registry = "HKCU:\Software\Adobe\CSXS.$version"
    New-Item -Path $registry -Force | Out-Null
    New-ItemProperty -Path $registry -Name PlayerDebugMode -Value '1' -PropertyType String -Force | Out-Null
}
Write-Host ''
Write-Host 'YueHai助手安装完成。' -ForegroundColor Green
Write-Host "安装位置：$destination"
Write-Host '重新打开 AE，在「窗口 → 扩展 → YueHai助手」中打开。'

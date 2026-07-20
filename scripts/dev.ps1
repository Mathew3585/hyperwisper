# Dev launcher: sets CMake + LLVM + Vulkan SDK env vars and a short
# CARGO_TARGET_DIR so the whisper.cpp + ggml-vulkan build stays under
# Windows MAX_PATH. Run with:
#   powershell -ExecutionPolicy Bypass -File scripts\dev.ps1

$ErrorActionPreference = "Stop"

$cmakeBin = "C:\Program Files\CMake\bin"
$llvmBin = "C:\Program Files\LLVM\bin"

$vulkanDir = Get-ChildItem "C:\VulkanSDK" -Directory -ErrorAction SilentlyContinue |
             Sort-Object Name -Descending | Select-Object -First 1
$vulkanRoot = if ($vulkanDir) { $vulkanDir.FullName } else { $null }

if (-not (Test-Path "$cmakeBin\cmake.exe")) {
    Write-Error "CMake not found. Install with: winget install Kitware.CMake"
}
if (-not (Test-Path "$llvmBin\libclang.dll")) {
    Write-Error "LLVM not found. Install with: winget install LLVM.LLVM"
}
if (-not $vulkanRoot) {
    Write-Error "Vulkan SDK not found. Install with: winget install KhronosGroup.VulkanSDK"
}

Write-Host "[dev] CMake     $cmakeBin"
Write-Host "[dev] LLVM      $llvmBin"
Write-Host "[dev] Vulkan    $vulkanRoot"

$vulkanBin = Join-Path $vulkanRoot "Bin"

$env:PATH = "${cmakeBin};${llvmBin};${vulkanBin};${env:PATH}"
$env:LIBCLANG_PATH = $llvmBin
$env:VULKAN_SDK = $vulkanRoot
$env:CARGO_TARGET_DIR = "D:\h"

if (-not (Test-Path $env:CARGO_TARGET_DIR)) {
    New-Item -ItemType Directory -Path $env:CARGO_TARGET_DIR | Out-Null
}

Write-Host "[dev] CARGO_TARGET_DIR  $env:CARGO_TARGET_DIR"
Write-Host "[dev] Launching pnpm tauri:dev"

Set-Location (Join-Path $PSScriptRoot "..")
pnpm tauri:dev

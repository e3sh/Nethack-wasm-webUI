# NetHack 5.0 WebAssembly Build Script via WSL2
# Bypasses Windows Smart App Control Binaryen blocks by compiling natively in Ubuntu

param(
    [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

$SCRIPT_DIR = (Resolve-Path "$PSScriptRoot").Path
$WSL_SCRIPT = "$SCRIPT_DIR/build_wasm_50_wsl.sh"
$clean_script = $WSL_SCRIPT.Replace('\', '/')
$drive_letter = $clean_script.Substring(0, 1).ToLower()
$rest_path = $clean_script.Substring(2)
$WSL_SCRIPT_PATH = "/mnt/$drive_letter$rest_path"

Write-Host "=== Launching NetHack 5.0 WASM Build in WSL2 ($Distro) ==="
Write-Host "WSL Script: $WSL_SCRIPT_PATH"

wsl -d $Distro bash -c "chmod +x `"$WSL_SCRIPT_PATH`" && `"$WSL_SCRIPT_PATH`""

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== Build Completed Successfully via WSL2! ==="
} else {
    Write-Error "WSL2 Build failed with exit code $LASTEXITCODE"
}

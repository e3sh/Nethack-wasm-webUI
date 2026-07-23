# NetHack 3.7 WebAssembly Build Script for Windows
# Following the Cross-compiling guide in NetHack 3.7

$ErrorActionPreference = "Stop"

$BASE_ROOT = $PWD
$NH_ROOT = Join-Path $BASE_ROOT "NetHack-NetHack-3.7"
$EMSDK_PATH = "C:\Users\e3-sh\Documents\GitHub\emsdk"
$VCVARS_PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat"

# 1. Setup Environments
Write-Host "--- Setting up environments ---"
if (Test-Path "$EMSDK_PATH\emsdk_env.ps1") {
    & "$EMSDK_PATH\emsdk_env.ps1"
}
else {
    Write-Error "Emscripten SDK not found at $EMSDK_PATH"
}

if (!(Get-Command cl -ErrorAction SilentlyContinue)) {
    Write-Host "Activating MSVC..."
    $vcvars_cmd = "`"$VCVARS_PATH`" x64 && set"
    $env_vars = cmd /c $vcvars_cmd
    foreach ($line in $env_vars) {
        if ($line -match "^(.*?)=(.*)$") {
            $name = $Matches[1]
            $value = $Matches[2]
            if ($name -ne "" -and $name -notmatch " ") {
                Set-Item "env:$name" $value
            }
        }
    }
}

cd $NH_ROOT

# 2. Build Host Utilities (makedefs)
Write-Host "--- Step 1: Building makedefs (Host) ---"
$makedefs_src = @(
    "util/makedefs.c",
    "src/monst.c",
    "src/objects.c",
    "src/date.c",
    "src/alloc.c",
    "util/panic.c",
    "src/hacklib.c"
)
cl /O2 /Iinclude /Ilib/lua-5.4.8/src /DCROSSCOMPILE /Fimakedefs.exe $makedefs_src /link /out:util/makedefs.exe

# 3. Generate data files
Write-Host "--- Step 2: Generating data files ---"
if (Test-Path "util/makedefs.exe") {
    Push-Location util
    .\makedefs.exe -d
    .\makedefs.exe -r
    .\makedefs.exe -h
    .\makedefs.exe -s
    .\makedefs.exe -o
    Pop-Location
    if (Test-Path "$BASE_ROOT/dat/data") {
        Copy-Item "$BASE_ROOT/dat/*" "dat/" -Force
    }
}
else {
    Write-Error "makedefs.exe was not built successfully."
}

# 4. Build Wasm Lua
Write-Host "--- Step 3: Building Lua (Wasm) ---"
$LUA_VERSION = "5.4.8"
$LUA_SRC_DIR = "lib/lua-$LUA_VERSION/src"
if (!(Test-Path $LUA_SRC_DIR)) {
    Write-Error "Lua source not found at $LUA_SRC_DIR."
}

$lua_src_files = Get-ChildItem "$LUA_SRC_DIR/*.c" | Where-Object { $_.Name -notmatch "lua.c|luac.c" } 
$lua_src_files | ForEach-Object { "`"$($_.FullName)`"" } | Out-File -FilePath lua_files.rsp -Encoding ascii

emcc -O3 -c "@lua_files.rsp" -I$LUA_SRC_DIR

$lua_obj_files = Get-ChildItem "*.o" | ForEach-Object { $_.Name }
if (Test-Path "liblua.a") { Remove-Item "liblua.a" }
foreach ($obj in $lua_obj_files) {
    & emar r liblua.a $obj
}
& emar s liblua.a
Remove-Item *.o

# 5. Build NetHack Wasm
Write-Host "--- Step 4: Building NetHack (Wasm) ---"
$nethack_src = Get-ChildItem "src/*.c" | ForEach-Object { $_.FullName }
$wasm_sys_src = @(
    "sys/libnh/libnhmain.c",
    "sys/share/ioctl.c",
    "sys/share/unixtty.c",
    "sys/share/pmatchregex.c",
    "sys/unix/unixunix.c",
    "sys/unix/unixres.c",
    "win/shim/winshim.c"
)
$all_src = $nethack_src + $wasm_sys_src
$all_src | ForEach-Object { "`"$_`"" } | Out-File -FilePath nethack_files.rsp -Encoding ascii

$emcc_flags = @(
    "-O2",
    "-Iinclude",
    "-Ilib/lua-5.4.8/src",
    "-DCROSSCOMPILE",
    "-DCROSSCOMPILE_TARGET",
    "-DCROSS_TO_WASM",
    "-DNOTTYGRAPHICS",
    "-DSHIM_GRAPHICS",
    "-DLIBNH",
    "-DNOMAIL",
    "-DNO_SIGNAL",
    "-sASYNCIFY=1",
    "-sASYNCIFY_IMPORTS=['local_callback']",
    "-sEXPORTED_FUNCTIONS=['_main','_shim_graphics_set_callback','_repopulate_perminvent','_malloc','_get_plname']",
    "-sEXPORTED_RUNTIME_METHODS=['cwrap','ccall','addFunction','UTF8ToString','stringToUTF8','getValue','setValue','FS','IDBFS']",
    "-lidbfs.js",
    "-sALLOW_TABLE_GROWTH=1",
    "-sALLOW_MEMORY_GROWTH=1",
    "-sERROR_ON_UNDEFINED_SYMBOLS=0"
)
$emcc_flags | Out-File -FilePath nethack_flags.rsp -Encoding ascii

# Step 5: Final Link with embedded files
Write-Host "--- Step 5: Linking and Packaging ---"
emcc "@nethack_files.rsp" "liblua.a" "@nethack_flags.rsp" -o nethack.js --embed-file dat@/

Write-Host "Build Complete!"

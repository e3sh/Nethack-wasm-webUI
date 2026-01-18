#!/bin/bash
# NetHack 3.7 WebAssembly Build Script for Linux/WSL
set -e

NH_ROOT=$(pwd)
LUA_VERSION="5.4.8"
LUA_SRC_DIR="lib/lua-$LUA_VERSION/src"

echo "--- Step 1: Building makedefs (Host) ---"
MAKEDEFS_SRC="util/makedefs.c src/monst.c src/objects.c src/date.c src/alloc.c util/panic.c src/hacklib.c"
gcc -O2 -Iinclude -I$LUA_SRC_DIR -DCROSSCOMPILE -o util/makedefs $MAKEDEFS_SRC

echo "--- Step 2: Generating data files ---"
if [ -f "util/makedefs" ]; then
    cd util
    ./makedefs -d
    ./makedefs -r
    ./makedefs -h
    ./makedefs -s
    ./makedefs -o
    cd ..
else
    echo "makedefs was not built successfully."
    exit 1
fi

echo "--- Step 3: Building Lua (Wasm) ---"
LUA_FILES=$(ls $LUA_SRC_DIR/*.c | grep -vE "lua.c|luac.c")
emcc -O3 -c $LUA_FILES -I$LUA_SRC_DIR

if [ -f "liblua.a" ]; then rm liblua.a; fi
emar r liblua.a *.o
emar s liblua.a
rm *.o

echo "--- Step 4: Building NetHack (Wasm) ---"
NETHACK_SRC=$(ls src/*.c)
WASM_SYS_SRC="sys/libnh/libnhmain.c sys/share/ioctl.c sys/share/unixtty.c sys/share/pmatchregex.c sys/unix/unixunix.c sys/unix/unixres.c win/shim/winshim.c"

EMCC_FLAGS=(
    "-O2"
    "-Iinclude"
    "-I$LUA_SRC_DIR"
    "-DCROSSCOMPILE"
    "-DCROSSCOMPILE_TARGET"
    "-DCROSS_TO_WASM"
    "-DNOTTYGRAPHICS"
    "-DSHIM_GRAPHICS"
    "-DLIBNH"
    "-DNOMAIL"
    "-DNO_SIGNAL"
    "-sASYNCIFY=1"
    "-sASYNCIFY_IMPORTS=['local_callback']"
    "-sEXPORTED_FUNCTIONS=['_main','_shim_graphics_set_callback','_repopulate_perminvent','_malloc','_get_plname']"
    "-sEXPORTED_RUNTIME_METHODS=['cwrap','ccall','addFunction','UTF8ToString','stringToUTF8','getValue','setValue','FS','IDBFS']"
    "-lidbfs.js"
    "-sALLOW_TABLE_GROWTH=1"
    "-sALLOW_MEMORY_GROWTH=1"
    "-sERROR_ON_UNDEFINED_SYMBOLS=0"
)

echo "--- Step 5: Linking and Packaging ---"
emcc "${EMCC_FLAGS[@]}" $NETHACK_SRC $WASM_SYS_SRC liblua.a -o nethack.js --embed-file dat@/

echo "Build Complete!"

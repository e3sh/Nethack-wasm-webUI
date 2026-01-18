# NetHack 3.7 WebAssembly Makefile (for Linux/WSL)

# Tools
CC = gcc
EMCC = emcc
EMAR = emar

# Paths
LUA_VERSION = 5.4.8
LUA_DIR = lib/lua-$(LUA_VERSION)/src
DAT_DIR = dat
UTIL_DIR = util
SRC_DIR = src
SYS_DIR = sys
WIN_DIR = win/shim

# Flags
# Host flags (for makedefs)
HOST_CFLAGS = -O2 -Iinclude -I$(LUA_DIR) -DCROSSCOMPILE

# Wasm flags
EMCC_CFLAGS = -O2 -Iinclude -I$(LUA_DIR) \
    -DCROSSCOMPILE -DCROSSCOMPILE_TARGET -DCROSS_TO_WASM \
    -DNOTTYGRAPHICS -DSHIM_GRAPHICS -DLIBNH -DNOMAIL -DNO_SIGNAL

EMCC_LDFLAGS = -sASYNCIFY=1 \
    -sASYNCIFY_IMPORTS="['local_callback']" \
    -sEXPORTED_FUNCTIONS="['_main','_shim_graphics_set_callback','_repopulate_perminvent','_malloc','_get_plname']" \
    -sEXPORTED_RUNTIME_METHODS="['cwrap','ccall','addFunction','UTF8ToString','stringToUTF8','getValue','setValue','FS','IDBFS']" \
    -lidbfs.js \
    -sALLOW_TABLE_GROWTH=1 \
    -sALLOW_MEMORY_GROWTH=1 \
    -sERROR_ON_UNDEFINED_SYMBOLS=0

# Sources
MAKEDEFS_SRC = $(UTIL_DIR)/makedefs.c $(SRC_DIR)/monst.c $(SRC_DIR)/objects.c \
               $(SRC_DIR)/date.c $(SRC_DIR)/alloc.c $(UTIL_DIR)/panic.c $(SRC_DIR)/hacklib.c

# Lua sources (exclude lua.c and luac.c)
LUA_SRC = $(filter-out $(LUA_DIR)/lua.c $(LUA_DIR)/luac.c, $(wildcard $(LUA_DIR)/*.c))

# NetHack sources
NETHACK_SRC = $(wildcard $(SRC_DIR)/*.c)
WASM_SYS_SRC = sys/libnh/libnhmain.c \
               sys/share/ioctl.c \
               sys/share/unixtty.c \
               sys/share/pmatchregex.c \
               sys/unix/unixunix.c \
               sys/unix/unixres.c \
               win/shim/winshim.c
ALL_SRC = $(NETHACK_SRC) $(WASM_SYS_SRC)

# Targets
.PHONY: all clean data_files lua_lib nethack

all: nethack.js

# Build Host Utilities (makedefs)
$(UTIL_DIR)/makedefs: $(MAKEDEFS_SRC)
	$(CC) $(HOST_CFLAGS) -o $@ $^

# Generate data files
data_files: $(UTIL_DIR)/makedefs
	cd $(UTIL_DIR) && ./makedefs -d
	cd $(UTIL_DIR) && ./makedefs -r
	cd $(UTIL_DIR) && ./makedefs -h
	cd $(UTIL_DIR) && ./makedefs -s
	cd $(UTIL_DIR) && ./makedefs -o

# Build Lua (Wasm)
lua_lib: liblua.a

liblua.a: $(LUA_SRC)
	$(EMCC) -O3 -c $(LUA_SRC) -I$(LUA_DIR)
	$(EMAR) r liblua.a *.o
	$(EMAR) s liblua.a
	rm *.o

# Build NetHack (Wasm)
nethack.js: $(ALL_SRC) liblua.a data_files
	$(EMCC) $(EMCC_CFLAGS) $(ALL_SRC) liblua.a $(EMCC_LDFLAGS) -o nethack.js --embed-file dat@/

clean:
	rm -f $(UTIL_DIR)/makedefs liblua.a nethack.js nethack.wasm *.o
	rm -f dat/data dat/rumors dat/oracles dat/dungeon dat/options

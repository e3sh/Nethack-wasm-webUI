#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_tilemappings.py
docs/5_gamedata/tilemappings.lst から全 383 モンスター (mnum) と 全 481 オブジェクト (onum) の
正式名称テーブルを抽出し、src/core/knowledge/tilemappings_data.js を生成するスクリプト
"""

import os
import re
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

LST_PATH = os.path.join(PROJECT_ROOT, "docs", "5_gamedata", "tilemappings.lst")
OUTPUT_JS_PATH = os.path.join(PROJECT_ROOT, "src", "core", "knowledge", "tilemappings_data.js")

def extract_mappings():
    if not os.path.exists(LST_PATH):
        print(f"Error: {LST_PATH} not found!")
        return

    monsters = {} # mnum -> name
    objects = {}  # onum -> name

    # 1. glyph[0000] [0000] male giant ant (mnum=0)
    mon_pattern = re.compile(r'glyph\[\d+\]\s+\[\d+\]\s+(?:male|female)?\s*(.*?)\s*\(mnum=(\d+)\)')
    
    # 2. glyph[3448] [0789] strange object (onum=0)
    obj_pattern = re.compile(r'glyph\[\d+\]\s+\[\d+\]\s*(.*?)\s*\(onum=(\d+)\)')

    with open(LST_PATH, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = line.strip()
            
            mon_match = mon_pattern.search(line)
            if mon_match:
                name = mon_match.group(1).strip()
                mnum = int(mon_match.group(2))
                if mnum not in monsters:
                    monsters[mnum] = name
                continue

            obj_match = obj_pattern.search(line)
            if obj_match:
                name = obj_match.group(1).strip()
                onum = int(obj_match.group(2))
                if onum not in objects:
                    objects[onum] = name
                continue

    print(f"Extracted {len(monsters)} monsters and {len(objects)} objects from tilemappings.lst")

    # JS モジュール出力
    js_content = f"""/**
 * tilemappings_data.js
 * docs/5_gamedata/tilemappings.lst (Single Source of Truth) より自動抽出
 * 全 {len(monsters)} モンスター (mnum) ＆ 全 {len(objects)} オブジェクト (onum) 公式名称テーブル
 */

export const MONSTER_TILEMAP_NAMES = {json.dumps(monsters, indent=4, ensure_ascii=False)};

export const OBJECT_TILEMAP_NAMES = {json.dumps(objects, indent=4, ensure_ascii=False)};
"""

    with open(OUTPUT_JS_PATH, 'w', encoding='utf-8') as f:
        f.write(js_content)

    print(f"Successfully generated {OUTPUT_JS_PATH}")

if __name__ == "__main__":
    extract_mappings()

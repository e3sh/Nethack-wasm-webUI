#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_entity_matching.py - 噂話・神託とエンティティのマッチング検証スクリプト
"""

import re
import json
from pathlib import Path

WORKSPACE = Path(r"c:\Users\e3-sh\Documents\GitHub\Nethack-wasm-webUI")

def load_js_map(file_path, var_name):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    m = re.search(r"export const " + var_name + r" = (\{.*?\});\s*$", content, re.DOTALL)
    if not m:
        raise ValueError(f"Could not find {var_name} in {file_path}")
    return json.loads(m.group(1))

def main():
    mon_data = load_js_map(WORKSPACE / "src/core/knowledge/data/MONSTER_JP_MAP.js", "MONSTER_JP_MAP")
    obj_data = load_js_map(WORKSPACE / "src/core/knowledge/data/OBJECT_JP_MAP.js", "OBJECT_JP_MAP")
    
    monsters = mon_data.get("monsters", {})
    objects = obj_data.get("objects", {})

    print(f"Loaded {len(monsters)} monsters, {len(objects)} objects.")

    # 噂話マスタの読み込み
    with open(WORKSPACE / "src/core/lore/data/LoreMasterData.js", "r", encoding="utf-8") as f:
        master_content = f.read()
    
    # RUMORS の抽出
    m_rumors = re.search(r"export const RUMORS = (\[.*?\]);\s*\n\s*export const ORACLES", master_content, re.DOTALL)
    if not m_rumors:
        print("Failed to find RUMORS")
        return
    rumors = json.loads(m_rumors.group(1))
    print(f"Loaded {len(rumors)} rumors.")

    # サンプル検証
    sample_tests = [
        "A blindfold can be very useful if you're telepathic.",
        "A katana might slice a worm in two.",
        "Medusa is ugly enough to turn herself to stone.",
        "A crystal plate mail will not rust.",
        "A cream pie has two uses: food... and entertainment.",
        "Seven candles can be attached to the candelabrum."
    ]

    for s in sample_tests:
        print(f"\n--- Testing: {s} ---")
        # Monster search
        for m_en, m_ja in monsters.items():
            clean_m = re.sub(r"\{.*?\}", "", m_en).strip().lower()
            if len(clean_m) >= 4 and re.search(r"\b" + re.escape(clean_m) + r"s?\b", s, re.IGNORECASE):
                print(f"  [MONSTER] {clean_m} ({m_ja})")
        # Object search
        for o_en, o_ja in objects.items():
            clean_o = re.sub(r"\{.*?\}", "", o_en).strip().lower()
            if clean_o.startswith("generic "):
                continue
            if len(clean_o) >= 4 and re.search(r"\b" + re.escape(clean_o) + r"s?\b", s, re.IGNORECASE):
                print(f"  [ITEM] {clean_o} ({o_ja})")

if __name__ == "__main__":
    main()

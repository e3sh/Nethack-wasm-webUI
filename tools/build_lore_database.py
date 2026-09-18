#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_lore_database.py

NetHack 5.0 の伝承・環境データ（rumors.tru, rumors.fal, oracles.txt）を抽出し、
既存の翻訳辞書 (dictionary.csv) と多層照合して、
WebUI コレクション・シグナル検知用 SSOT マスタ (src/core/lore/data/LoreMasterData.js) を生成する。
"""

import os
import csv
import json
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
ORG_NETHACK_DIR = Path(r"c:\Users\e3-sh\Desktop\works\NetHack-NetHack-5.0_org\NetHack-NetHack-5.0")
DAT_DIR = ORG_NETHACK_DIR / "dat"
DICT_PATH = WORKSPACE_ROOT / "dictionary.csv"
OUTPUT_DIR = WORKSPACE_ROOT / "src" / "core" / "lore" / "data"
OUTPUT_JS_PATH = OUTPUT_DIR / "LoreMasterData.js"

def load_dictionary(dict_path):
    dict_map = {}
    if not dict_path.exists():
        print(f"[WARN] Dictionary not found: {dict_path}")
        return dict_map

    with open(dict_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        try:
            next(reader)  # skip header
        except StopIteration:
            return dict_map
        for row in reader:
            if len(row) >= 3:
                en = row[1].strip()
                jp = row[2].strip()
                if en and jp:
                    dict_map[en] = jp
                    # 正規化キーも保持
                    norm_en = " ".join(en.split())
                    dict_map[norm_en] = jp
    return dict_map

def build_rumors(dat_dir, dict_map):
    tru_path = dat_dir / "rumors.tru"
    fal_path = dat_dir / "rumors.fal"

    rumors = []

    if tru_path.exists():
        with open(tru_path, "r", encoding="utf-8", errors="ignore") as f:
            for idx, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                tr = dict_map.get(line) or dict_map.get(" ".join(line.split()), "")
                rumors.append({
                    "id": f"rumor_tru_{idx + 1}",
                    "text": line,
                    "translatedText": tr,
                    "isTrue": True,
                    "category": "RUMOR",
                    "subCategory": "TRUE_RUMOR"
                })

    if fal_path.exists():
        with open(fal_path, "r", encoding="utf-8", errors="ignore") as f:
            for idx, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                tr = dict_map.get(line) or dict_map.get(" ".join(line.split()), "")
                rumors.append({
                    "id": f"rumor_fal_{idx + 1}",
                    "text": line,
                    "translatedText": tr,
                    "isTrue": False,
                    "category": "RUMOR",
                    "subCategory": "FALSE_RUMOR"
                })

    return rumors

def build_oracles(dat_dir, dict_map):
    oracles_path = dat_dir / "oracles.txt"
    if not oracles_path.exists():
        return []

    with open(oracles_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    passages = [p.strip() for p in content.split("-----") if p.strip()]
    oracles = []

    for idx, passage in enumerate(passages):
        norm_passage = " ".join(passage.split())
        tr = dict_map.get(passage) or dict_map.get(norm_passage, "")
        if not tr:
            # 1行目照合
            first_line = passage.split("\n")[0].strip()
            tr = dict_map.get(first_line, "")

        # 先頭の数単語からタイトルを生成
        words = norm_passage.split()
        title = " ".join(words[:6]) + ("..." if len(words) > 6 else "")

        oracles.append({
            "id": f"oracle_{idx + 1}",
            "title": title,
            "text": passage,
            "normalizedText": norm_passage,
            "translatedText": tr,
            "category": "ORACLE",
            "isSpecial": (idx == 0) # 0番目は special oracle (cheapskate)
        })

    return oracles

def main():
    print(f"[build_lore_database] Loading dictionary from {DICT_PATH}...")
    dict_map = load_dictionary(DICT_PATH)
    print(f"[build_lore_database] Loaded {len(dict_map)} translations.")

    print(f"[build_lore_database] Building rumors from {DAT_DIR}...")
    rumors = build_rumors(DAT_DIR, dict_map)
    tru_cnt = sum(1 for r in rumors if r["isTrue"])
    fal_cnt = sum(1 for r in rumors if not r["isTrue"])
    tru_tr_cnt = sum(1 for r in rumors if r["isTrue"] and r["translatedText"])
    fal_tr_cnt = sum(1 for r in rumors if not r["isTrue"] and r["translatedText"])
    print(f"[build_lore_database] Rumors: {len(rumors)} total (True: {tru_cnt} [Tr: {tru_tr_cnt}], False: {fal_cnt} [Tr: {fal_tr_cnt}])")

    print(f"[build_lore_database] Building oracles from {DAT_DIR}...")
    oracles = build_oracles(DAT_DIR, dict_map)
    oracles_tr_cnt = sum(1 for o in oracles if o["translatedText"])
    print(f"[build_lore_database] Oracles: {len(oracles)} total [Tr: {oracles_tr_cnt}]")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    js_code = f"""/**
 * LoreMasterData.js - Layer 4: LORE & Collection SSOT Master Data
 *
 * Automatically generated by tools/build_lore_database.py
 * Total Rumors: {len(rumors)} (True: {tru_cnt}, False: {fal_cnt})
 * Total Oracles: {len(oracles)}
 */

export const RUMORS = {json.dumps(rumors, ensure_ascii=False, indent=2)};

export const ORACLES = {json.dumps(oracles, ensure_ascii=False, indent=2)};

export const LORE_MASTER = {{
    metadata: {{
        version: "5.0.0",
        generatedAt: "2026-09-18",
        rumorCount: {len(rumors)},
        trueRumorCount: {tru_cnt},
        falseRumorCount: {fal_cnt},
        oracleCount: {len(oracles)}
    }},
    rumors: RUMORS,
    oracles: ORACLES
}};

export default LORE_MASTER;
"""

    with open(OUTPUT_JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_code)

    print(f"[build_lore_database] Successfully generated {OUTPUT_JS_PATH} ({OUTPUT_JS_PATH.stat().st_size:,} bytes)")

if __name__ == "__main__":
    main()

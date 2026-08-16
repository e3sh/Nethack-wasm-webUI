#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_untranslated_entities_items.py

dictionary.csv 内の登録状況をチェックし、
tilemappings_data.js に定義されている全 384 モンスター (mnum) 
および全 481 アイテム (onum) の英語名について、
未登録・未翻訳のものが何件あるかを詳細に検出・集計する。
"""

import os
import re
import csv

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DICTIONARY_PATH = os.path.join(WORKSPACE_ROOT, 'dictionary.csv')
TILEMAP_DATA_PATH = os.path.join(WORKSPACE_ROOT, 'src', 'core', 'knowledge', 'tilemappings_data.js')

def parse_tilemappings():
    monsters = []
    objects = []
    
    with open(TILEMAP_DATA_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # MONSTER_TILEMAP_NAMES
    m_match = re.search(r'export const MONSTER_TILEMAP_NAMES = \{(.*?)\};', content, re.DOTALL)
    if m_match:
        m_text = m_match.group(1)
        for line in m_text.splitlines():
            line = line.strip()
            # "0": "giant ant",
            match = re.search(r'"(\d+)":\s*"(.*?)"', line)
            if match:
                mnum = int(match.group(1))
                name = match.group(2)
                monsters.append((mnum, name))
                
    # OBJECT_TILEMAP_NAMES
    o_match = re.search(r'export const OBJECT_TILEMAP_NAMES = \{(.*?)\};', content, re.DOTALL)
    if o_match:
        o_text = o_match.group(1)
        for line in o_text.splitlines():
            line = line.strip()
            match = re.search(r'"(\d+)":\s*"(.*?)"', line)
            if match:
                onum = int(match.group(1))
                name = match.group(2)
                objects.append((onum, name))
                
    return monsters, objects

def clean_name(name):
    # "dwarf leader {dwarf lord}" -> "dwarf leader"
    # "{potion of} clear" -> "clear" / "potion of clear"
    # "small shield / wooden shield" などスラッシュ区切りも含む
    clean = re.sub(r'\{.*?\}', '', name).strip()
    return clean

def load_dictionary(dict_path):
    dict_map = {} # source_lower -> (group, source_exact, translation)
    groups_count = {}
    
    if os.path.exists(dict_path):
        with open(dict_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            header = next(reader, None)
            for row in reader:
                if len(row) >= 3:
                    group = row[0].strip()
                    source = row[1].strip()
                    trans = row[2].strip()
                    if source:
                        dict_map[source.lower()] = (group, source, trans)
                        groups_count[group] = groups_count.get(group, 0) + 1
                        
    return dict_map, groups_count

def main():
    monsters, objects = parse_tilemappings()
    dict_map, groups_count = load_dictionary(DICTIONARY_PATH)
    
    print(f"=======================================================")
    print(f"Dictionary Summary: Total entries = {len(dict_map)}")
    for g, count in sorted(groups_count.items()):
        print(f"  Group '{g}': {count} entries")
    print(f"=======================================================\n")
    
    # 1. モンスター (Entity) チェック
    untranslated_monsters = []
    translated_monsters = []
    
    for mnum, raw_name in monsters:
        # クリーニング名と原文名の両方でチェック
        c_name = clean_name(raw_name)
        # 代表的なチェック対象名候補
        candidates = set([raw_name.lower(), c_name.lower()])
        # "{dwarf lord}" などの波括弧内の別名もチェック対象に入れる
        bracket_match = re.findall(r'\{(.*?)\}', raw_name)
        for b in bracket_match:
            candidates.add(b.lower())
            
        found = False
        trans_val = ""
        for cand in candidates:
            if cand in dict_map and dict_map[cand][2]: # 翻訳が空でない
                found = True
                trans_val = dict_map[cand][2]
                break
                
        if found:
            translated_monsters.append((mnum, raw_name, trans_val))
        else:
            untranslated_monsters.append((mnum, raw_name, c_name))
            
    # 2. アイテム (Item) チェック
    untranslated_objects = []
    translated_objects = []
    
    for onum, raw_name in objects:
        # スラッシュ分割の個別表記もチェック ("small shield / wooden shield")
        parts = [p.strip() for p in raw_name.split('/') if p.strip()]
        
        candidates = set([raw_name.lower()])
        for p in parts:
            candidates.add(p.lower())
            c_p = clean_name(p).lower()
            if c_p:
                candidates.add(c_p)
                
        found = False
        trans_val = ""
        for cand in candidates:
            if cand in dict_map and dict_map[cand][2]:
                found = True
                trans_val = dict_map[cand][2]
                break
                
        if found:
            translated_objects.append((onum, raw_name, trans_val))
        else:
            untranslated_objects.append((onum, raw_name, parts))

    print("--- 1. モンスター (Entity) 検索結果 ---")
    print(f"  全モンスター数: {len(monsters)} 件")
    print(f"  登録・翻訳済み: {len(translated_monsters)} 件")
    print(f"  未登録・未翻訳: {len(untranslated_monsters)} 件")
    print()

    print("--- 2. アイテム (Item) 検索結果 ---")
    print(f"  全アイテム数: {len(objects)} 件")
    print(f"  登録・翻訳済み: {len(translated_objects)} 件")
    print(f"  未登録・未翻訳: {len(untranslated_objects)} 件")
    print()
    print("=======================================================")
    print(f"合計未登録・未翻訳件数: {len(untranslated_monsters) + len(untranslated_objects)} 件")
    print("=======================================================\n")
    
    print(f"【未登録モンスター名一覧 (全 {len(untranslated_monsters)} 件)】")
    for mnum, raw_name, c_name in untranslated_monsters:
        print(f"  [mnum {mnum:3d}] Raw: '{raw_name}' | Clean: '{c_name}'")
        
    print(f"\n【未登録アイテム名一覧 (全 {len(untranslated_objects)} 件)】")
    for onum, raw_name, parts in untranslated_objects:
        print(f"  [onum {onum:3d}] Raw: '{raw_name}' | Parts: {parts}")


if __name__ == '__main__':
    main()

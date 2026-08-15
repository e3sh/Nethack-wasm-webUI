#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
merge_knowledge_dictionary.py
knowledge_dictionary.csv の内容を辞書マスター dictionary.csv へ自動合流 (Merge) するツール
"""

import os
import csv
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

MAIN_DICT_PATH = os.path.join(PROJECT_ROOT, "dictionary.csv")
KNOWLEDGE_DICT_PATH = os.path.join(PROJECT_ROOT, "knowledge_dictionary.csv")

def merge_knowledge_dict():
    if not os.path.exists(MAIN_DICT_PATH):
        print(f"Error: Main dictionary.csv not found at {MAIN_DICT_PATH}")
        return
    if not os.path.exists(KNOWLEDGE_DICT_PATH):
        print(f"Error: knowledge_dictionary.csv not found at {KNOWLEDGE_DICT_PATH}")
        return

    # 1. 既存の dictionary.csv の Source セットを取得
    existing_sources = set()
    main_rows = []
    with open(MAIN_DICT_PATH, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader, None)
        for row in reader:
            main_rows.append(row)
            if len(row) >= 2 and row[1]:
                existing_sources.add(row[1].strip())

    # 2. knowledge_dictionary.csv から未合流の項目を追加
    added_count = 0
    with open(KNOWLEDGE_DICT_PATH, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        kn_header = next(reader, None)
        for row in reader:
            if not row or len(row) < 3:
                continue
            source = row[1].strip()
            if source and source not in existing_sources:
                main_rows.append(row)
                existing_sources.add(source)
                added_count += 1

    # 3. dictionary.csv へ上書き保存
    with open(MAIN_DICT_PATH, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        if header:
            writer.writerow(header)
        else:
            writer.writerow(["Group", "Source", "Translation", "Adj", "Verb"])
        writer.writerows(main_rows)

    print(f"Successfully merged {added_count} new knowledge translation entries into dictionary.csv!")

if __name__ == "__main__":
    merge_knowledge_dict()

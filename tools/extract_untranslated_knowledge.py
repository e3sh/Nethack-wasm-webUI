#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_untranslated_knowledge.py

OBJECT_KNOWLEDGE_FULL.js, MONSTER_KNOWLEDGE_FULL.js, StructuredKnowledgeEngine.js 
などの構造化ナレッジファイルから英文解説テキスト (effectSummary, flavorNote, usageAdvice, tacticalAdvice, unidentifiedTips 等) 
を自動で抽出し、既存の dictionary.csv に登録されていない未翻訳英文を可視化・リスト化するツール。
"""

import os
import re
import csv

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DICTIONARY_PATH = os.path.join(WORKSPACE_ROOT, 'dictionary.csv')

KNOWLEDGE_FILES = [
    os.path.join(WORKSPACE_ROOT, 'src', 'core', 'knowledge', 'OBJECT_KNOWLEDGE_FULL.js'),
    os.path.join(WORKSPACE_ROOT, 'src', 'core', 'knowledge', 'MONSTER_KNOWLEDGE_FULL.js'),
    os.path.join(WORKSPACE_ROOT, 'src', 'core', 'knowledge', 'StructuredKnowledgeEngine.js'),
]

# 検出対象とするプロパティキー
TARGET_KEYS = [
    'effectSummary',
    'flavorNote',
    'usageAdvice',
    'tacticalAdvice',
    'unidentifiedTips',
    'warningNote'
]

def load_existing_dictionary(dict_path):
    existing_sources = set()
    if not os.path.exists(dict_path):
        print(f"Warning: {dict_path} not found.")
        return existing_sources

    with open(dict_path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        header = next(reader, None)
        for row in reader:
            if len(row) >= 2:
                source = row[1].strip()
                if source:
                    existing_sources.add(source)
    return existing_sources

def is_primarily_english(text):
    if re.search(r'[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]', text):
        return False
    if len(text.strip()) < 3:
        return False
    return True

def extract_strings_from_file(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return []

    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    extracted = []

    for key in TARGET_KEYS:
        # パターン1: key: '...' または key: "..."
        pattern_single = re.compile(rf'{key}\s*:\s*(["\'])(.*?)\1', re.DOTALL)
        for match in pattern_single.finditer(content):
            val = match.group(2).strip()
            val = val.replace("\\'", "'").replace('\\"', '"')
            if val and is_primarily_english(val):
                extracted.append((key, val))

        # パターン2: key: [ '...', "..." ] (配列形式)
        pattern_array = re.compile(rf'{key}\s*:\s*\[\s*(.*?)\s*\]', re.DOTALL)
        for match in pattern_array.finditer(content):
            arr_content = match.group(1)
            str_matches = re.findall(r'(["\'])(.*?)\1', arr_content, re.DOTALL)
            for _, val in str_matches:
                val = val.strip().replace("\\'", "'").replace('\\"', '"')
                if val and is_primarily_english(val):
                    extracted.append((key, val))

    return extracted

def main():
    existing_dict = load_existing_dictionary(DICTIONARY_PATH)
    print(f"Loaded {len(existing_dict)} entries from existing dictionary.csv")

    untranslated_map = {}

    for kfile in KNOWLEDGE_FILES:
        rel_path = os.path.relpath(kfile, WORKSPACE_ROOT)
        strings = extract_strings_from_file(kfile)
        print(f"Scanned {rel_path}: found {len(strings)} candidate strings")

        for key, text in strings:
            if text not in existing_dict:
                if text not in untranslated_map:
                    untranslated_map[text] = []
                untranslated_map[text].append((rel_path, key))

    print(f"\n=======================================================")
    print(f"Total Untranslated Knowledge Strings Found: {len(untranslated_map)}")
    print(f"=======================================================\n")

    output_csv = os.path.join(WORKSPACE_ROOT, 'tools', 'untranslated_knowledge_detected.csv')
    with open(output_csv, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Group', 'Source', 'Translation', 'SourceFiles'])
        for text, occurrences in sorted(untranslated_map.items()):
            sources_str = "; ".join([f"{f}:{k}" for f, k in occurrences])
            writer.writerow(['Message', text, '', sources_str])

    print(f"Extracted untranslated strings saved to: {output_csv}")

if __name__ == '__main__':
    main()

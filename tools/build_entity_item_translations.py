#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_entity_item_translations.py

dictionary.csv 内の Entity (モンスター名) および Item (アイテム名) の未翻訳・未登録 104 件に対し、
JNetHack / NetHack公式の日本語対訳を自動付与して dictionary.csv へ適切なグループ (Entity / Item) で追加し、
tools/dict_converter.py import 経由で param/nhMessage.js を全自動再構築するスクリプト。
"""

import os
import re
import csv
import subprocess

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DICTIONARY_PATH = os.path.join(WORKSPACE_ROOT, 'dictionary.csv')

# --- 未登録モンスター (Entity: 81件) 対訳辞書 ---
MONSTER_TRANSLATION_TABLE = {
    "ice troll": "アイス・トロール",
    "Ice Troll": "アイス・トロール",
    "rock troll": "ロック・トロール",
    "Olog-hai": "オログ＝ハイ",
    "barrow wight": "塚びと",
    "ape": "類人猿",
    "owlbear": "アウルベア",
    "elf zombie": "エルフのゾンビ",
    "straw golem": "ワラ・ゴーレム",
    "rope golem": "ロープ・ゴーレム",
    "gold golem": "ゴールド・ゴーレム",
    "leather golem": "レザー・ゴーレム",
    "wood golem": "ウッド・ゴーレム",
    "flesh golem": "フレッシュ・ゴーレム",
    "clay golem": "クレイ・ゴーレム",
    "glass golem": "ガラス・ゴーレム",
    "Green-elf": "グリーンエルフ",
    "Grey-elf": "グレーエルフ",
    "elf-noble": "エルフの貴族",
    "elf-noble {elf-lord}": "エルフの貴族",
    "elf-lord": "エルフの貴族",
    "elven monarch": "エルフの王",
    "elven monarch {Elvenking}": "エルフの王",
    "Elvenking": "エルフの王",
    "doppelganger": "ドッペルゲンガー",
    "guard": "衛兵",
    "prisoner": "囚人",
    "soldier": "兵士",
    "nurse": "看護婦",
    "captain": "隊長",
    "watchman": "警備員",
    "watch captain": "警備隊長",
    "Croesus": "クルーサス王",
    "ghost": "幽霊",
    "shade": "影",
    "amorous demon": "好色な悪魔",
    "amorous demon {incubus}": "好色な悪魔",
    "incubus": "インキュバス",
    "erinys": "エリニュス",
    "vrock": "ヴロック",
    "hezrou": "ヘズロウ",
    "bone devil": "ボーン・デビル",
    "ice devil": "アイス・デビル",
    "pit fiend": "ピット・フィーンド",
    "sandestin": "サンデスティン",
    "balrog": "バルログ",
    "Juiblex": "ジューブレクス",
    "Yeenoghu": "イエノーグ",
    "Orcus": "オルクス",
    "Geryon": "ゲリュオン",
    "Dispater": "ディスパテル",
    "Baalzebub": "バアルゼブブ",
    "Asmodeus": "アスモデウス",
    "Demogorgon": "デモゴルゴン",
    "mail daemon": "郵便デーモン",
    "djinni": "魔人",
    "jellyfish": "クラゲ",
    "piranha": "ピラニア",
    "shark": "サメ",
    "baby crocodile": "赤ん坊のワニ",
    "crocodile": "ワニ",
    "long worm tail": "長虫の尻尾",
    "Lord Carnarvon": "カーナヴォン卿",
    "Pelias": "ペリアス",
    "Shaman Karnov": "呪術師カルノフ",
    "Hippocrates": "ヒポクラテス",
    "King Arthur": "アーサー王",
    "Grand Master": "グランドマスター",
    "Arch Priest": "大司祭",
    "Orion": "オリオン",
    "Master of Thieves": "盗賊の頭領",
    "Lord Sato": "サトウ卿",
    "Twoflower": "ツーフラワー",
    "Norn": "ノルン",
    "Neferet the Green": "緑のネフェレット",
    "Minion of Huhetotl": "ウエヘトトル配下",
    "Thoth Amon": "トト・アモン",
    "Chromatic Dragon": "クロマチック・ドラゴン",
    "Cyclops": "サイクロプス",
    "Ixoth": "イグゾス",
    "Master Kaen": "マスター・カエン",
    "Nalzok": "ナルゾク",
    "Scorpius": "スコルピウス",
    "Master Assassin": "マスター・アサシン",
    "Ashikaga Takauji": "足利尊氏",
    "Lord Surtur": "スルト卿",
    "Dark One": "闇の者",
    "invisible mon": "透明なモンスター"
}

# --- 未登録アイテム (Item: 23件) 対訳辞書 ---
ITEM_TRANSLATION_TABLE = {
    "strange / generic strange": "奇妙な物",
    "strange": "奇妙な物",
    "generic strange": "奇妙な物",
    "coin / generic coin": "金貨",
    "coin": "金貨",
    "generic coin": "金貨",
    "large rock / generic large rock": "巨岩",
    "large rock": "巨岩",
    "generic large rock": "巨岩",
    "iron ball / generic iron ball": "鉄球",
    "iron ball": "鉄球",
    "generic iron ball": "鉄球",
    "iron chain / generic iron chain": "鉄の鎖",
    "iron chain": "鉄の鎖",
    "generic iron chain": "鉄の鎖",
    "venom / generic venom": "毒液",
    "venom": "毒液",
    "generic venom": "毒液",
    "Amulet of Yendor / cheap plastic imitation of the Amulet of Yendor": "イェンドールの護符の安物プラスチックの偽物",
    "cheap plastic imitation of the Amulet of Yendor": "イェンドールの護符の安物プラスチックの偽物",
    "Amulet of Yendor / Amulet of Yendor": "イェンドールの護符",
    "Amulet of Yendor": "イェンドールの護符",
    "drum / drum of earthquake": "地震の太鼓",
    "drum of earthquake": "地震の太鼓",
    "unicorn horn": "ユニコーンの角",
    "candelabrum / Candelabrum of Invocation": "祈りの燭台",
    "Candelabrum of Invocation": "祈りの燭台",
    "silver bell / Bell of Opening": "開錠の鈴",
    "Bell of Opening": "開錠の鈴",
    "enormous meatball": "巨大な肉団子",
    "glob of gray ooze": "グレー・ウーズの塊",
    "glob of brown pudding": "ブラウン・プリンの塊",
    "glob of green slime": "グリーン・スライムの塊",
    "glob of black pudding": "ブラック・プリンの塊",
    "kelp frond": "昆布の葉",
    "lump of royal jelly": "ローヤルゼリーの塊",
    "heavy iron ball": "重い鉄球",
    "splash of venom / splash of blinding venom": "目つぶしの毒液",
    "splash of blinding venom": "目つぶしの毒液",
    "splash of venom / splash of acid venom": "酸の毒液",
    "splash of acid venom": "酸の毒液"
}

def load_existing_sources():
    sources = set()
    if os.path.exists(DICTIONARY_PATH):
        with open(DICTIONARY_PATH, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            header = next(reader, None)
            for row in reader:
                if len(row) >= 2:
                    s = row[1].strip().lower()
                    if s:
                        sources.add(s)
    return sources

def main():
    existing_sources = load_existing_sources()
    print(f"Loaded {len(existing_sources)} existing entries from dictionary.csv")

    added_monsters = 0
    added_items = 0
    new_rows = []

    # 1. モンスター (Entity) 追加
    for en_text, jp_text in MONSTER_TRANSLATION_TABLE.items():
        en_clean = en_text.strip()
        if en_clean.lower() not in existing_sources:
            new_rows.append(['Entity', en_clean, jp_text, '', ''])
            existing_sources.add(en_clean.lower())
            added_monsters += 1

    # 2. アイテム (Item) 追加
    for en_text, jp_text in ITEM_TRANSLATION_TABLE.items():
        en_clean = en_text.strip()
        if en_clean.lower() not in existing_sources:
            new_rows.append(['Item', en_clean, jp_text, '', ''])
            existing_sources.add(en_clean.lower())
            added_items += 1

    print(f"Adding {added_monsters} Entity entries and {added_items} Item entries to dictionary.csv...")

    if new_rows:
        with open(DICTIONARY_PATH, 'a', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            for row in new_rows:
                writer.writerow(row)
        print("Successfully updated dictionary.csv with new Entity & Item translations!")
    else:
        print("No new entries to add.")

    # 3. dict_converter.py を呼び出して param/nhMessage.js を全自動再ビルド
    dict_conv_script = os.path.join(WORKSPACE_ROOT, 'tools', 'dict_converter.py')
    if os.path.exists(dict_conv_script):
        print("\nInvoking tools/dict_converter.py import dictionary.csv to rebuild param/nhMessage.js...")
        res = subprocess.run(['python', dict_conv_script, 'import', DICTIONARY_PATH], capture_output=True, text=True)
        print(res.stdout)
        if res.stderr:
            print("Stderr:", res.stderr)
        print("Build complete!")

if __name__ == '__main__':
    main()

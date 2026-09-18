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

ENGRAVING_METADATA = {
    "Elbereth": {
        "translation": "エルベレス",
        "category": "ELBERETH",
        "source": "J.R.R. Tolkien: The Lord of the Rings (星々の女王／魔除けの結界文字)"
    },
    "Vlad was here": {
        "translation": "ヴラド参上",
        "category": "TRAP",
        "source": "Vlad the Impaler / Count Dracula (吸血鬼ヴラド・ツェペシュ)"
    },
    "ad aerarium": {
        "translation": "宝物庫へ",
        "category": "TRAP",
        "source": "Latin: To the treasury (ラテン語: 宝物庫・国庫へ)"
    },
    "Owlbreath": {
        "translation": "フクロウの息",
        "category": "PARODY",
        "source": "Parody of Elbereth (Elbereth のもじり・結界効果なし)"
    },
    "Galadriel": {
        "translation": "ガラドリエル",
        "category": "LITERATURE",
        "source": "J.R.R. Tolkien: The Lord of the Rings (ロスローリエンの光のエルフの奥方)"
    },
    "Kilroy was here": {
        "translation": "キルロイ参上",
        "category": "GRAFFITI",
        "source": "World War II meme (第二次世界大戦の有名な落書きミーム)"
    },
    "Frodo lives": {
        "translation": "フロドは生きている",
        "category": "LITERATURE",
        "source": "1960s counterculture meme (60年代トールキンブームの合言葉)"
    },
    "A.S. ->": {
        "translation": "A.S. →",
        "category": "LITERATURE",
        "source": "Jules Verne: Journey to the Center of the Earth (アルネ・サクヌッセンの道標)"
    },
    "<- A.S.": {
        "translation": "← A.S.",
        "category": "LITERATURE",
        "source": "Jules Verne: Journey to the Center of the Earth (アルネ・サクヌッセンの道標)"
    },
    "You won't get it up the steps": {
        "translation": "階段の上に持ち上げることはできない",
        "category": "GAME",
        "source": "Colossal Cave Adventure (古典名作テキストADVのメッセージ)"
    },
    "Lasciate ogni speranza o voi ch'entrate.": {
        "translation": "ここに入る者、すべての希望を捨てよ。",
        "category": "LITERATURE",
        "source": "Dante Alighieri: Inferno (ダンテ『神曲』地獄篇・地獄の門の銘文)"
    },
    "Well Come": {
        "translation": "よく 来た",
        "category": "MEDIA",
        "source": "The Prisoner (1967 TV series) (カルトTVドラマ『プリズナーNo.6』)"
    },
    "We apologize for the inconvenience.": {
        "translation": "ご不便をおかけして申し訳ありません。",
        "category": "LITERATURE",
        "source": "Douglas Adams: So Long, and Thanks for All the Fish (神が創造物に遺した最後のメッセージ)"
    },
    "See you next Wednesday": {
        "translation": "次の水曜日に会おう",
        "category": "CINEMA",
        "source": "John Landis running gag (映画監督ジョン・ランディスの映画に必ず登場する合言葉)"
    },
    "notary sojak": {
        "translation": "ノタリー・ソジャック",
        "category": "COMIC",
        "source": "Smokey Stover (コミック『スモーキー・ストーバー』の無意味なナンセンス合言葉)"
    },
    "For a good time call 8?7-5309": {
        "translation": "楽しい時間を過ごしたければ 8?7-5309 に電話を",
        "category": "MUSIC",
        "source": "Tommy Tutone: 867-5309/Jenny (トミー・タトゥンの名曲／公衆トイレの落書き)"
    },
    "Please don't feed the animals.": {
        "translation": "動物に餌を与えないでください。",
        "category": "HUMOR",
        "source": "Zoo signage warning (動物園の看板警告)"
    },
    "Madam, in Eden, I'm Adam.": {
        "translation": "奥様、エデンにて、私はアダムです。",
        "category": "PALINDROME",
        "source": "Famous English palindrome (英語の有名な回文)"
    },
    "Two thumbs up!": {
        "translation": "2本の親指を立てて大絶賛！",
        "category": "MEDIA",
        "source": "Siskel & Ebert (映画評論家シスケル＆エバートのトレードマーク)"
    },
    "Hello, World!": {
        "translation": "ハロー、ワールド！",
        "category": "CODE",
        "source": "Brian Kernighan: The C Programming Language (最初のC言語プログラム)"
    },
    "^?MAIL": {
        "translation": "^?MAIL",
        "category": "SYSTEM",
        "source": "UNIX mail notification bell character (UNIX システムメッセージ)"
    },
    "You've got mail!": {
        "translation": "メールが届いています！",
        "category": "TECH",
        "source": "AOL email notification (AOLの有名なメール着信音声)"
    },
    "^.": {
        "translation": "^.",
        "category": "SYSTEM",
        "source": "UNIX mail/ed termination command (UNIX 入力終了コマンド)"
    },
    "As if!": {
        "translation": "ありえない！",
        "category": "CINEMA",
        "source": "Clueless (1995 film) (映画『クルーレス』の流行語)"
    },
    "BAD WOLF": {
        "translation": "バッド・ウルフ (悪しき狼)",
        "category": "MEDIA",
        "source": "Doctor Who (ドラマ『ドクター・フー』の時空を超えるキーワード)"
    },
    "Arooo!  Werewolves of Yendor!": {
        "translation": "アオーン！ イェンダーの人狼だ！",
        "category": "MUSIC",
        "source": "Warren Zevon: Werewolves of London parody (ウォーレン・ジヴォン『ロンドンの人狼』パロディ)"
    },
    "Dig for Victory here": {
        "translation": "ここで『勝利のための採掘（家庭菜園）』を",
        "category": "HISTORY",
        "source": "British WWII campaign / NetHack digging pun (WWII英国プロパガンダ＆穴掘りの洒落)"
    },
    "Gaius Julius Primigenius was here.  Why are you late?": {
        "translation": "ガイウス・ユリウス・プリミゲニウスここにありき。なぜ遅れた？",
        "category": "HISTORY",
        "source": "Actual Roman graffiti from Pompeii (ポンペイ遺跡の実在する壁の落書き)"
    },
    "Don't go this way": {
        "translation": "こっちへ行ってはならない",
        "category": "GUIDE",
        "source": "Dungeon warning (ダンジョンの案内・警告)"
    },
    "Go left --->": {
        "translation": "左へ行け --->",
        "category": "GUIDE",
        "source": "Misleading guide (矛盾した方向指示: 矢印は右)"
    },
    "<--- Go right": {
        "translation": "<--- 右へ行け",
        "category": "GUIDE",
        "source": "Misleading guide (矛盾した方向指示: 矢印は左)"
    },
    "X marks the spot": {
        "translation": "X印がその場所だ",
        "category": "LORE",
        "source": "Treasure map trope (宝探しの定番フレーズ)"
    },
    "X <--- You are here.": {
        "translation": "X <--- 現在地",
        "category": "GUIDE",
        "source": "Mall / Map location indicator (案内マップの現在地表示)"
    },
    "Here be dragons": {
        "translation": "ここにドラゴンあり",
        "category": "LORE",
        "source": "Historical cartography phrase: HC SVNT DRACONES (古地図の未踏・危険領域の警告)"
    },
    "Save now, and do your homework!": {
        "translation": "今すぐセーブして宿題をしなさい！",
        "category": "META",
        "source": "NetHack developer humor (開発者からの親心と警告)"
    },
    "There was a hole here.  It's gone now.": {
        "translation": "ここに穴があった。今はもうない。",
        "category": "GAME",
        "source": "Silent Hill 2 graffiti (ホラーゲーム『サイレントヒル2』の有名な壁の落書き)"
    },
    "The Vibrating Square": {
        "translation": "振動する床",
        "category": "NETHACK",
        "source": "NetHack endgame milestone (NetHack終盤、祈りの儀式を行う最重要地点の偽り標識)"
    },
    "This is a pit!": {
        "translation": "ここは落とし穴だ！",
        "category": "TRAP",
        "source": "Dungeon warning / Trap notice (落とし穴の警告)"
    },
    "This is not the dungeon you are looking for.": {
        "translation": "これはお前が探しているダンジョンではない。",
        "category": "CINEMA",
        "source": "Star Wars Obi-Wan mind trick parody (スター・ウォーズ「お前の探しているドロイドではない」)"
    },
    "Watch out, there's a gnome with a wand of death behind that door!": {
        "translation": "気をつけろ、その扉の後ろに死の杖を持ったノームがいるぞ！",
        "category": "NETHACK",
        "source": "NetHack player trauma (ノーム鉱山での死の杖即死トラウマ)"
    },
    "This square deliberately left blank.": {
        "translation": "このマス目は意図的に空白のままにしてあります。",
        "category": "HUMOR",
        "source": "Official document parody: This page intentionally left blank (公的文書の白紙注記パロディ)"
    },
    "Haermund Hardaxe carved these runes": {
        "translation": "ハルムンド・ハードアックスがこれらのルーンを刻んだ",
        "category": "HISTORY",
        "source": "Viking runic inscription parody (Maeshowe 等のヴァイキング・ルーン落書き)"
    },
    "Need a light?  Come visit the Minetown branch of Izchak's Lighting Store!": {
        "translation": "明かりをお求めですか？ イズチャックの照明店・鉱山街支店へどうぞ！",
        "category": "NETHACK",
        "source": "In-game advertisement (イズチャックの照明店広告)"
    },
    "Snakes on the Astral Plane - Soon in a dungeon near you": {
        "translation": "霊界のスネーク - まもなくお近くのダンジョンで公開",
        "category": "CINEMA",
        "source": "Snakes on a Plane parody (映画『スネーク・フライト』パロディ)"
    },
    "You are the one millionth visitor to this place!  Please wait 200 turns for your wand of wishing.": {
        "translation": "あなたは当ダンジョン100万人目のお客様です！ 願いの杖の進呈まで200ターンお待ちください。",
        "category": "HUMOR",
        "source": "Internet banner ad scam parody (Webバナースパム広告のパロディ)"
    },
    "Warning, Exploding runes!": {
        "translation": "警告、爆発するルーン文字！",
        "category": "GAME",
        "source": "Dungeons & Dragons spell (D&Dの爆発ルーン呪文)"
    },
    "If you can read these words then you are not only a nerd but probably dead.": {
        "translation": "この文字が読めるなら、お前はオタクであるだけでなく、おそらくすでに死んでいる。",
        "category": "LITERATURE",
        "source": "Ben Aaronovitch: Whispers Under Ground (ベン・アーロノヴィッチ『地下世界の囁き』)"
    },
    "The cake is a lie": {
        "translation": "ケーキは嘘だ",
        "category": "GAME",
        "source": "Portal (Valve) (名作パズルゲーム『Portal』の名台詞)"
    }
}

def build_engravings(dat_dir, dict_map):
    engrave_path = dat_dir / "engrave.txt"
    if not engrave_path.exists():
        print(f"[WARN] engrave.txt not found: {engrave_path}")
        return []

    engravings = []
    current_comment = ""

    with open(engrave_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("#"):
                comment_body = stripped.lstrip("#").strip()
                if comment_body and not comment_body.startswith("NetHack 5.0") and not comment_body.startswith("Copyright") and not comment_body.startswith("NetHack may be freely"):
                    current_comment = comment_body
                continue

            text = stripped
            meta = ENGRAVING_METADATA.get(text, {})
            tr = dict_map.get(text) or meta.get("translation", "")
            category = meta.get("category", "ENGRAVING")
            source = meta.get("source", current_comment or "engrave.txt")

            engravings.append({
                "id": f"engrave_{len(engravings) + 1}",
                "text": text,
                "normalizedText": " ".join(text.split()),
                "translatedText": tr,
                "category": "ENGRAVING",
                "subCategory": category,
                "source": source
            })

    return engravings

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

    print(f"[build_lore_database] Building engravings from {DAT_DIR}...")
    engravings = build_engravings(DAT_DIR, dict_map)
    engravings_tr_cnt = sum(1 for e in engravings if e["translatedText"])
    print(f"[build_lore_database] Engravings: {len(engravings)} total [Tr: {engravings_tr_cnt}]")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    js_code = f"""/**
 * LoreMasterData.js - Layer 4: LORE & Collection SSOT Master Data
 *
 * Automatically generated by tools/build_lore_database.py
 * Total Rumors: {len(rumors)} (True: {tru_cnt}, False: {fal_cnt})
 * Total Oracles: {len(oracles)}
 * Total Engravings: {len(engravings)}
 */

export const RUMORS = {json.dumps(rumors, ensure_ascii=False, indent=2)};

export const ORACLES = {json.dumps(oracles, ensure_ascii=False, indent=2)};

export const ENGRAVINGS = {json.dumps(engravings, ensure_ascii=False, indent=2)};

export const LORE_MASTER = {{
    metadata: {{
        version: "5.0.0",
        generatedAt: "2026-09-18",
        rumorCount: {len(rumors)},
        trueRumorCount: {tru_cnt},
        falseRumorCount: {fal_cnt},
        oracleCount: {len(oracles)},
        engravingCount: {len(engravings)}
    }},
    rumors: RUMORS,
    oracles: ORACLES,
    engravings: ENGRAVINGS
}};

export default LORE_MASTER;
"""

    with open(OUTPUT_JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_code)

    print(f"[build_lore_database] Successfully generated {OUTPUT_JS_PATH} ({OUTPUT_JS_PATH.stat().st_size:,} bytes)")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
map_source_to_dictionary.py - NetHack ソースメッセージと既存翻訳資産の自動照合・マッピング基盤

【Phase 2 目的】
1. tools/data/source_messages.json (14,849件) と dictionary.csv (~17,190件) を多層パイプラインで自動照合
2. 各メッセージに訳語、照合Tier、辞書グループを付与した source_messages_mapped.json を生成
3. 照合統計・レイヤー別カバレッジレポート (mapping_report.txt) を出力
4. Cソースに存在するが辞書にない未翻訳ギャップリスト (untranslated_source_messages.csv) を出力
5. Phase 3 への橋渡しとして Layer 3 (制御シグナル: yn_function/getlin/getdir) の完全マスター (control_signals_master.json) を出力
"""

import os
import sys
import json
import csv
import re
import argparse
from collections import defaultdict, Counter
from pathlib import Path

# --- プレフィックス補正マップ (NetHack C メッセージ関数 -> 画面出力テキストの接頭辞) ---
CALLEE_PREFIX_MAP = {
    'You': 'You ',
    'Your': 'Your ',
    'You_feel': 'You feel ',
    'You_hear': 'You hear ',
    'You_hear1': 'You hear ',
    'You_cant': "You can't ",
    'You_see': 'You see ',
    'There': 'There ',
    'pline_The': 'The ',
}

def normalize_whitespace(text: str) -> str:
    """連続空白を1つのスペースにし、トリムする"""
    return re.sub(r'\s+', ' ', text).strip()

def make_template_key(text: str) -> str:
    """
    C言語の printf 指定子 (%s, %d, %5d, %ld, %u, %c, etc.) を統一プレースホルダ <*> に正規化
    """
    t = re.sub(r'%[-+0-9#\.]*[sdulcxXp]', '<*>', text)
    t = re.sub(r'%%', '%', t)
    return normalize_whitespace(t)

def make_dict_template_key(text: str) -> str:
    r"""
    辞書側のプレースホルダ（(.*), {0}, %s, \d+ など）を統一プレースホルダ <*> に正規化
    """
    t = text
    t = t.replace(r'\.', '.').replace(r'\?', '?').replace(r'\!', '!')
    t = re.sub(r'^\^', '', t)
    t = re.sub(r'\$$', '', t)
    t = re.sub(r'\(\.\*\??\)', '<*>', t)
    t = re.sub(r'\\d\+?', '<*>', t)
    t = re.sub(r'\[0-9\]\+?', '<*>', t)
    t = re.sub(r'\{[0-9]+\}', '<*>', t)
    t = re.sub(r'%[-+0-9#\.]*[sdulcxXp]', '<*>', t)
    return normalize_whitespace(t)

def extract_significant_words(text: str) -> set:
    """テキストから長さ3文字以上の英単語を抽出（倒置インデックス用）"""
    words = set(re.findall(r'[a-zA-Z]{3,}', text.lower()))
    stopwords = {'the', 'you', 'and', 'for', 'that', 'with', 'this', 'your', 'from', 'are', 'not', 'have'}
    return words - stopwords

class DictionaryIndex:
    """既存 dictionary.csv を高速検索するための多段インデックス"""
    def __init__(self, dict_path: Path):
        self.rows = []
        self.exact_map = {}          # exact_str -> row
        self.lower_map = {}          # lower_str -> row
        self.norm_map = {}           # norm_str (whitespace normalized) -> row
        self.template_map = {}       # template_key -> row
        self.patterns = []           # compiled regex entries: (regex, row, required_words)
        self.word_to_patterns = defaultdict(list)
        self.general_patterns = []

        self._load(dict_path)

    def _load(self, dict_path: Path):
        with open(dict_path, 'r', encoding='utf-8-sig', errors='replace') as f:
            reader = csv.DictReader(f)
            for r in reader:
                group = r.get('Group', '').strip()
                src = r.get('Source', '')
                trans = r.get('Translation', '')
                if not src:
                    continue

                row = {
                    'group': group,
                    'source': src,
                    'translation': trans,
                    'adj': r.get('Adj', ''),
                    'verb': r.get('Verb', '')
                }
                self.rows.append(row)

                if src not in self.exact_map:
                    self.exact_map[src] = row
                src_norm = normalize_whitespace(src)
                if src_norm not in self.norm_map:
                    self.norm_map[src_norm] = row
                src_lower = src_norm.lower()
                if src_lower not in self.lower_map:
                    self.lower_map[src_lower] = row

                tmpl_key = make_dict_template_key(src_norm)
                if '<*>' in tmpl_key:
                    if tmpl_key not in self.template_map:
                        self.template_map[tmpl_key] = row
                    tmpl_l = tmpl_key.lower()
                    if tmpl_l not in self.template_map:
                        self.template_map[tmpl_l] = row

                if group == 'Pattern':
                    try:
                        pat_str = src
                        compiled = re.compile(pat_str, re.IGNORECASE)
                        sig_words = extract_significant_words(pat_str)
                        pat_idx = len(self.patterns)
                        self.patterns.append((compiled, row, sig_words))
                        if sig_words:
                            for w in sig_words:
                                self.word_to_patterns[w].append(pat_idx)
                        else:
                            self.general_patterns.append(pat_idx)
                    except Exception:
                        pass

    def match_exact(self, text: str):
        if text in self.exact_map:
            return self.exact_map[text]
        norm = normalize_whitespace(text)
        if norm in self.norm_map:
            return self.norm_map[norm]
        norm_l = norm.lower()
        if norm_l in self.lower_map:
            return self.lower_map[norm_l]
        return None

    def match_template(self, text: str):
        tmpl_key = make_template_key(text)
        if '<*>' in tmpl_key:
            if tmpl_key in self.template_map:
                return self.template_map[tmpl_key]
            tmpl_l = tmpl_key.lower()
            if tmpl_l in self.template_map:
                return self.template_map[tmpl_l]
        return None

    def match_pattern(self, text: str):
        words = extract_significant_words(text)
        candidate_indices = set(self.general_patterns)
        for w in words:
            if w in self.word_to_patterns:
                candidate_indices.update(self.word_to_patterns[w])

        for idx in candidate_indices:
            compiled, row, sig_words = self.patterns[idx]
            if sig_words and not (sig_words & words):
                continue
            if compiled.search(text):
                return row
        return None


def get_full_format(msg: dict) -> str:
    rf = msg.get('raw_format', '')
    callee = msg.get('callee_func', '')
    # getdir で引数が NULL / 0 / (char *) 0 の場合は NetHack の標準方向プロンプト "In what direction?"
    if callee == 'getdir':
        if not rf or rf in ['(char *) 0', '(char *)0', '0', 'NULL', 'null'] or 'In what direction?' in rf:
            return "In what direction?"
    if not rf:
        return ''
    prefix = CALLEE_PREFIX_MAP.get(callee, '')
    return prefix + rf


def run_mapping(source_json_path: Path, dict_csv_path: Path, output_dir: Path):
    print(f"[*] 既存辞書を読み込み中: {dict_csv_path}")
    dict_index = DictionaryIndex(dict_csv_path)
    print(f"    - 辞書エントリ数: {len(dict_index.rows):,} 件")
    print(f"    - パターンエントリ数: {len(dict_index.patterns):,} 件")

    print(f"[*] ソースメッセージマスターを読み込み中: {source_json_path}")
    with open(source_json_path, 'r', encoding='utf-8') as f:
        sdata = json.load(f)

    messages = sdata.get('messages', [])
    total_messages = len(messages)
    print(f"    - ソースメッセージ総数: {total_messages:,} 件")

    output_dir.mkdir(parents=True, exist_ok=True)

    mapped_messages = []
    untranslated_list = []
    control_signals = []

    stats_tier = Counter()
    stats_layer_total = Counter()
    stats_layer_matched = Counter()
    stats_domain_total = Counter()
    stats_domain_matched = Counter()
    stats_callee_total = Counter()
    stats_callee_matched = Counter()

    for msg in messages:
        layer = msg.get('layer', 0)
        domain = msg.get('domain', 'unknown')
        callee = msg.get('callee_func', 'none')

        stats_layer_total[layer] += 1
        stats_domain_total[domain] += 1
        stats_callee_total[callee] += 1

        full_text = get_full_format(msg)
        raw_format = msg.get('raw_format', '')
        inferred = msg.get('inferred_format')

        matched_row = None
        match_tier = "UNMATCHED"

        # 候補テキストのリストを作成
        candidates = []
        if full_text:
            candidates.append((full_text, "FULL"))
        if raw_format and raw_format != full_text:
            candidates.append((raw_format, "RAW"))

        # yn_function のキー選択肢付加バリエーション ([yn], [ynaq] 等)
        pm = msg.get('prompt_meta')
        if pm and pm.get('valid_keys'):
            vk = pm['valid_keys']
            base = full_text or raw_format
            if base:
                candidates.append((f"{base} [{vk}]", "PROMPT_OPTS"))
                candidates.append((f"{base} [{vk.lower()}]", "PROMPT_OPTS"))
                candidates.append((f"{base} [{vk.upper()}]", "PROMPT_OPTS"))

        # --- Tier 1: Exact Match ---
        for cand, src_type in candidates:
            matched_row = dict_index.match_exact(cand)
            if matched_row:
                match_tier = f"EXACT_{src_type}"
                break

        # --- Tier 2: Template Match ---
        if not matched_row:
            for cand, src_type in candidates:
                matched_row = dict_index.match_template(cand)
                if matched_row:
                    match_tier = f"TEMPLATE_{src_type}"
                    break

        # --- Tier 3: Regex Pattern Match ---
        if not matched_row:
            for cand, _ in candidates:
                matched_row = dict_index.match_pattern(cand)
                if matched_row:
                    match_tier = "PATTERN"
                    break
        # --- Tier 4: Inferred Format Match ---
        if not matched_row and inferred:
            matched_row = dict_index.match_exact(inferred) or dict_index.match_template(inferred)
            if matched_row:
                match_tier = "INFERRED"

        stats_tier[match_tier] += 1
        is_matched = match_tier != "UNMATCHED"

        if is_matched:
            stats_layer_matched[layer] += 1
            stats_domain_matched[domain] += 1
            stats_callee_matched[callee] += 1

        mapped_entry = dict(msg)
        mapped_entry['full_text'] = full_text
        mapped_entry['match_tier'] = match_tier
        mapped_entry['translation'] = matched_row['translation'] if matched_row else None
        mapped_entry['dict_source'] = matched_row['source'] if matched_row else None
        mapped_entry['dict_group'] = matched_row['group'] if matched_row else None

        mapped_messages.append(mapped_entry)

        if not is_matched:
            untranslated_list.append({
                'id': msg.get('id'),
                'source_type': msg.get('source_type'),
                'file': msg.get('file'),
                'line': msg.get('line'),
                'callee': callee,
                'caller': msg.get('caller_func'),
                'layer': layer,
                'domain': domain,
                'english_text': full_text if full_text else raw_format,
                'placeholders': len(msg.get('placeholders', []))
            })

        if layer == 3:
            control_signals.append({
                'id': msg.get('id'),
                'file': msg.get('file'),
                'line': msg.get('line'),
                'callee_func': callee,
                'caller_func': msg.get('caller_func'),
                'raw_format': raw_format,
                'full_text': full_text,
                'translation': mapped_entry['translation'],
                'match_tier': match_tier,
                'prompt_meta': msg.get('prompt_meta'),
                'domain': domain,
                'placeholders': msg.get('placeholders', [])
            })

    # 1. source_messages_mapped.json
    mapped_json_path = output_dir / "source_messages_mapped.json"
    print(f"[*] マッピング済みマスターを出力中: {mapped_json_path}")
    mapped_data = {
        "version": "1.1.0",
        "description": "NetHack 5.0 Source Message Master with Dictionary Mappings",
        "stats": {
            "total_messages": total_messages,
            "matched_total": total_messages - stats_tier["UNMATCHED"],
            "matched_rate_percent": round((total_messages - stats_tier["UNMATCHED"]) / total_messages * 100, 2),
            "tier_breakdown": dict(stats_tier),
            "layer_stats": {
                l: {
                    "total": stats_layer_total[l],
                    "matched": stats_layer_matched[l],
                    "rate_percent": round(stats_layer_matched[l] / stats_layer_total[l] * 100, 2) if stats_layer_total[l] else 0
                } for l in sorted(stats_layer_total.keys())
            }
        },
        "messages": mapped_messages
    }
    with open(mapped_json_path, 'w', encoding='utf-8') as f:
        json.dump(mapped_data, f, ensure_ascii=False, indent=2)

    # 2. untranslated_source_messages.csv
    untrans_csv_path = output_dir / "untranslated_source_messages.csv"
    print(f"[*] 未翻訳ギャップリストを出力中: {untrans_csv_path} ({len(untranslated_list):,} 件)")
    if untranslated_list:
        with open(untrans_csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'id', 'source_type', 'file', 'line', 'callee', 'caller', 'layer', 'domain', 'english_text', 'placeholders'
            ])
            writer.writeheader()
            writer.writerows(untranslated_list)

    # 3. control_signals_master.json
    ctrl_json_path = output_dir / "control_signals_master.json"
    print(f"[*] Layer 3 制御シグナルマスターを出力中: {ctrl_json_path} ({len(control_signals):,} 件)")
    ctrl_matched = sum(1 for c in control_signals if c['match_tier'] != 'UNMATCHED')
    ctrl_data = {
        "version": "1.0.0",
        "description": "Layer 3 Control Signal Master (yn_function, getlin, getdir)",
        "stats": {
            "total_prompts": len(control_signals),
            "matched_count": ctrl_matched,
            "matched_rate_percent": round(ctrl_matched / len(control_signals) * 100, 2) if control_signals else 0,
            "callee_breakdown": Counter(c['callee_func'] for c in control_signals)
        },
        "signals": control_signals
    }
    with open(ctrl_json_path, 'w', encoding='utf-8') as f:
        json.dump(ctrl_data, f, ensure_ascii=False, indent=2)

    # 4. mapping_report.txt
    report_path = output_dir / "mapping_report.txt"
    print(f"[*] サマリレポートを出力中: {report_path}")
    total_matched = total_messages - stats_tier["UNMATCHED"]
    match_rate = total_matched / total_messages * 100

    report_lines = [
        "================================================================================",
        " NetHack 5.0 ソースメッセージ & 既存翻訳辞書 マッピング総合レポート (Phase 2)",
        "================================================================================",
        f"実行日: 2026-09-18",
        f"対象ソースメッセージ総数 : {total_messages:,} 件",
        f"既存辞書エントリ総数     : {len(dict_index.rows):,} 件",
        "",
        "--------------------------------------------------------------------------------",
        " 1. 全体照合結果サマリ (Overall Summary)",
        "--------------------------------------------------------------------------------",
        f" マッピング成功 (翻訳あり) : {total_matched:,} 件 ({match_rate:.2f}%)",
        f" 未照合 (未翻訳ギャップ)   : {stats_tier['UNMATCHED']:,} 件 ({stats_tier['UNMATCHED']/total_messages*100:.2f}%)",
        "",
        " [照合Tier別内訳]",
    ]
    tier_descriptions = {
        "EXACT_FULL": "Prefix補正後 完全一致",
        "EXACT_RAW": "原文フォーマット 完全一致",
        "EXACT_PROMPT_OPTS": "プロンプト選択肢付加 完全一致",
        "TEMPLATE_FULL": "Prefix補正後 プレースホルダ正規化一致",
        "TEMPLATE_RAW": "原文 プレースホルダ正規化一致",
        "TEMPLATE_PROMPT_OPTS": "プロンプト選択肢 プレースホルダ一致",
        "PATTERN": "辞書Pattern正規表現一致",
        "INFERRED": "変数渡し逆引き推定フォーマット一致"
    }
    for tk, count in stats_tier.most_common():
        if tk == "UNMATCHED":
            continue
        desc = tier_descriptions.get(tk, tk)
        report_lines.append(f"   - {tk:<20} ({desc}) : {count:,} 件 ({count/total_messages*100:.2f}%)")

    report_lines.extend([
        "",
        "--------------------------------------------------------------------------------",
        " 2. コンテキスト・レイヤー別カバレッジ (Layer Coverage)",
        "--------------------------------------------------------------------------------",
        " レイヤー                                  総数      一致数     カバー率",
        " -------------------------------------------------------------------------------",
    ])

    layer_names = {
        1: "Layer 1: 視点・知覚 (You, You_feel, etc.)",
        2: "Layer 2: ドメイン (eat, pray, combat, etc.)",
        3: "Layer 3: 制御シグナル (yn_function, getlin)",
        4: "Layer 4: 環境・伝承 (rumors, oracles, etc.)",
        5: "Layer 5: エンティティ・変数 (名前・称号等)"
    }
    for l in sorted(stats_layer_total.keys()):
        tot = stats_layer_total[l]
        mat = stats_layer_matched[l]
        rate = mat / tot * 100 if tot else 0
        name = layer_names.get(l, f"Layer {l}")
        report_lines.append(f" {name:<42} {tot:>7,} 件  {mat:>7,} 件   {rate:>6.2f}%")

    report_lines.extend([
        "",
        "--------------------------------------------------------------------------------",
        " 3. 主要メッセージ関数 (Callee) 別カバレッジ",
        "--------------------------------------------------------------------------------",
        " 呼び出し関数             総数      一致数     カバー率",
        " -------------------------------------------------------------------------------",
    ])
    for callee, tot in stats_callee_total.most_common(20):
        mat = stats_callee_matched[callee]
        rate = mat / tot * 100 if tot else 0
        callee_str = str(callee if callee is not None else "(dat/none)")
        report_lines.append(f" {callee_str:<22} {tot:>7,} 件  {mat:>7,} 件   {rate:>6.2f}%")

    report_lines.extend([
        "",
        "--------------------------------------------------------------------------------",
        " 4. 主要ドメイン (Domain) 別カバレッジ (Top 20)",
        "--------------------------------------------------------------------------------",
        " ドメイン                 総数      一致数     カバー率",
        " -------------------------------------------------------------------------------",
    ])
    for domain, tot in stats_domain_total.most_common(20):
        mat = stats_domain_matched[domain]
        rate = mat / tot * 100 if tot else 0
        domain_str = str(domain if domain is not None else "(none)")
        report_lines.append(f" {domain_str:<22} {tot:>7,} 件  {mat:>7,} 件   {rate:>6.2f}%")

    report_lines.extend([
        "",
        "--------------------------------------------------------------------------------",
        " 5. Layer 3 制御シグナル照合状況 (Phase 3 への示唆)",
        "--------------------------------------------------------------------------------",
        f" 対象プロンプト総数: {len(control_signals)} 件",
        f" 照合成功数         : {ctrl_matched} 件 ({ctrl_matched/len(control_signals)*100:.2f}%)",
        "   - yn_function : " + f"{sum(1 for c in control_signals if c['callee_func']=='yn_function' and c['match_tier']!='UNMATCHED')} / {sum(1 for c in control_signals if c['callee_func']=='yn_function')}",
        "   - getlin      : " + f"{sum(1 for c in control_signals if c['callee_func']=='getlin' and c['match_tier']!='UNMATCHED')} / {sum(1 for c in control_signals if c['callee_func']=='getlin')}",
        "   - getdir      : " + f"{sum(1 for c in control_signals if c['callee_func']=='getdir' and c['match_tier']!='UNMATCHED')} / {sum(1 for c in control_signals if c['callee_func']=='getdir')}",
        "",
        "================================================================================",
        " レポート終了",
        "================================================================================",
    ])

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))

    print(f"[+] Phase 2 マッピング完了！ 一致率: {match_rate:.2f}% ({total_matched:,}/{total_messages:,})")


def main():
    parser = argparse.ArgumentParser(description="Map NetHack Source Messages to Existing Dictionary")
    parser.add_argument("--source-json", default="tools/data/source_messages.json", help="Path to source_messages.json")
    parser.add_argument("--dict-csv", default="dictionary.csv", help="Path to dictionary.csv")
    parser.add_argument("--output-dir", default="tools/data", help="Directory to output mapped data")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    source_json = repo_root / args.source_json
    dict_csv = repo_root / args.dict_csv
    output_dir = repo_root / args.output_dir

    run_mapping(source_json, dict_csv, output_dir)


if __name__ == "__main__":
    main()

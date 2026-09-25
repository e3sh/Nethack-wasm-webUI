#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_message_context_catalog.py
Phase 5 - Stage 5.2: 状況シグナル基盤用 メッセージコンテキストカタログ自動生成ツール
(完全言語非依存・Cコード式サニタイズ・三項演算子展開版)

入力:
  - tools/data/source_messages_mapped.json (14,849件 SSOT)
  - tools/data/control_signals_master.json (102件 制御シグナルマスタ)
出力:
  - src/core/message/data/MessageContextCatalog.js (ESM形式, 完全ASCII言語非依存, < 250KB)
"""

import os
import sys
import json
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MAPPED_MESSAGES_PATH = os.path.join(PROJECT_ROOT, "tools", "data", "source_messages_mapped.json")
CONTROL_SIGNALS_PATH = os.path.join(PROJECT_ROOT, "tools", "data", "control_signals_master.json")
OUTPUT_CATALOG_PATH = os.path.join(PROJECT_ROOT, "src", "core", "message", "data", "MessageContextCatalog.js")

SPEC_REGEX = re.compile(r'(%[0-9]*\.?[0-9]*[sdulc\%])')

def pattern_to_regex(text):
    """
    C言語の printf 形式フォーマット文字列を JavaScript 用の正規表現文字列に変換する
    """
    parts = SPEC_REGEX.split(text)
    pattern = "^"
    param_types = []
    prefix_locked = False
    prefix_literal = ""

    for part in parts:
        if not part:
            continue
        if part == '%s':
            prefix_locked = True
            pattern += r'(.*?)'
            param_types.append('string')
        elif part in {'%d', '%u', '%ld', '%lu', '%hd', '%hu', '%li'}:
            prefix_locked = True
            pattern += r'(-?\d+)'
            param_types.append('number')
        elif part == '%c':
            prefix_locked = True
            pattern += r'(.)'
            param_types.append('char')
        elif part == '%%':
            if not prefix_locked:
                prefix_literal += '%'
            pattern += r'%'
        elif SPEC_REGEX.match(part):
            prefix_locked = True
            pattern += r'(.*?)'
            param_types.append('unknown')
        else:
            if not prefix_locked:
                prefix_literal += part
            pattern += re.escape(part)

    pattern += "$"
    return pattern, param_types, prefix_literal


def infer_metadata(full_text, callee):
    meta = {}
    # 耐性・感覚の推論 (Cソースの英文キーワードから純粋に判定)
    if callee == "You_feel":
        text_lower = full_text.lower()
        if "hot" in text_lower or "warm" in text_lower:
            meta["intrinsic"] = "fire_resistance"
        elif "cold" in text_lower or "chill" in text_lower:
            meta["intrinsic"] = "cold_resistance"
        elif "shock" in text_lower or "electric" in text_lower:
            meta["intrinsic"] = "shock_resistance"
        elif "healthy" in text_lower or "poison" in text_lower:
            meta["intrinsic"] = "poison_resistance"
        elif "sleep" in text_lower:
            meta["intrinsic"] = "sleep_resistance"
        elif "vulnerable" in text_lower:
            meta["intrinsic"] = "vulnerability"
        elif "invisible" in text_lower:
            meta["intrinsic"] = "invisibility"
        elif "float" in text_lower or "levitat" in text_lower:
            meta["intrinsic"] = "levitation"

    # サウンド分類の推論 (Cソースの英文キーワードから純粋に判定)
    if callee == "You_hear":
        meta["soundCategory"] = "HEAR"
        text_lower = full_text.lower()
        if "crash" in text_lower or "rumble" in text_lower:
            meta["soundId"] = "se_rumble"
        elif "chink" in text_lower or "clink" in text_lower or "coin" in text_lower:
            meta["soundId"] = "se_coins"
        elif "door" in text_lower or "slam" in text_lower:
            meta["soundId"] = "se_door"

    return meta


def expand_ternary(text, callee):
    """
    C言語の三項演算子 (例: 'You feel Hallucination ? "totally together, man." : "very firm."')
    を実際に Wasm から届く2つの独立した文字列リテラルへ展開する
    """
    m = re.search(r'^(.*?)\s*([!a-zA-Z0-9_.><= \(\)]+)\s*\?\s*\"([^\"]+)\"\s*:\s*\"([^\"]+)\"$', text, re.DOTALL)
    if m:
        prefix, cond, opt1, opt2 = m.groups()
        prefix = prefix.strip()

        # callee マクロがプレフィックスを付ける性質がある場合の補正
        if not prefix:
            if callee == 'You_feel':
                prefix = 'You feel'
            elif callee == 'You_cant':
                prefix = "You can't"
            elif callee == 'You_hear':
                prefix = 'You hear'
            elif callee == 'You':
                prefix = 'You'

        cand1 = f"{prefix} {opt1}".strip() if prefix else opt1
        cand2 = f"{prefix} {opt2}".strip() if prefix else opt2
        # 改行を除去してクリーンな単一行に整形
        cand1 = " ".join(cand1.split())
        cand2 = " ".join(cand2.split())
        return [cand1, cand2]
    return None


def is_c_code_expression(text):
    """
    Wasm / Shim から届くはずのない C 言語のコード構文、マクロ、演算子、改行を検知する
    """
    if '\n' in text or '\r' in text:
        return True
    if '->' in text:
        return True
    # 三項演算子: ' ? ' や '? "'
    if re.search(r'\s+\?\s+', text) or re.search(r'\?\s*\"', text):
        return True
    if any(op in text for op in ['==', '!=', '&&', '||', '>=', '<=', '++', '--']):
        return True
    if any(cast in text for cast in ['(char *)', 'const char *', 'char *', '(int)', '(boolean)']):
        return True
    # Cマクロ・変数・関数名
    if any(text.startswith(p) for p in ['rn2(', 'umoney', 'Hallucination', 'mtmp', 'u.', 'not_upset', 'de->', 'hidden_gold(', 'fmt']):
        return True
    # 単なる変数名らしきもの (空白がなく、小文字とアンダースコアだけ等)
    if re.match(r'^[a-z_][a-z0-9_]*$', text):
        return True
    return False


def main():
    print(f"Loading {MAPPED_MESSAGES_PATH}...")
    with open(MAPPED_MESSAGES_PATH, "r", encoding="utf-8") as f:
        mapped_data = json.load(f)
    messages = mapped_data.get("messages", [])
    print(f"Total source messages: {len(messages)}")

    print(f"Loading {CONTROL_SIGNALS_PATH}...")
    with open(CONTROL_SIGNALS_PATH, "r", encoding="utf-8") as f:
        control_data = json.load(f)
    control_signals = control_data.get("signals", [])
    print(f"Total control signals: {len(control_signals)}")

    selected = {}
    l1_funcs = {'You_feel', 'You_hear', 'You_cant', 'verbalize'}
    l2_files = {'eat.c', 'potion.c', 'read.c', 'zap.c', 'pray.c', 'trap.c', 'lock.c', 'shk.c', 'end.c'}
    exclude_callees = {'impossible', 'panic'}

    # 1. Layer 1: 視点・知覚メッセージ (約615件)
    l1_count = 0
    for m in messages:
        if m.get("callee_func") in l1_funcs:
            selected[m["id"]] = (1, m)
            l1_count += 1
    print(f"Layer 1 extracted: {l1_count} entries")

    # 2. Layer 2: ドメイン重要メッセージ (eat, potion, read, zap, pray, trap, lock, shk, end)
    # 状態変化・効果音・アイテム識別に寄与するもの (仕様書要件: 約400〜600件)
    l2_target_roles = {
        'PLAYER_ACTION', 'PERCEPTION_FEELING', 'OBJECT_ACTION', 'PLAYER_CHANGE',
        'AUDIO_SE', 'VISUAL_PERCEPTION', 'NARRATION_URGENT', 'PLAYER_CONSTRAINT',
        'ENVIRONMENT_PRESENCE', 'SPEECH_DIALOG'
    }
    l2_count = 0
    for m in messages:
        mid = m["id"]
        if mid in selected or m.get("file") not in l2_files or m.get("callee_func") in exclude_callees:
            continue

        full_text = (m.get("full_text") or m.get("raw_format") or "").strip()
        if not full_text:
            continue

        callee = m.get("callee_func", "")
        role = m.get("semantic_role", "")

        # 状態変化・効果音・アイテム識別に寄与するロールまたは関数
        if role in l2_target_roles or callee in {'You', 'Your', 'You_see', 'urgent_pline'}:
            selected[mid] = (2, m)
            l2_count += 1
    print(f"Layer 2 extracted: {l2_count} entries")

    # 3. Layer 3: 制御プロンプト (control_signals_master.json)
    l3_count = 0
    control_signal_lookup = {}
    for sig in control_signals:
        mid = sig.get("id")
        if mid:
            control_signal_lookup[mid] = sig
            if mid not in selected:
                selected[mid] = (3, sig)
                l3_count += 1

    # 追加で yn_function / getlin / getdir を抽出
    l3_funcs = {'yn_function', 'getlin', 'getdir'}
    for m in messages:
        mid = m["id"]
        if m.get("callee_func") in l3_funcs and mid not in selected:
            selected[mid] = (3, m)
            l3_count += 1
    print(f"Layer 3 extracted: {l3_count} entries")
    print(f"Total entries selected: {len(selected)}")

    # カタログ構築 (コンパクト・タプル形式, 言語非依存, サニタイズ適用)
    # exact tuple: [id, file, domain, calleeFunc, semanticRole, layer, metadata]
    # pattern tuple: [id, file, domain, calleeFunc, semanticRole, layer, rawPattern, pattern, metadata, paramTypes]
    exact_catalog = {}
    pattern_catalog = []
    prefix_buckets = {
        "You feel ": [],
        "You hear ": [],
        "You can't ": [],
        "You cannot ": [],
        "The ": [],
        "It ": [],
        "*": []
    }

    skipped_code_noise = 0
    expanded_ternary_count = 0

    for mid, (layer_num, m) in selected.items():
        raw_source_text = m.get("full_text") or m.get("raw_format") or ""
        if not raw_source_text:
            continue

        callee = m.get("callee_func") or ""
        role = m.get("semantic_role") or "UNKNOWN"
        domain = m.get("domain") or m.get("file", "unknown").replace(".c", "")
        file_name = m.get("file") or ""
        placeholders_raw = m.get("placeholders") or []

        # 三項演算子の展開を試行
        candidates = []
        ternary_branches = expand_ternary(raw_source_text, callee)
        if ternary_branches:
            candidates = ternary_branches
            expanded_ternary_count += 1
        else:
            candidates = [raw_source_text]

        for full_text in candidates:
            # Cコード構文や改行ノイズを厳格にチェック
            if is_c_code_expression(full_text):
                skipped_code_noise += 1
                continue

            meta = infer_metadata(full_text, callee)
            if mid in control_signal_lookup:
                cs = control_signal_lookup[mid]
                meta["signalId"] = cs.get("assigned_signal_id")
                meta["subCategory"] = cs.get("assigned_sub_category")
                meta["inputType"] = cs.get("assigned_input_type")
                meta["promptFunc"] = cs.get("prompt_meta", {}).get("prompt_func")

            meta_val = meta if meta else None
            has_placeholders = bool(placeholders_raw) or bool(SPEC_REGEX.search(full_text))

            # 固定文字が何もない、単なる "%s" 等の全称パターンは誤爆を防ぐため除外
            literal_part = SPEC_REGEX.sub('', full_text).strip()
            if has_placeholders and not literal_part:
                continue

            if not has_placeholders:
                # タプル: [id, file, domain, calleeFunc, semanticRole, layer, metadata]
                exact_catalog[full_text] = [
                    mid,
                    file_name,
                    domain,
                    callee,
                    role,
                    layer_num,
                    meta_val
                ]
            else:
                regex_str, param_types, prefix_literal = pattern_to_regex(full_text)
                param_type_str = "".join(param_types) if param_types else ""
                idx = len(pattern_catalog)
                # タプル: [id, file, domain, calleeFunc, semanticRole, layer, rawPattern, pattern, metadata, paramTypeStr]
                pattern_catalog.append([
                    mid,
                    file_name,
                    domain,
                    callee,
                    role,
                    layer_num,
                    full_text,
                    regex_str,
                    meta_val,
                    param_type_str
                ])

                # プレフィックスバケット分類
                matched_bucket = False
                for bucket_key in prefix_buckets.keys():
                    if bucket_key != "*" and full_text.startswith(bucket_key):
                        prefix_buckets[bucket_key].append(idx)
                        matched_bucket = True
                        break
                if not matched_bucket:
                    prefix_buckets["*"].append(idx)

    print(f"Sanitization: Expanded {expanded_ternary_count} ternaries into clean branches.")
    print(f"Sanitization: Skipped {skipped_code_noise} non-runtime C code expressions / newlines.")
    print(f"Clean Exact match entries: {len(exact_catalog)}")
    print(f"Clean Pattern match entries: {len(pattern_catalog)}")
    for b_key, b_indices in prefix_buckets.items():
        print(f"  Prefix bucket '{b_key}': {len(b_indices)} entries")

    catalog_data = {
        "version": "1.0.0",
        "schema": {
            "exact": ["id", "file", "domain", "calleeFunc", "semanticRole", "layer", "metadata"],
            "pattern": ["id", "file", "domain", "calleeFunc", "semanticRole", "layer", "rawPattern", "pattern", "metadata", "paramTypes"]
        },
        "exact": exact_catalog,
        "patterns": pattern_catalog,
        "buckets": prefix_buckets
    }

    # コンパクト JSON 文字列を生成 (完全 ASCII)
    compact_json = json.dumps(catalog_data, ensure_ascii=True, separators=(',', ':'))

    js_content = f"""/**
 * MessageContextCatalog.js
 * Phase 5 - Stage 5.2: Situation Signal Engine Lightweight Runtime Context Catalog
 * 
 * Auto-generated by tools/build_message_context_catalog.py
 * Total clean exact entries: {len(exact_catalog)}
 * Total clean pattern entries: {len(pattern_catalog)}
 * Pure language-independent, sanitized C runtime context metadata (ASCII only, no code noise/newlines).
 */

export const MESSAGE_CONTEXT_CATALOG = {compact_json};

export default MESSAGE_CONTEXT_CATALOG;
"""

    os.makedirs(os.path.dirname(OUTPUT_CATALOG_PATH), exist_ok=True)
    with open(OUTPUT_CATALOG_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)

    file_size_bytes = os.path.getsize(OUTPUT_CATALOG_PATH)
    file_size_kb = file_size_bytes / 1024
    print(f"\nSuccessfully generated {OUTPUT_CATALOG_PATH}")
    print(f"File size: {file_size_kb:.2f} KB ({file_size_bytes} bytes)")

    # マルチバイト文字が存在しないか点検
    has_multibyte = any(ord(c) > 127 for c in js_content)
    if has_multibyte:
        print("WARNING: Multi-byte characters detected in catalog!")
    else:
        print("DoD Check: Pure ASCII (No multi-byte characters) PASSED")

    if file_size_kb >= 250:
        print(f"[FAIL] WARNING: File size exceeds 250KB limit ({file_size_kb:.2f} KB)!")
        sys.exit(1)
    else:
        print(f"[PASS] DoD Check: File size < 250KB PASSED ({file_size_kb:.2f} KB)")


if __name__ == "__main__":
    main()

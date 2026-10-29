#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_token_catalog.py
Phase 1: セマンティック・メッセージトークン化用 静的型付き構文カタログ自動生成ツール

入力:
  - tools/data/source_messages_mapped.json (14,849件 SSOT)
出力:
  - src/core/message/data/MessageTokenCatalog.js (ESM形式, < 300KB)

仕様書:
  docs/9_translation/semantic_message_tokenization_and_interactive_rendering_specification.ja.md
"""

import os
import sys
import json
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MAPPED_MESSAGES_PATH = os.path.join(PROJECT_ROOT, "tools", "data", "source_messages_mapped.json")
OUTPUT_CATALOG_PATH = os.path.join(PROJECT_ROOT, "src", "core", "message", "data", "MessageTokenCatalog.js")

SPEC_REGEX = re.compile(r'(%[0-9]*\.?[0-9]*[sdulc\%])')

# 一般的置換ストップワード (プレフィックスや前置詞単体での誤爆防止)
# V2: 'here' を除外して足元メッセージ (You see here ... / There is ... here) を救済
STOP_WORDS = {
    'you', 'your', 'the', 'an', 'a', 'it', 'there', 'is', 'are', 'was',
    'were', 'to', 'in', 'on', 'of', 'at', 'by', 'for', 'with', 'from',
    'and', 'or', 'that', 'this', 'into', 'onto', 'out',
    'some', 'get', 'gets', 'got', 'getting'
}

# 特定の過剰一般化メッセージや誤爆を引き起こすパターンの除外リスト (V2 サニタイズ)
EXCLUDED_MESSAGE_IDS = {
    'dokick.c:L169:There:3',  # "There is %s here." (足元地形メッセージ等へのモンスター誤爆防止)
    'mhitu.c:L1560:You:70',   # "You get %s!" (状態動詞文へのモンスター誤爆防止)
    'steal.c:L867:pline:25',  # "%s gold %s." ("100 gold pieces." への誤爆防止)
    'steed.c:L134:pline:10',  # "%s resists!" ("The door resists!" 等への誤爆防止)
    'steed.c:L308:pline:25',  # "%s resists%s!" ("The door resists!" 等への誤爆防止)
    'spell.c:L1051:pline:44', # "%s resists."
    'pickup.c:L2065:pline:33',# "%s locked."
    'pickup.c:L2068:pline:34',# "%s is locked."
    'pickup.c:L2954:pline:72',# "%s locked."
    'pickup.c:L3985:pline:88',# "%s is locked."
    'pickup.c:L4049:pline:89',# "%sbox is now empty."
    'pickup.c:L4057:pline:90',# "%s is empty."
    'dokick.c:L209:You:5',    # "You kick %s."
    'dokick.c:L251:You:7',    # "You kick %s."
    'dokick.c:L608:Norep:28', # "You kick %s."
    'dokick.c:L1054:You:54',  # "You kick %s."
    'dokick.c:L1068:You:55',  # "You kick %s."
    'dokick.c:L1262:You:73',  # "You kick %s."
}

def is_overgeneralized_pattern(fmt):
    """
    過剰一般化パターン判定:
    - "You kick %s." (対象がモンスターに限らず扉・壁・箱・流し台等)
    - 先頭が %s で固定単語が動詞/形容詞 1 語、または be動詞 + 1 語のみのパターン
      例: "%s resists!", "%s resists.", "%s locked.", "%s is locked.", "%s is empty."
    """
    fmt_clean = fmt.strip()
    if re.match(r'^You kick %s[\.\!]?$', fmt_clean):
        return True
    if re.match(r'^%s\s+(?:is\s+)?[a-zA-Z]+(%s)?[\.\!]?$', fmt_clean):
        return True
    return False

# 仕様書 §3.1 の分類ルール
MONSTER_PATTERNS = [
    re.compile(p) for p in [
        r'\bMonnam\b', r'\bmon_nam\b', r'\by_monnam\b', r'\bsome_mon_nam\b',
        r'\bx_monnam\b', r'\bnoit_mon_nam\b', r'\bShknam\b', r'\bshkname\b',
        r'\bAmonnam\b', r'\ba_monnam\b', r'\bnoit_mhis\b', r'\bm_monnam\b',
        r'\bmons\[', r'\bmtmp\b', r'\bm_name\b'
    ]
]

ITEM_PATTERNS = [
    re.compile(p) for p in [
        r'\bdoname\b', r'\bxname\b', r'\byname\b', r'\bYname2\b',
        r'\bthe\(', r'\ban\(', r'\bsimpleonames\b', r'\bcxname\b',
        r'\baobjnam\b', r'\bTobjnam\b', r'\bbare_why_name\b', r'\bobjects\[',
        r'\botmp\b', r'\bsingular\('
    ]
]

def extract_ternary_branches(expr):
    """
    三項演算子 (A ? B : C) から値となる枝 (B, C...) を再帰的に抽出する。
    三項演算子でない場合は [expr] を返す。
    """
    expr = expr.strip()
    while expr.startswith('(') and expr.endswith(')'):
        depth = 0
        enclosed = True
        for i, ch in enumerate(expr[:-1]):
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    enclosed = False
                    break
        if enclosed:
            expr = expr[1:-1].strip()
        else:
            break

    depth = 0
    in_str = False
    escape = False
    q_pos = -1

    for i, ch in enumerate(expr):
        if escape:
            escape = False
            continue
        if ch == '\\':
            escape = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch in '([{':
            depth += 1
        elif ch in ')]}':
            depth -= 1
        elif ch == '?' and depth == 0:
            q_pos = i
            break

    if q_pos == -1:
        return [expr]

    ternary_depth = 1
    colon_pos = -1
    depth = 0
    in_str = False
    escape = False

    for i in range(q_pos + 1, len(expr)):
        ch = expr[i]
        if escape:
            escape = False
            continue
        if ch == '\\':
            escape = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch in '([{':
            depth += 1
        elif ch in ')]}':
            depth -= 1
        elif depth == 0:
            if ch == '?':
                ternary_depth += 1
            elif ch == ':':
                ternary_depth -= 1
                if ternary_depth == 0:
                    colon_pos = i
                    break

    if colon_pos == -1:
        return [expr]

    true_expr = expr[q_pos + 1:colon_pos].strip()
    false_expr = expr[colon_pos + 1:].strip()

    return extract_ternary_branches(true_expr) + extract_ternary_branches(false_expr)


def is_string_literal(expr):
    expr = expr.strip()
    return (expr.startswith('"') and expr.endswith('"')) or (expr.startswith("'") and expr.endswith("'"))


def classify_single_expr(expr):
    if is_string_literal(expr):
        return 'text'
    for mp in MONSTER_PATTERNS:
        if mp.search(expr):
            return 'monster'
    for ip in ITEM_PATTERNS:
        if ip.search(expr):
            return 'item'
    return 'text'


def classify_arg(arg_expr):
    """
    C引数式からTokenType ('monster' | 'item' | 'text') を分類
    三項演算子の場合は値ブランチを抽出して評価する。
    """
    if not arg_expr or not isinstance(arg_expr, str):
        return 'text'

    branches = extract_ternary_branches(arg_expr)
    if all(is_string_literal(b) for b in branches):
        return 'text'

    for b in branches:
        res = classify_single_expr(b)
        if res in ('monster', 'item'):
            return res

    return 'text'


def is_c_code_expression(text):
    """
    Wasm / Shim から届くはずのない C 言語のコード構文、マクロ、演算子、改行を検知する
    """
    if '\n' in text or '\r' in text:
        return True
    if '->' in text:
        return True
    if re.search(r'\s+\?\s+', text) or re.search(r'\?\s*\"', text):
        return True
    if any(op in text for op in ['==', '!=', '&&', '||', '>=', '<=', '++', '--']):
        return True
    if any(cast in text for cast in ['(char *)', 'const char *', 'char *', '(int)', '(boolean)']):
        return True
    if any(text.startswith(p) for p in ['rn2(', 'umoney', 'Hallucination', 'mtmp', 'u.', 'not_upset', 'de->', 'hidden_gold(', 'fmt']):
        return True
    if re.match(r'^[a-z_][a-z0-9_]*$', text):
        return True
    return False


def has_substantial_literal(fmt):
    """
    過剰一般化ワイルドカードパターン（動的バッファ構築文）を除外する
    """
    # 連続するプレースホルダー (%s %s 等) はコンテキスト不確定のため除外
    if re.search(r'%[sdulc]\s*%[sdulc]', fmt):
        return False
    # 固定文字列部分の抽出
    literal = SPEC_REGEX.sub(' ', fmt)
    words = re.findall(r'[a-zA-Z]{3,}', literal)
    meaningful = [w for w in words if w.lower() not in STOP_WORDS]
    return len(meaningful) > 0


def expand_ternary(text, callee):
    """
    C言語の三項演算子を展開する
    """
    m = re.search(r'^(.*?)\s*([!a-zA-Z0-9_.><= \(\)]+)\s*\?\s*\"([^\"]+)\"\s*:\s*\"([^\"]+)\"$', text, re.DOTALL)
    if m:
        prefix, cond, opt1, opt2 = m.groups()
        prefix = prefix.strip()
        if not prefix:
            if callee == 'You_feel':
                prefix = 'You feel'
            elif callee == 'You_cant':
                prefix = "You can't"
            elif callee == 'You_hear':
                prefix = 'You hear'
            elif callee == 'You':
                prefix = 'You'
            elif callee == 'Your':
                prefix = 'Your'

        cand1 = f"{prefix} {opt1}".strip() if prefix else opt1
        cand2 = f"{prefix} {opt2}".strip() if prefix else opt2
        cand1 = " ".join(cand1.split())
        cand2 = " ".join(cand2.split())
        return [cand1, cand2]
    return None


def pattern_to_regex(text):
    """
    C言語の printf 形式フォーマット文字列を JavaScript 用の正規表現文字列に変換する
    キャプチャグループ () を作成
    """
    parts = SPEC_REGEX.split(text)
    pattern = "^"
    prefix_locked = False
    prefix_literal = ""

    for part in parts:
        if not part:
            continue
        if part == '%s':
            prefix_locked = True
            pattern += r'(.*?)'
        elif part in {'%d', '%u', '%ld', '%lu', '%hd', '%hu', '%li'}:
            prefix_locked = True
            pattern += r'(-?\d+)'
        elif part == '%c':
            prefix_locked = True
            pattern += r'(.)'
        elif part == '%%':
            if not prefix_locked:
                prefix_literal += '%'
            pattern += r'%'
        elif SPEC_REGEX.match(part):
            prefix_locked = True
            pattern += r'(.*?)'
        else:
            if not prefix_locked:
                prefix_literal += part
            pattern += re.escape(part)

    pattern += "$"
    return pattern, prefix_literal


def main():
    print(f"Loading {MAPPED_MESSAGES_PATH}...")
    with open(MAPPED_MESSAGES_PATH, "r", encoding="utf-8") as f:
        mapped_data = json.load(f)
    messages = mapped_data.get("messages", [])
    print(f"Total source messages: {len(messages)}")

    raw_entries = []
    seen_patterns = set()

    skipped_code = 0
    expanded_ternary = 0

    for m in messages:
        c_args = m.get("c_arguments") or []
        if len(c_args) < 2:
            continue

        raw_source_text = m.get("full_text") or m.get("raw_format") or ""
        if not raw_source_text:
            continue

        callee = m.get("callee_func") or ""
        file_name = m.get("file") or ""
        mid = m.get("id") or ""

        if mid in EXCLUDED_MESSAGE_IDS:
            continue

        candidates = []
        ternary_branches = expand_ternary(raw_source_text, callee)
        if ternary_branches:
            candidates = ternary_branches
            expanded_ternary += 1
        else:
            candidates = [raw_source_text]

        for text_cand in candidates:
            if is_c_code_expression(text_cand):
                skipped_code += 1
                continue

            # V2: 単一動詞・形容詞等の過剰一般化パターンを除外
            if is_overgeneralized_pattern(text_cand):
                continue

            specs = [s for s in SPEC_REGEX.findall(text_cand) if s != '%%']
            if not specs:
                continue

            # 過剰一般化パターンの除外 (意味のある固定単語を必須とする)
            if not has_substantial_literal(text_cand):
                continue

            raw_c_args = c_args[1:]
            if len(specs) != len(raw_c_args):
                continue

            types = [classify_arg(arg) for arg in raw_c_args]
            if not any(t in ('monster', 'item') for t in types):
                continue

            pattern, prefix_lit = pattern_to_regex(text_cand)

            pattern_key = f"{pattern}|{','.join(types)}"
            if pattern_key in seen_patterns:
                continue
            seen_patterns.add(pattern_key)

            # 固定リテラルの長さ (特定性 specificity) を計算
            literal_len = len(SPEC_REGEX.sub('', text_cand))

            raw_entries.append({
                'entry': [pattern, types, mid, callee, file_name],
                'full_text': text_cand,
                'literal_len': literal_len
            })

    # 特定性（固定文字数）の降順でソート（より具体的なパターンを最優先で照合）
    raw_entries.sort(key=lambda x: x['literal_len'], reverse=True)

    token_catalog = []
    prefix_buckets = {
        "You ": [],
        "Your ": [],
        "The ": [],
        "An ": [],
        "A ": [],
        "It ": [],
        "*": []
    }

    for item in raw_entries:
        entry_idx = len(token_catalog)
        token_catalog.append(item['entry'])
        text_cand = item['full_text']

        assigned = False
        for pfix in ["You ", "Your ", "The ", "An ", "A ", "It "]:
            if text_cand.startswith(pfix):
                prefix_buckets[pfix].append(entry_idx)
                assigned = True
                break
        if not assigned:
            prefix_buckets["*"].append(entry_idx)

    print(f"Extracted {len(token_catalog)} token pattern entries (filtered & sorted by specificity).")
    print(f"Skipped C code noise: {skipped_code}, Expanded ternary: {expanded_ternary}")

    js_content = f"""/**
 * MessageTokenCatalog.js
 * Generated by tools/build_token_catalog.py
 * Phase 1: 静的型付き構文カタログ (目標 < 300KB)
 *
 * トークン抽出用コンパクトタプル形式 (特定性降順ソート済):
 * [regexPattern, tokenTypes, id, callee, file]
 */

export const TOKEN_PATTERNS = {json.dumps(token_catalog, ensure_ascii=True, separators=(',', ':'))};

export const TOKEN_PREFIX_BUCKETS = {json.dumps(prefix_buckets, ensure_ascii=True, separators=(',', ':'))};

export default {{
    patterns: TOKEN_PATTERNS,
    prefixBuckets: TOKEN_PREFIX_BUCKETS
}};
"""

    os.makedirs(os.path.dirname(OUTPUT_CATALOG_PATH), exist_ok=True)
    with open(OUTPUT_CATALOG_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)

    file_size_kb = os.path.getsize(OUTPUT_CATALOG_PATH) / 1024.0
    print(f"Successfully generated {OUTPUT_CATALOG_PATH}")
    print(f"File size: {file_size_kb:.2f} KB (DoD limit: < 300 KB)")

    if file_size_kb >= 300.0:
        print("WARNING: Catalog file size exceeds 300KB DoD limit!", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

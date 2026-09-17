#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
extract_source_messages.py

Vanilla NetHack 5.0 の C ソースコードおよび dat ファイルから、
ゲーム内で使用される全メッセージ・プロンプト・LOREテキストを
コンテキスト情報（呼び出し関数、ファイル、行番号、セマンティクス、フォーマット指定子、プロンプトメタ情報等）
付きで網羅抽出し、構造化マスタ（JSON / CSV）を生成するツール。
"""

import os
import sys
import re
import csv
import json
import argparse
from typing import List, Dict, Any, Optional, Tuple

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

# ----------------------------------------------------------------------
# 1. カタログ定義 (関数セマンティクス & レイヤー & ドメイン)
# ----------------------------------------------------------------------

# (layer, semantic_role, primary_format_arg_idx)
MESSAGE_FUNCTIONS = {
    # Layer 1: 客観ナレーション・システム
    "pline": (1, "NARRATION_PLINE", 0),
    "urgent_pline": (1, "NARRATION_URGENT", 0),
    "Norep": (1, "NARRATION_NOREP", 0),
    "raw_printf": (1, "SYSTEM_RAW", 0),
    "impossible": (1, "SYSTEM_WARNING", 0),
    
    # Layer 1: 視点・感覚・能動的行動
    "You": (1, "PLAYER_ACTION", 0),
    "Your": (1, "PLAYER_CHANGE", 0),
    "You_feel": (1, "PERCEPTION_FEELING", 0),
    "You_hear": (1, "AUDIO_SE", 0),
    "You_hear1": (1, "AUDIO_SE", 0),
    "You_cant": (1, "PLAYER_CONSTRAINT", 0),
    "You_see": (1, "VISUAL_PERCEPTION", 0),
    "There": (1, "ENVIRONMENT_PRESENCE", 0),
    "verbalize": (1, "SPEECH_DIALOG", 0),
    "pline_The": (1, "OBJECT_ACTION", 0),
    "pline_mon": (1, "MONSTER_EVENT", 0),

    # Layer 3: 制御・対話プロンプト
    "yn_function": (3, "PROMPT_YN", 0),
    "getlin": (3, "PROMPT_GETLIN", 0),
    "getdir": (3, "PROMPT_GETDIR", 0),
}

DOMAIN_MAP = {
    "eat.c": "eat/hunger",
    "pray.c": "pray/gods",
    "potion.c": "item/potion",
    "read.c": "item/scroll",
    "zap.c": "item/wand_spell",
    "uhitm.c": "combat/player_attack",
    "mhitu.c": "combat/monster_attack",
    "mhitm.c": "combat/monster_vs_monster",
    "trap.c": "trap",
    "shk.c": "shop",
    "shknam.c": "shop",
    "end.c": "game_over/score",
    "engrave.c": "engrave",
    "teleport.c": "teleport",
    "polyself.c": "polymorph",
    "mon.c": "monster",
    "monmove.c": "monster",
    "mondata.c": "monster",
    "invent.c": "inventory",
    "pickup.c": "pickup",
    "objnam.c": "inventory",
    "spell.c": "spell",
    "artifact.c": "artifact",
    "detect.c": "detection",
    "dokick.c": "kick",
    "dothrow.c": "throw",
    "fountain.c": "fountain",
    "sit.c": "sit/throne",
    "vault.c": "vault",
    "vision.c": "vision",
    "weapon.c": "weapon",
    "wield.c": "wield",
    "worn.c": "wear",
    "do_wear.c": "wear",
    "apply.c": "apply/tool",
    "cmd.c": "command",
    "botl.c": "status_hud",
    "do.c": "general_action",
    "do_name.c": "naming",
    "dungeon.c": "dungeon",
    "explode.c": "explosion",
    "light.c": "light",
    "lock.c": "door/container",
    "makemon.c": "monster_generation",
    "muse.c": "monster_ai",
    "options.c": "options",
    "pager.c": "pager/help",
    "quest.c": "quest",
    "region.c": "region",
    "restore.c": "save_restore",
    "rip.c": "tombstone",
    "rnd.c": "random",
    "role.c": "role/character_creation",
    "rumors.c": "rumors",
    "save.c": "save_restore",
    "sounds.c": "sound",
    "sp_lev.c": "special_levels",
    "steed.c": "steed/mount",
    "sys.c": "system",
    "timeout.c": "timer/timeout",
    "topten.c": "score_ranking",
    "track.c": "track",
    "version.c": "version",
    "were.c": "lycanthropy",
    "windows.c": "windowport",
    "wizard.c": "wizard_mode",
    "worm.c": "worm",
    "write.c": "writing",
}

# ----------------------------------------------------------------------
# 2. C言語字句解析器・構文パーサ
# ----------------------------------------------------------------------

class CTokenizer:
    """Cソースコードのコメント除去、文字列連結、引数ネスト解析を行うパーサ"""

    @staticmethod
    def strip_comments_preserve_lines(text: str) -> str:
        """行数を維持しながら /*...*/ および //... コメントをスペース・改行に置換"""
        out = []
        i = 0
        n = len(text)
        in_string = False
        in_char = False
        escape = False

        while i < n:
            ch = text[i]

            if in_string:
                out.append(ch)
                if escape:
                    escape = False
                elif ch == '\\':
                    escape = True
                elif ch == '"':
                    in_string = False
                i += 1
                continue

            if in_char:
                out.append(ch)
                if escape:
                    escape = False
                elif ch == '\\':
                    escape = True
                elif ch == "'":
                    in_char = False
                i += 1
                continue

            if ch == '"':
                in_string = True
                out.append(ch)
                i += 1
                continue

            if ch == "'":
                in_char = True
                out.append(ch)
                i += 1
                continue

            # ブロックコメント /* ... */
            if ch == '/' and i + 1 < n and text[i + 1] == '*':
                i += 2
                while i < n:
                    if text[i] == '*' and i + 1 < n and text[i + 1] == '/':
                        i += 2
                        break
                    if text[i] == '\n':
                        out.append('\n')
                    else:
                        out.append(' ')
                    i += 1
                continue

            # 行コメント // ...
            if ch == '/' and i + 1 < n and text[i + 1] == '/':
                i += 2
                while i < n and text[i] != '\n':
                    out.append(' ')
                    i += 1
                continue

            out.append(ch)
            i += 1

        return "".join(out)

    @staticmethod
    def extract_arguments(args_text: str) -> List[str]:
        """引数テキスト (カンマ区切り) をネストやクォートを尊重して安全に分割"""
        args = []
        current = []
        depth_paren = 0
        depth_brace = 0
        depth_bracket = 0
        in_string = False
        in_char = False
        escape = False

        for ch in args_text:
            if in_string:
                current.append(ch)
                if escape:
                    escape = False
                elif ch == '\\':
                    escape = True
                elif ch == '"':
                    in_string = False
                continue

            if in_char:
                current.append(ch)
                if escape:
                    escape = False
                elif ch == '\\':
                    escape = True
                elif ch == "'":
                    in_char = False
                continue

            if ch == '"':
                in_string = True
                current.append(ch)
                continue

            if ch == "'":
                in_char = True
                current.append(ch)
                continue

            if ch == '(':
                depth_paren += 1
            elif ch == ')':
                depth_paren = max(0, depth_paren - 1)
            elif ch == '{':
                depth_brace += 1
            elif ch == '}':
                depth_brace = max(0, depth_brace - 1)
            elif ch == '[':
                depth_bracket += 1
            elif ch == ']':
                depth_bracket = max(0, depth_bracket - 1)

            if ch == ',' and depth_paren == 0 and depth_brace == 0 and depth_bracket == 0:
                args.append("".join(current).strip())
                current = []
            else:
                current.append(ch)

        if current:
            args.append("".join(current).strip())

        return args

    @staticmethod
    def parse_string_literals(raw_arg: str) -> Optional[str]:
        """
        引数文字列から、連続するC文字列リテラル ("foo" \n "bar") を結合して抽出。
        単純リテラルでない場合（式や変数）は None を返す。
        """
        stripped = raw_arg.strip()
        if not stripped.startswith('"'):
            return None

        i = 0
        n = len(stripped)
        combined = []
        found_any = False

        while i < n:
            while i < n and stripped[i].isspace():
                i += 1
            if i >= n:
                break

            if stripped[i] != '"':
                return None

            i += 1
            str_chars = []
            escape = False
            closed = False
            while i < n:
                ch = stripped[i]
                if escape:
                    if ch == 'n':
                        str_chars.append('\n')
                    elif ch == 't':
                        str_chars.append('\t')
                    elif ch == 'r':
                        str_chars.append('\r')
                    elif ch == '"':
                        str_chars.append('"')
                    elif ch == '\\':
                        str_chars.append('\\')
                    else:
                        str_chars.append(ch)
                    escape = False
                elif ch == '\\':
                    escape = True
                elif ch == '"':
                    closed = True
                    i += 1
                    break
                else:
                    str_chars.append(ch)
                i += 1

            if not closed:
                return None

            combined.append("".join(str_chars))
            found_any = True

        if found_any:
            return "".join(combined)
        return None

    @staticmethod
    def extract_placeholders(format_str: str) -> List[Dict[str, Any]]:
        """フォーマット文字列から %s, %d, %u 等の指定子を解析"""
        pattern = re.compile(r'%([0-9]+\$)?([-+0 #*]*)([0-9]*|\*)(\.([0-9]*|\*))?([hljztL]|ll)?([diuoxXfFeEgGaAcspn%])')
        placeholders = []
        for idx, m in enumerate(pattern.finditer(format_str)):
            full = m.group(0)
            if full == '%%':
                continue
            specifier = m.group(7)
            length = m.group(6) or ""
            placeholders.append({
                "index": idx,
                "raw": full,
                "specifier": f"%{length}{specifier}",
                "type": "string" if specifier == 's' else ("char" if specifier == 'c' else "number")
            })
        return placeholders


# ----------------------------------------------------------------------
# 3. Cソース メッセージエクストラクタ
# ----------------------------------------------------------------------

class CSourceExtractor:
    def __init__(self, src_dir: str):
        self.src_dir = src_dir
        func_names_regex = "|".join(re.escape(f) for f in MESSAGE_FUNCTIONS.keys())
        self.call_pattern = re.compile(rf'\b({func_names_regex})\s*\(', re.MULTILINE)

    def extract_from_file(self, filename: str) -> List[Dict[str, Any]]:
        filepath = os.path.join(self.src_dir, filename)
        if not os.path.exists(filepath):
            return []

        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            raw_content = f.read()

        clean_content = CTokenizer.strip_comments_preserve_lines(raw_content)
        lines = raw_content.splitlines(keepends=True)
        line_offsets = []
        offset = 0
        for l in lines:
            line_offsets.append(offset)
            offset += len(l)

        def get_line_no(char_idx: int) -> int:
            import bisect
            return bisect.bisect_right(line_offsets, char_idx)

        caller_map = self._build_caller_map(clean_content, get_line_no)
        results = []
        domain = DOMAIN_MAP.get(filename, filename.replace('.c', ''))

        for match in self.call_pattern.finditer(clean_content):
            func_name = match.group(1)
            start_paren_idx = match.end() - 1  # '(' の位置
            line_no = get_line_no(match.start())

            end_paren_idx = self._find_closing_paren(clean_content, start_paren_idx)
            if end_paren_idx == -1:
                continue

            args_text = clean_content[start_paren_idx + 1:end_paren_idx]
            args = CTokenizer.extract_arguments(args_text)

            layer, semantic_role, fmt_arg_idx = MESSAGE_FUNCTIONS[func_name]

            raw_arg = args[fmt_arg_idx] if len(args) > fmt_arg_idx else ""
            parsed_literal = CTokenizer.parse_string_literals(raw_arg)

            caller_func = caller_map.get(line_no, "unknown")
            unique_id = f"{filename}:L{line_no}:{func_name}:{len(results)}"

            literal_type = "literal" if parsed_literal is not None else "variable"
            if parsed_literal is None and '?' in raw_arg and ':' in raw_arg:
                literal_type = "conditional"

            entry = {
                "id": unique_id,
                "source_type": "c_source",
                "file": filename,
                "line": line_no,
                "caller_func": caller_func,
                "callee_func": func_name,
                "layer": layer,
                "semantic_role": semantic_role,
                "domain": domain,
                "literal_type": literal_type,
                "raw_format": parsed_literal if parsed_literal is not None else raw_arg,
                "placeholders": CTokenizer.extract_placeholders(parsed_literal) if parsed_literal else [],
                "c_arguments": args,
                "prompt_meta": None,
                "lore_meta": None,
            }

            if layer == 3:
                entry["prompt_meta"] = self._parse_prompt_meta(func_name, args)

            if entry["literal_type"] == "variable":
                inferred = self._infer_variable_assignment(clean_content, start_paren_idx, raw_arg)
                if inferred:
                    entry["inferred_format"] = inferred
                    if not entry["placeholders"]:
                        entry["placeholders"] = CTokenizer.extract_placeholders(inferred)

            results.append(entry)

        return results

    def _find_closing_paren(self, text: str, start_paren: int) -> int:
        depth = 0
        in_string = False
        in_char = False
        escape = False
        n = len(text)

        for i in range(start_paren, n):
            ch = text[i]
            if in_string:
                if escape:
                    escape = False
                elif ch == '\\':
                    escape = True
                elif ch == '"':
                    in_string = False
                continue

            if in_char:
                if escape:
                    escape = False
                elif ch == '\\':
                    escape = True
                elif ch == "'":
                    in_char = False
                continue

            if ch == '"':
                in_string = True
            elif ch == "'":
                in_char = True
            elif ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    return i
        return -1

    C_CONTROL_KEYWORDS = {'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'return', 'sizeof'}

    def _build_caller_map(self, clean_text: str, get_line_no_func) -> Dict[int, str]:
        """C関数の定義開始箇所を検出し、行番号に対応付ける"""
        caller_map = {}
        # 関数定義パターン: 戻り値の型 + 改行または空白 + 関数名 + ( ... ) + {
        func_def_pattern = re.compile(
            r'^[ \t]*(?:(?:static|staticfn|extern|inline|void|int|char|long|short|unsigned|boolean|booleanfn|const|struct\s+[a-zA-Z0-9_]+|union\s+[a-zA-Z0-9_]+)\b[*\s\n]+)+([a-zA-Z0-9_]+)\s*\([^;{}]*\)\s*(?:[^{};]*\n)?\s*\{',
            re.MULTILINE
        )
        matches = []
        for m in func_def_pattern.finditer(clean_text):
            fname = m.group(1)
            if fname not in self.C_CONTROL_KEYWORDS:
                matches.append((m.start(), fname))

        for i, (m_start, fname) in enumerate(matches):
            start_line = get_line_no_func(m_start)
            end_line = get_line_no_func(matches[i + 1][0]) if i + 1 < len(matches) else 999999
            for l in range(start_line, end_line):
                caller_map[l] = fname
        return caller_map

    def _parse_prompt_meta(self, func_name: str, args: List[str]) -> Dict[str, Any]:
        meta = {"prompt_func": func_name}
        if func_name == "yn_function":
            valid_keys = args[1] if len(args) > 1 else ""
            default_key = args[2] if len(args) > 2 else ""
            meta["valid_keys_raw"] = valid_keys
            meta["default_key_raw"] = default_key
            parsed_keys = CTokenizer.parse_string_literals(valid_keys)
            if parsed_keys is not None:
                meta["valid_keys"] = parsed_keys
            if default_key.startswith("'") and len(default_key) >= 3:
                meta["default_key"] = default_key[1:-1]
        elif func_name == "getlin":
            meta["target_buf"] = args[1] if len(args) > 1 else ""
        elif func_name == "getdir":
            pass
        return meta

    def _infer_variable_assignment(self, text: str, call_idx: int, var_name: str) -> Optional[str]:
        clean_var = var_name.strip()
        if not re.match(r'^[a-zA-Z0-9_]+$', clean_var):
            return None
        window_start = max(0, call_idx - 2500)
        window = text[window_start:call_idx]

        # Sprintf(qbuf, "...", ...) パターン
        sprintf_pattern = re.compile(rf'\bSprintf\s*\(\s*{re.escape(clean_var)}\s*,\s*"((?:[^"\\]|\\.)+)"')
        matches = list(sprintf_pattern.finditer(window))
        if matches:
            return matches[-1].group(1)
        # Strcpy(qbuf, "...") パターン
        strcpy_pattern = re.compile(rf'\bStrcpy\s*\(\s*{re.escape(clean_var)}\s*,\s*"((?:[^"\\]|\\.)+)"')
        matches_strcpy = list(strcpy_pattern.finditer(window))
        if matches_strcpy:
            return matches_strcpy[-1].group(1)
        return None


# ----------------------------------------------------------------------
# 4. データファイル (`dat/*`) エクストラクタ
# ----------------------------------------------------------------------

class DatFileExtractor:
    def __init__(self, dat_dir: str):
        self.dat_dir = dat_dir

    def extract_all(self) -> List[Dict[str, Any]]:
        results = []
        results.extend(self.extract_rumors())
        results.extend(self.extract_oracles())
        results.extend(self.extract_engrave())
        results.extend(self.extract_epitaph())
        results.extend(self.extract_bogusmon())
        results.extend(self.extract_quest_lua())
        results.extend(self.extract_tribute())
        results.extend(self.extract_help_files())
        return results

    def extract_rumors(self) -> List[Dict[str, Any]]:
        results = []
        for fname, is_true in [('rumors.tru', True), ('rumors.fal', False)]:
            path = os.path.join(self.dat_dir, fname)
            if not os.path.exists(path):
                continue
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_idx, line in enumerate(f, start=1):
                    stripped = line.strip()
                    if not stripped or stripped.startswith('#') or stripped.startswith('%'):
                        continue
                    results.append({
                        "id": f"{fname}:L{line_idx}",
                        "source_type": "dat_file",
                        "file": fname,
                        "line": line_idx,
                        "caller_func": None,
                        "callee_func": None,
                        "layer": 4,
                        "semantic_role": "LORE_RUMOR",
                        "domain": "rumors",
                        "literal_type": "literal",
                        "raw_format": stripped,
                        "placeholders": [],
                        "c_arguments": [],
                        "prompt_meta": None,
                        "lore_meta": {
                            "is_true": is_true,
                            "type": "true_rumor" if is_true else "false_rumor"
                        }
                    })
        return results

    def extract_oracles(self) -> List[Dict[str, Any]]:
        path = os.path.join(self.dat_dir, 'oracles.txt')
        if not os.path.exists(path):
            return []
        results = []
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            current_block = []
            block_start_line = 1
            for line_idx, line in enumerate(f, start=1):
                stripped = line.strip()
                if stripped == '-----':
                    if current_block:
                        text = " ".join(current_block)
                        results.append(self._make_lore_entry('oracles.txt', block_start_line, text, "LORE_ORACLE", "oracles"))
                        current_block = []
                    block_start_line = line_idx + 1
                    continue
                if not stripped or stripped.startswith('#'):
                    continue
                current_block.append(stripped)
            if current_block:
                text = " ".join(current_block)
                results.append(self._make_lore_entry('oracles.txt', block_start_line, text, "LORE_ORACLE", "oracles"))
        return results

    def extract_engrave(self) -> List[Dict[str, Any]]:
        return self._extract_simple_lines('engrave.txt', "LORE_ENGRAVING", "engrave")

    def extract_epitaph(self) -> List[Dict[str, Any]]:
        return self._extract_simple_lines('epitaph.txt', "LORE_EPITAPH", "tombstone")

    def extract_bogusmon(self) -> List[Dict[str, Any]]:
        path = os.path.join(self.dat_dir, 'bogusmon.txt')
        if not os.path.exists(path):
            return []
        results = []
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            for line_idx, line in enumerate(f, start=1):
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    continue
                clean_name = stripped.lstrip('-+|=_ ')
                results.append(self._make_lore_entry('bogusmon.txt', line_idx, clean_name, "LORE_BOGUSMON", "monster"))
        return results

    def extract_quest_lua(self) -> List[Dict[str, Any]]:
        path = os.path.join(self.dat_dir, 'quest.lua')
        if not os.path.exists(path):
            return []
        results = []
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        pattern = re.compile(r'(?:text|synopsis)\s*=\s*(?:\[\[(.*?)\]\]|"(.*?)"|\'(.*?)\')', re.DOTALL)
        for m in pattern.finditer(content):
            val = m.group(1) or m.group(2) or m.group(3)
            if not val:
                continue
            for line in val.split('\n'):
                s = line.strip()
                if s and len(s) >= 4 and re.search(r'[a-zA-Z]', s):
                    results.append({
                        "id": f"quest.lua:idx_{len(results)}",
                        "source_type": "dat_file",
                        "file": "quest.lua",
                        "line": 0,
                        "caller_func": None,
                        "callee_func": None,
                        "layer": 4,
                        "semantic_role": "LORE_QUEST",
                        "domain": "quest",
                        "literal_type": "literal",
                        "raw_format": s,
                        "placeholders": [],
                        "c_arguments": [],
                        "prompt_meta": None,
                        "lore_meta": {"type": "quest_dialog"}
                    })
        return results

    def extract_tribute(self) -> List[Dict[str, Any]]:
        path = os.path.join(self.dat_dir, 'tribute')
        if not os.path.exists(path):
            return []
        results = []
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            for line_idx, line in enumerate(f, start=1):
                stripped = line.strip()
                if not stripped or stripped.startswith('%') or stripped.startswith('#') or stripped.startswith('['):
                    continue
                results.append(self._make_lore_entry('tribute', line_idx, stripped, "LORE_TRIBUTE", "tribute"))
        return results

    def extract_help_files(self) -> List[Dict[str, Any]]:
        results = []
        help_files = ['help', 'hh', 'cmdhelp', 'keyhelp', 'wizhelp', 'usagehlp', 'opthelp', 'optmenu']
        for fname in help_files:
            path = os.path.join(self.dat_dir, fname)
            if not os.path.exists(path):
                continue
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_idx, line in enumerate(f, start=1):
                    stripped = line.strip()
                    if not stripped or stripped.startswith('#'):
                        continue
                    results.append(self._make_lore_entry(fname, line_idx, stripped, "DATA_HELP", "help"))
        return results

    def _extract_simple_lines(self, filename: str, semantic_role: str, domain: str) -> List[Dict[str, Any]]:
        path = os.path.join(self.dat_dir, filename)
        if not os.path.exists(path):
            return []
        results = []
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            for line_idx, line in enumerate(f, start=1):
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    continue
                results.append(self._make_lore_entry(filename, line_idx, stripped, semantic_role, domain))
        return results

    def _make_lore_entry(self, file: str, line: int, text: str, role: str, domain: str) -> Dict[str, Any]:
        return {
            "id": f"{file}:L{line}",
            "source_type": "dat_file",
            "file": file,
            "line": line,
            "caller_func": None,
            "callee_func": None,
            "layer": 4,
            "semantic_role": role,
            "domain": domain,
            "literal_type": "literal",
            "raw_format": text,
            "placeholders": [],
            "c_arguments": [],
            "prompt_meta": None,
            "lore_meta": None,
        }


# ----------------------------------------------------------------------
# 5. 全体パイプライン & マスタ・レポート出力
# ----------------------------------------------------------------------

def run_extraction(nethack_dir: str, output_dir: str):
    src_dir = os.path.join(nethack_dir, 'src')
    dat_dir = os.path.join(nethack_dir, 'dat')

    if not os.path.exists(src_dir):
        raise FileNotFoundError(f"Cソースディレクトリが見つかりません: {src_dir}")

    os.makedirs(output_dir, exist_ok=True)
    json_path = os.path.join(output_dir, 'source_messages.json')
    csv_path = os.path.join(output_dir, 'source_messages.csv')
    report_path = os.path.join(output_dir, 'extraction_report.txt')

    print(f"=== NetHack 5.0 メッセージ静的抽出開始 ===")
    print(f"NetHackパス: {nethack_dir}")
    print(f"出力先: {output_dir}")

    # 1. Cソース全域から抽出
    c_extractor = CSourceExtractor(src_dir)
    c_files = sorted([f for f in os.listdir(src_dir) if f.endswith('.c')])
    
    all_c_messages = []
    func_counts = {fn: 0 for fn in MESSAGE_FUNCTIONS}
    literal_counts = {"literal": 0, "variable": 0, "conditional": 0}

    print(f"\n[1/3] C ソースコード解析中 ({len(c_files)} files)...")
    for f in c_files:
        msgs = c_extractor.extract_from_file(f)
        for m in msgs:
            callee = m['callee_func']
            func_counts[callee] = func_counts.get(callee, 0) + 1
            ltype = m['literal_type']
            literal_counts[ltype] = literal_counts.get(ltype, 0) + 1
        all_c_messages.extend(msgs)

    # 2. dat ファイルから抽出
    print(f"\n[2/3] データファイル解析中 (dat/)...")
    dat_extractor = DatFileExtractor(dat_dir)
    dat_messages = dat_extractor.extract_all()

    all_messages = all_c_messages + dat_messages

    # 3. 統計レポートの作成
    total_c = len(all_c_messages)
    lit_pct = (literal_counts['literal'] / total_c * 100) if total_c else 0.0

    print(f"\n[3/3] マスタファイル出力中...")
    # JSON 出力
    master_data = {
        "version": "1.0.0",
        "description": "NetHack 5.0 Source Message Master (Vanilla SSOT)",
        "stats": {
            "total_all": len(all_messages),
            "c_messages_total": total_c,
            "c_literal_count": literal_counts['literal'],
            "c_variable_count": literal_counts['variable'],
            "c_conditional_count": literal_counts['conditional'],
            "c_literal_rate_percent": round(lit_pct, 2),
            "dat_messages_total": len(dat_messages),
            "callee_breakdown": func_counts
        },
        "messages": all_messages
    }

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(master_data, f, ensure_ascii=False, indent=2)
    print(f"  -> JSON: {json_path} ({len(all_messages)} 件)")

    # CSV 出力
    csv_fieldnames = [
        "id", "source_type", "file", "line", "caller_func", "callee_func",
        "layer", "semantic_role", "domain", "literal_type", "raw_format",
        "placeholders_count", "inferred_format"
    ]
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_fieldnames)
        writer.writeheader()
        for m in all_messages:
            row = {
                "id": m["id"],
                "source_type": m["source_type"],
                "file": m["file"],
                "line": m["line"],
                "caller_func": m["caller_func"],
                "callee_func": m["callee_func"],
                "layer": m["layer"],
                "semantic_role": m["semantic_role"],
                "domain": m["domain"],
                "literal_type": m["literal_type"],
                "raw_format": (m["raw_format"] or "").replace('\n', ' '),
                "placeholders_count": len(m.get("placeholders", [])),
                "inferred_format": (m.get("inferred_format") or "").replace('\n', ' ')
            }
            writer.writerow(row)
    print(f"  -> CSV:  {csv_path}")

    # レポート出力
    report_lines = [
        "============================================================",
        "  NetHack 5.0 Phase 1 静的抽出サマリレポート",
        "============================================================",
        f"総抽出件数: {len(all_messages):,} 件",
        f"  - Cソース抽出:  {total_c:,} 件",
        f"      ・静的リテラル (Literal):    {literal_counts['literal']:,} 件 ({lit_pct:.1f}%)",
        f"      ・三項条件分岐 (Conditional): {literal_counts['conditional']:,} 件",
        f"      ・動的・変数渡し (Variable):  {literal_counts['variable']:,} 件",
        f"  - datファイル抽出: {len(dat_messages):,} 件",
        "",
        "--- C関数別 呼び出し件数分布 ---",
    ]
    for fn, cnt in sorted(func_counts.items(), key=lambda x: -x[1]):
        report_lines.append(f"  {fn:<16}: {cnt:>5} 件")

    prompt_total = func_counts.get("yn_function", 0) + func_counts.get("getlin", 0) + func_counts.get("getdir", 0)
    report_lines.extend([
        "",
        f"★ 制御プロンプト (Layer 3) 合計: {prompt_total} 件",
        f"    - yn_function : {func_counts.get('yn_function', 0)} 件",
        f"    - getlin      : {func_counts.get('getlin', 0)} 件",
        f"    - getdir      : {func_counts.get('getdir', 0)} 件",
        "============================================================"
    ])
    report_text = "\n".join(report_lines)
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report_text)
    print(f"  -> Report: {report_path}")
    print("\n" + report_text)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract source messages from NetHack 5.0")
    parser.add_argument(
        "--nethack-dir",
        default=r"c:\Users\e3-sh\Desktop\works\NetHack-NetHack-5.0_org\NetHack-NetHack-5.0",
        help="NetHack 5.0 source root directory"
    )
    parser.add_argument(
        "--output-dir",
        default=os.path.join(os.path.dirname(__file__), "data"),
        help="Output directory for generated JSON/CSV"
    )
    args = parser.parse_args()
    run_extraction(args.nethack_dir, args.output_dir)

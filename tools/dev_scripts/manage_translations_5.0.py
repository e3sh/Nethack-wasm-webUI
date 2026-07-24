import csv
import os
import re
import sys
import argparse

# Windowsコンソールでの文字化け対策とラインバッファリング設定
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
else:
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except AttributeError:
        pass

# デフォルトパス設定
DEFAULT_DICT_PATH = r"c:\Users\e3-sh\Documents\GitHub\Nethack-wasm-webUI\dictionary.csv"
DEFAULT_NETHACK_PATH = r"c:\Users\e3-sh\Desktop\works\NetHack-NetHack-5.0_org\NetHack-NetHack-5.0"

class TranslationManager:
    def __init__(self, dict_path, nethack_path, engine='google', model='gemma2', api_url='http://localhost:11434/api/chat'):
        self.dict_path = dict_path
        self.nethack_path = nethack_path
        self.dat_path = os.path.join(nethack_path, 'dat')
        self.engine = engine
        self.model = model
        self.api_url = api_url
        
        # 既存辞書の読み込み用キャッシュ
        self.existing_translations = {}  # normalized_src -> {translation, group, row_idx}
        self.csv_fieldnames = ['Group', 'Source', 'Translation', 'Adj', 'Verb']
        self.csv_rows = []
        
        self.load_dictionary()

    def normalize_text(self, text):
        if not text:
            return ""
        return " ".join(text.strip().split())

    def should_translate(self, text):
        if not text:
            return False
        t = text.strip()
        if not t:
            return False
        # 最低でも1文字以上の英文字 (a-zA-Z) を含んでいるか
        if not re.search(r'[a-zA-Z]', t):
            return False
        # 記号だけの行、あるいはカンマやカッコだけの行、Luaコードの末尾記号などを除外
        if t in [',', '}', '{', '[', ']', '[[', ']]', '},', '],', '[[{', '}]]', ']],', '}, {']:
            return False
        return True

    def load_dictionary(self):
        if not os.path.exists(self.dict_path):
            print(f"Warning: {self.dict_path} が存在しません。新規作成します。")
            return

        with open(self.dict_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            self.csv_fieldnames = reader.fieldnames or self.csv_fieldnames
            for idx, row in enumerate(reader):
                self.csv_rows.append(row)
                src = row['Source']
                norm_src = self.normalize_text(src)
                if norm_src:
                    self.existing_translations[norm_src] = {
                        'translation': row['Translation'],
                        'group': row['Group'],
                        'row_idx': idx
                    }

    def is_translated(self, norm_src):
        if norm_src not in self.existing_translations:
            return False
        trans = self.existing_translations[norm_src]['translation']
        if not trans or trans.strip() == "":
            return False
        if "=== TODO ===" in trans or "[TODO]" in trans:
            return False
        return True

    # --- 各ファイルのパーサ群 ---

    def parse_data_base(self):
        filepath = os.path.join(self.dat_path, 'data.base')
        if not os.path.exists(filepath):
            return []

        sources = []
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                stripped = line.strip()
                if not stripped or line.startswith('#'):
                    continue
                is_desc = line.startswith('\t') or line.startswith(' ')
                if is_desc:
                    if stripped.startswith('[') and stripped.endswith(']'):
                        continue
                    if stripped.startswith('#'):
                        continue
                    val = line.replace('\n', '').replace('\r', '')
                    if self.should_translate(val):
                        sources.append(val)
        return sources

    def parse_oracles(self):
        filepath = os.path.join(self.dat_path, 'oracles.txt')
        if not os.path.exists(filepath):
            return []

        sources = []
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith('#') or stripped == '-----':
                    continue
                val = line.replace('\n', '').replace('\r', '')
                if self.should_translate(val):
                    sources.append(val)
        return sources

    def parse_rumors(self):
        sources = []
        for filename in ['rumors.tru', 'rumors.fal']:
            filepath = os.path.join(self.dat_path, filename)
            if not os.path.exists(filepath):
                continue
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    stripped = line.strip()
                    if not stripped or stripped.startswith('#'):
                        continue
                    val = line.replace('\n', '').replace('\r', '')
                    if self.should_translate(val):
                        sources.append(val)
        return sources

    def parse_engrave(self):
        filepath = os.path.join(self.dat_path, 'engrave.txt')
        if not os.path.exists(filepath):
            return []

        sources = []
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    continue
                val = line.replace('\n', '').replace('\r', '')
                if self.should_translate(val):
                    sources.append(val)
        return sources

    def parse_epitaph(self):
        filepath = os.path.join(self.dat_path, 'epitaph.txt')
        if not os.path.exists(filepath):
            return []

        sources = []
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    continue
                val = line.replace('\n', '').replace('\r', '')
                if self.should_translate(val):
                    sources.append(val)
        return sources

    def parse_bogusmon(self):
        filepath = os.path.join(self.dat_path, 'bogusmon.txt')
        if not os.path.exists(filepath):
            return []

        sources = []
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    continue
                clean_name = stripped
                if clean_name[0] in ['-', '_', '+', '|', '=']:
                    clean_name = clean_name[1:]
                if self.should_translate(clean_name):
                    sources.append(clean_name)
        return sources

    def parse_quest(self):
        filepath = os.path.join(self.dat_path, 'quest.lua')
        if not os.path.exists(filepath):
            return []

        sources = []
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        # TEST_PATTERN = { ... } のテストコード部分を除去
        content = re.sub(r'TEST_PATTERN\s*=\s*\{.*?\}\s*,', '', content, flags=re.DOTALL)

        # Luaの text = [[ ... ]] や synopsis = "..." 等を抽出
        pattern = r'(?:text|synopsis)\s*=\s*(?:\[\[(.*?)\]\]|"(.*?)"|\'(.*?)\')'
        matches = re.findall(pattern, content, re.DOTALL)
        for m in matches:
            val = m[0] or m[1] or m[2]
            if val:
                # 実行時には1行ずつ表示処理に流れてくるため、改行(\n)でスプリットして行単位で登録する
                lines = [l.strip() for l in val.split('\n') if l.strip()]
                for l in lines:
                    if self.should_translate(l):
                        sources.append(l)

        # 5文字以上の改行を含まないダブルクォーテーション文字列を抽出（\nを除外）
        strings_pattern = r'"((?:[^"\n\\]|\\.){5,})"'
        all_strs = re.findall(strings_pattern, content)
        for s in all_strs:
            s_unescaped = s.replace('\\"', '"').replace('\\\\', '\\')
            s_stripped = s_unescaped.strip()
            if s_stripped not in ['assignquest', 'badalign', 'badlevel', 'discourage', 'encourage', 
                                  'firsttime', 'goal_first', 'goal_next', 'gotit', 'guardtalk_after', 
                                  'guardtalk_before', 'hasamulet', 'killed_nemesis', 'leader_first', 
                                  'leader_last', 'leader_next', 'leader_other', 'locate_first', 
                                  'locate_next', 'nemesis_first', 'nemesis_next', 'nemesis_other', 
                                  'nemesis_wantsit', 'nexttime', 'offeredit', 'offeredit2', 'othertime', 
                                  'posthanks', 'common', 'output', 'synopsis', 'text', 'pline', 'menu']:
                if self.should_translate(s_stripped):
                    sources.append(s_stripped)

        return sources

    def parse_tribute(self):
        filepath = os.path.join(self.dat_path, 'tribute')
        if not os.path.exists(filepath):
            return []

        sources = []
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            in_passage = False
            current_passage = []
            for line in f:
                stripped = line.strip()
                if stripped.startswith('%title'):
                    val = stripped.replace('%title', '').strip()
                    if self.should_translate(val):
                        sources.append(val)
                elif stripped.startswith('%passage'):
                    in_passage = True
                    current_passage = []
                elif stripped.startswith('%e passage'):
                    in_passage = False
                    passage_text = "\n".join(current_passage).strip()
                    if passage_text:
                        for l in passage_text.split('\n'):
                            if l.strip() and not l.strip().startswith('['):
                                val = l.strip()
                                if self.should_translate(val):
                                    sources.append(val)
                elif in_passage:
                    if not stripped.startswith('[') and not stripped.endswith(']'):
                        current_passage.append(line.replace('\n', '').replace('\r', ''))
        return sources

    def parse_help_files(self):
        sources = []
        help_files = ['help', 'hh', 'cmdhelp', 'keyhelp', 'wizhelp', 'usagehlp', 'opthelp', 'optmenu']
        for filename in help_files:
            filepath = os.path.join(self.dat_path, filename)
            if not os.path.exists(filepath):
                continue
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    stripped = line.strip()
                    if not stripped or stripped.startswith('#'):
                        continue
                    val = line.replace('\n', '').replace('\r', '')
                    if self.should_translate(val):
                        sources.append(val)
        return sources

    # --- 新規追加: Cソースコードおよび追加Luaレベルファイルからのメッセージ抽出パーサ群 ---

    def extract_c_strings(self, filenames):
        sources = []
        src_dir = os.path.join(self.nethack_path, 'src')
        
        # pline, You, Your, You_hear, You_feel, verbalize などの関数呼び出しパターン
        func_pattern = re.compile(
            r'\b(?:pline|You|Your|You_hear|You_hear1|You_feel|You_cant|You_see|You_ask|You_tell|verbalize|headline|impossible|Norep_pline|pline_The)\s*\(\s*"((?:[^"\\]|\\.)+)"',
            re.DOTALL
        )
        # ダブルクォーテーション内の5文字以上の英語テキスト（プログラムIDやフォーマット指定子のみのものを除く）
        str_pattern = re.compile(r'"((?:[^"\n\\]|\\.){5,})"')

        for filename in filenames:
            filepath = os.path.join(src_dir, filename)
            if not os.path.exists(filepath):
                continue
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # コメントアウト部分の削除 (/* ... */ および // ...)
            clean_content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
            clean_content = re.sub(r'//.*?\n', '\n', clean_content)

            # 1. メッセージ関数からの直接抽出
            matches = func_pattern.findall(clean_content)
            for m in matches:
                # 改行除去、エスケープ解除
                s = m.replace('\\\n', '').replace('\\"', '"').replace('\\n', ' ').strip()
                if self.should_translate(s):
                    sources.append(s)

            # 2. 文字列配列宣言やその他のメッセージ文字列抽出
            all_strs = str_pattern.findall(clean_content)
            for s in all_strs:
                s_clean = s.replace('\\"', '"').replace('\\n', ' ').strip()
                # 関数のマッチで拾えていない説明文・メッセージ候補（英字を含み、プログラムキーワードでないもの）
                if (s_clean.startswith('%') or ' ' in s_clean or len(s_clean) >= 10) and self.should_translate(s_clean):
                    # コードキーワードの除外フィルター
                    if not re.match(r'^(?:[a-zA-Z0-9_]+/[a-zA-Z0-9_.]+|[A-Z0-9_]{5,}|http.*)$', s_clean):
                        sources.append(s_clean)

        return sources

    def parse_sokoban_and_levels(self):
        sources = []
        if not os.path.exists(self.dat_path):
            return []

        lua_pattern = r'(?:text|synopsis|display|message|pline)\s*=\s*(?:\[\[(.*?)\]\]|"(.*?)"|\'(.*?)\')'
        str_pattern = r'"((?:[^"\n\\]|\\.){5,})"'

        for fname in os.listdir(self.dat_path):
            if fname.startswith('soko') or fname.startswith('tut-') or fname in ['castle.lua', 'knox.lua', 'astral.lua', 'themerms.lua', 'sanctum.lua', 'valley.lua']:
                filepath = os.path.join(self.dat_path, fname)
                if not os.path.isfile(filepath):
                    continue
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                matches = re.findall(lua_pattern, content, re.DOTALL)
                for m in matches:
                    val = m[0] or m[1] or m[2]
                    if val:
                        lines = [l.strip() for l in val.split('\n') if l.strip()]
                        for l in lines:
                            if self.should_translate(l):
                                sources.append(l)

                all_strs = re.findall(str_pattern, content)
                for s in all_strs:
                    s_clean = s.replace('\\"', '"').strip()
                    if (' ' in s_clean or len(s_clean) >= 8) and self.should_translate(s_clean):
                        sources.append(s_clean)

        return sources

    def parse_c_sounds(self):
        return self.extract_c_strings(['sounds.c'])

    def parse_c_status(self):
        return self.extract_c_strings(['attrib.c', 'botl.c', 'sick.c', 'timeout.c', 'polyself.c'])

    def parse_c_traps(self):
        return self.extract_c_strings(['trap.c'])

    def parse_c_item_effects(self):
        return self.extract_c_strings(['apply.c', 'eat.c', 'potion.c', 'read.c', 'spell.c', 'wand.c', 'zap.c', 'wield.c', 'do_wear.c'])

    def parse_c_prayer(self):
        return self.extract_c_strings(['pray.c'])

    def parse_c_achievements(self):
        return self.extract_c_strings(['achieve.c', 'end.c', 'topten.c', 'insight.c'])

    # --- 診断と追加のアクション ---

    def analyze_status(self):
        # (グループ名, 解析関数, 翻訳タイプ)
        targets = [
            ('Data.base', self.parse_data_base, 'ファイル翻訳 (data_jp.base)'),
            ('Oracles', self.parse_oracles, 'ファイル翻訳 (oracles_jp.txt)'),
            ('Rumors', self.parse_rumors, '辞書翻訳 (dictionary.csv)'),
            ('Engrave', self.parse_engrave, '辞書翻訳 (dictionary.csv)'),
            ('Epitaph', self.parse_epitaph, '辞書翻訳 (dictionary.csv)'),
            ('Bogusmon', self.parse_bogusmon, '辞書翻訳 (dictionary.csv)'),
            ('Quest', self.parse_quest, '辞書/メニュー翻訳 (dictionary.csv)'),
            ('Tribute', self.parse_tribute, 'ファイル翻訳 (VFS上置換)'),
            ('Help', self.parse_help_files, 'ファイル翻訳 (help_jp等)'),
            ('Sokoban/Levels', self.parse_sokoban_and_levels, '辞書/レベル (soko*.lua等)'),
            ('Sounds(聞こえる)', self.parse_c_sounds, '辞書/Cコード (sounds.c)'),
            ('Status(状態異常)', self.parse_c_status, '辞書/Cコード (attrib/botl等)'),
            ('Traps(罠関連)', self.parse_c_traps, '辞書/Cコード (trap.c)'),
            ('ItemEffects(効果)', self.parse_c_item_effects, '辞書/Cコード (apply/eat/zap等)'),
            ('Prayer(いのり)', self.parse_c_prayer, '辞書/Cコード (pray.c)'),
            ('Achievements', self.parse_c_achievements, '辞書/Cコード (achieve/end等)')
        ]

        print(f"{'Group (出典元)':<15} | {'翻訳方式':<24} | {'総原文数':<8} | {'翻訳済':<6} | {'未翻訳(TODO)':<12} | {'未登録':<6} | {'網羅率':<6}")
        print("-" * 92)

        total_all, translated_all, todo_all, missing_all = 0, 0, 0, 0

        for group_name, parse_func, tr_type in targets:
            raw_sources = parse_func()
            
            # 重複の排除（規格化された文字列ベース）
            unique_sources = {}
            for src in raw_sources:
                norm = self.normalize_text(src)
                if norm and norm not in unique_sources:
                    unique_sources[norm] = src

            total = len(unique_sources)
            translated = 0
            todo = 0
            missing = 0

            for norm_src in unique_sources.keys():
                if norm_src in self.existing_translations:
                    if self.is_translated(norm_src):
                        translated += 1
                    else:
                        todo += 1
                else:
                    missing += 1

            coverage = (translated / total * 100) if total > 0 else 100.0
            print(f"{group_name:<15} | {tr_type:<24} | {total:<8} | {translated:<6} | {todo:<12} | {missing:<6} | {coverage:.1f}%")

            total_all += total
            translated_all += translated
            todo_all += todo
            missing_all += missing

        overall_coverage = (translated_all / total_all * 100) if total_all > 0 else 100.0
        print("-" * 92)
        print(f"{'OVERALL TOTAL':<15} | {'-':<24} | {total_all:<8} | {translated_all:<6} | {todo_all:<12} | {missing_all:<6} | {overall_coverage:.1f}%")

    def add_missing_translations(self, add_all=False):
        # 辞書（dictionary.csv）に直接追加すべきグループに限定する
        # ファイル翻訳（data.baseやoracles, help等）はCSVを肥大化させるため、add_all=True でない限り追加しない
        targets = [
            ('Rumors', self.parse_rumors),
            ('Engrave', self.parse_engrave),
            ('Epitaph', self.parse_epitaph),
            ('Bogusmon', self.parse_bogusmon),
            ('Quest', self.parse_quest),
            ('Sokoban/Levels', self.parse_sokoban_and_levels),
            ('Sounds(聞こえる)', self.parse_c_sounds),
            ('Status(状態異常)', self.parse_c_status),
            ('Traps(罠関連)', self.parse_c_traps),
            ('ItemEffects(効果)', self.parse_c_item_effects),
            ('Prayer(いのり)', self.parse_c_prayer),
            ('Achievements', self.parse_c_achievements),
        ]

        if add_all:
            # デバッグ用、または必要に応じてファイル翻訳系も強制追加する場合
            targets.extend([
                ('Data.base', self.parse_data_base),
                ('Oracles', self.parse_oracles),
                ('Tribute', self.parse_tribute),
                ('Help', self.parse_help_files)
            ])

        added_count = 0
        new_rows = []
        added_normalized = set()

        for group_name, parse_func in targets:
            raw_sources = parse_func()
            for src in raw_sources:
                norm = self.normalize_text(src)
                if not norm:
                    continue
                
                # すでに辞書にあるか、今回のループで追加予定ならスキップ
                if norm in self.existing_translations or norm in added_normalized:
                    continue

                new_rows.append({
                    'Group': group_name,
                    'Source': src,
                    'Translation': f"=== TODO === {src}",
                    'Adj': '',
                    'Verb': ''
                })
                added_normalized.add(norm)
                added_count += 1

        if added_count == 0:
            print("辞書管理対象の未登録英文は見つかりませんでした。")
            return

        # dictionary.csv に追記
        with open(self.dict_path, 'a', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=self.csv_fieldnames)
            writer.writerows(new_rows)

        print(f"成功: {added_count} 件の未登録英文を 辞書管理対象グループ（Rumors, Quest等）として {self.dict_path} の末尾に追加しました。")

    def translate_text(self, text, source_lang='en', target_lang='ja'):
        import urllib.request
        import urllib.parse
        import json
        import ssl

        url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + source_lang + "&tl=" + target_lang + "&dt=t&q=" + urllib.parse.quote(text)
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        # 1. プロキシなし & SSL検証スキップで試行
        try:
            context = ssl._create_unverified_context()
            proxy_handler = urllib.request.ProxyHandler({})
            opener = urllib.request.build_opener(proxy_handler)
            req = urllib.request.Request(url, headers=headers)
            with opener.open(req, timeout=3) as response:
                data = json.loads(response.read().decode('utf-8'))
                return "".join([part[0] for part in data[0] if part[0]])
        except Exception:
            pass

        # 2. 通常のプロキシ設定 & SSL検証スキップで再試行
        try:
            context = ssl._create_unverified_context()
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=3, context=context) as response:
                data = json.loads(response.read().decode('utf-8'))
                return "".join([part[0] for part in data[0] if part[0]])
        except Exception:
            return None

    def translate_text_local(self, text, model="gemma2", api_url="http://localhost:11434/api/chat"):
        import urllib.request
        import json

        system_instruction = (
            "You are a professional translator for the roguelike game NetHack.\n"
            "Translate the given English text to Japanese.\n"
            "Strict Rules:\n"
            "1. Output ONLY the Japanese translation. Never write introduction, explanation, notes, or quotes.\n"
            "2. Keep placeholder variables (e.g. __1__, __2__, $1, $2) exactly as they are. Do not translate or change them.\n"
            "3. Keep the original formatting and punctuation as much as possible."
        )

        data = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": f"Text to translate:\n{text}"}
            ],
            "stream": False,
            "options": {
                "temperature": 0.3
            }
        }

        try:
            req = urllib.request.Request(
                api_url,
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                # OllamaのAPI応答は ['message']['content']。
                # 万が一OpenAI互換APIのエンドポイントだった場合のフォールバックも考慮する
                if 'message' in res_data and 'content' in res_data['message']:
                    return res_data['message']['content'].strip()
                elif 'choices' in res_data and len(res_data['choices']) > 0:
                    return res_data['choices'][0]['message']['content'].strip()
                return None
        except Exception as e:
            # 連続エラー検出のためにエラーメッセージをログに出し、Noneを返す
            print(f"\n[LLM Error] {e}")
            return None

    def save_csv(self):
        with open(self.dict_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=self.csv_fieldnames)
            writer.writeheader()
            writer.writerows(self.csv_rows)

    def translate_missing_items(self, start=1, limit=None):
        import re
        to_translate = []
        for idx, row in enumerate(self.csv_rows):
            g = row['Group']
            if g == 'Message':
                continue
            src = row['Source']
            trans = row['Translation']
            
            clean_trans = trans.replace('=== TODO ===', '').strip() if trans else ""
            
            # 日本語文字（ひらがな・カタカナ・漢字）が含まれているか判定
            has_ja = bool(re.search(r'[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]', clean_trans))
            # 手動Pattern（$1等の置換変数を含むルール）の判定
            has_var_rep = g == 'Pattern' and bool(re.search(r'\$[0-9]+', clean_trans))
            
            is_todo = False
            if not trans or trans.strip() == "":
                is_todo = True
            elif trans.strip().startswith('=== TODO ==='):
                # === TODO === 付の行で、clean_trans に日本語がまだ含まれていない場合は未翻訳対象！
                has_ja = bool(re.search(r'[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]', clean_trans))
                if not has_ja:
                    is_todo = True
                else:
                    is_todo = False
            else:
                clean_trans = trans.strip()
                has_ja = bool(re.search(r'[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]', clean_trans))
                has_var_rep = g == 'Pattern' and bool(re.search(r'\$[0-9]+', clean_trans))
                if not has_ja and not has_var_rep:
                    is_todo = True
                elif clean_trans == src.strip() or clean_trans == "":
                    is_todo = True
            
            if is_todo:
                # 翻訳用の入力テキストを決定する
                input_text = src
                if g == 'Pattern':
                    input_text = trans.replace('=== TODO ===', '').strip()
                    if not input_text or input_text == src:
                        # フォールバック: Sourceからメタ文字やアンカーを除去
                        input_text = re.sub(r'^\^|\$$', '', src)
                        input_text = input_text.replace(r'\s+', ' ')
                        input_text = input_text.replace(r'\.', '.')
                        occurred = 0
                        def repl_dot_star(m):
                            nonlocal occurred
                            occurred += 1
                            return f"${occurred}"
                        input_text = re.sub(r'\(\.\*\)', repl_dot_star, input_text)
                
                if input_text.strip():
                    to_translate.append((idx, g, input_text))
                
        total_all_todo = len(to_translate)
        if total_all_todo == 0:
            print("翻訳が必要な未翻訳(TODO)項目はありませんでした。（※既翻訳行への無駄なAPI呼び出しは発生しません）")
            return
        
        # 開始位置 (1-based index) の切り出し
        start_idx = max(0, start - 1)
        if start_idx >= total_all_todo:
            print(f"指定された開始位置 (--start {start}) は未翻訳総件数 ({total_all_todo}件) を超えています。")
            return

        to_translate = to_translate[start_idx:]
        if limit:
            to_translate = to_translate[:limit]
            
        total_items = len(to_translate)
        end_num = start_idx + total_items
            
        print(f"未翻訳総数 {total_all_todo} 件中、[{start_idx + 1} 〜 {end_num} 件目] ({total_items} 件) の API 自動翻訳を開始します...")
        print("※翻訳済み行への無駄な API 通信は一切発生しません。ディレイを挟みつつ安全に処理します。Ctrl+Cで安全終了可能。")
        
        success_count = 0
        consecutive_errors = 0
        
        try:
            for count, (idx, g, input_text) in enumerate(to_translate, 1):
                curr_item_num = start_idx + count
                if consecutive_errors >= 5:
                    print("\n[エラー] 翻訳APIでエラーが連続して発生したため、安全のために処理を中断します。")
                    break
                    
                # Patternグループの場合は $1, $2 などのトークンを一時プレースホルダーに保護する
                actual_input = input_text
                placeholders = []
                if g == 'Pattern':
                    def protect_tokens(match):
                        tok = match.group(0)
                        num = tok[1:]
                        placeholders.append(tok)
                        return f" __{num}__ "
                    actual_input = re.sub(r'\$[0-9]+', protect_tokens, actual_input)
                
                if self.engine == 'local':
                    result = self.translate_text_local(actual_input, model=self.model, api_url=self.api_url)
                else:
                    result = self.translate_text(actual_input)

                if result:
                    # 翻訳結果から一時プレースホルダーを $1, $2 に復元
                    if g == 'Pattern':
                        for p in re.findall(r'__[0-9]+__', result):
                            num = p.replace('__', '')
                            result = result.replace(p, f"${num}")
                        # 余分なスペース調整とダブルクォートのクレンジング
                        result = re.sub(r'\s*\$([0-9]+)\s*', r' $\1 ', result).strip()
                        result = result.replace('""', '"')
                        
                    # 手動推敲を容易にするため、末尾に元の英文(EN: ...)を自動併記
                    self.csv_rows[idx]['Translation'] = f"=== TODO === {result} (EN: {input_text})"
                    success_count += 1
                    consecutive_errors = 0
                    print(f"[API通信 {count}/{total_items}] (全TODO中 {curr_item_num}件目) 成功 ({g}): '{input_text[:25]}' -> '{result[:25]}'")
                else:
                    consecutive_errors += 1
                    print(f"[API通信 {count}/{total_items}] (全TODO中 {curr_item_num}件目) 失敗 ({g}): '{input_text[:25]}'")
                    
                import time
                if self.engine == 'google':
                    time.sleep(0.4)
                else:
                    time.sleep(0.05)
                
                # 10件ごとに中間セーブ
                if count % 10 == 0:
                    self.save_csv()
                    print(f"--> 中間バックアップ保存完了 ({curr_item_num}件目)")
                    
        except KeyboardInterrupt:
            print("\nユーザーによって処理が中断されました。そこまでの翻訳結果を保存します。")
            
        self.save_csv()
        print(f"\n翻訳完了: {success_count} / {total_items} 件の翻訳結果を {self.dict_path} に保存しました。")
    def convert_tokens_to_patterns(self):
        # %[a-zA-Z]+ にマッチするトークンを抽出する
        token_regex = r'%[-+0-9*.]*[a-zA-Z]+'
        
        # 正規表現パターンを正規化（カッコ内の定義を (.*) に統一）するヘルパー関数
        def normalize_pat(p_str):
            # カッコで囲まれたキャプチャグループを (.*) に置換
            # エスケープされていないカッコを対象とする
            res = re.sub(r'(?<!\\)\([^)]+\)', '(.*)', p_str)
            # スペースの揺らぎを統一 (複数スペースや \s+ を半角スペース1つにする)
            res = re.sub(r'\\s\+', ' ', res)
            res = re.sub(r'\s+', ' ', res)
            return res.strip()
            
        # 既存の手動翻訳済み Pattern の正規化パターンリストを事前ビルド
        manual_normalized_patterns = set()
        for row in self.csv_rows:
            if row['Group'] == 'Pattern':
                trans = row['Translation']
                # === TODO === で始まらない（手動で日本語訳された）Patternを抽出
                if trans and not trans.strip().startswith('=== TODO ==='):
                    norm = normalize_pat(row['Source'])
                    manual_normalized_patterns.add(norm)
        
        converted_count = 0
        rows_to_remove = [] # 既存の手動 Pattern でカバーされているため削除する行のインデックス
        
        for idx, row in enumerate(self.csv_rows):
            g = row['Group']
            src = row['Source']
            trans = row['Translation']
            
            # すでに Pattern になっているものはスキップ
            if g == 'Pattern':
                continue
                
            # トークンが含まれているメッセージのみ Pattern に移行する
            tokens_in_src = re.findall(token_regex, src)
            if not tokens_in_src:
                continue
                
            # 安全ガード:
            # トークンを除外した後のテキストが極端に短い、または英文字を含まない場合はスキップ
            clean_src = re.sub(token_regex, '', src).strip()
            if len(clean_src) <= 4 or not re.search(r'[a-zA-Z]', clean_src):
                continue
                
            # トークンをキャプチャグループ (.*) に置き換える
            temp_src = src
            temp_trans = trans
            occurred_tokens = []
            
            if tokens_in_src:
                # 部分一致による誤置換を防ぐため、検出されたトークンを長さの長い順にソートする
                unique_tokens = sorted(list(set(tokens_in_src)), key=len, reverse=True)
                token_pattern = '|'.join([re.escape(t) for t in unique_tokens])
                
                def src_repl(match):
                    tok = match.group(0)
                    idx = len(occurred_tokens)
                    occurred_tokens.append(tok)
                    return f"__TOKEN_{idx}__"
                    
                temp_src = re.sub(token_pattern, src_repl, temp_src)
                
                # Translation内のトークンも、出現順に応じて $1, $2... に置換する
                for tok_idx, tok in enumerate(occurred_tokens):
                    temp_trans = temp_trans.replace(tok, f"${tok_idx + 1}")
                
            # 正規表現パターンの組み立て
            escaped_src = re.escape(temp_src)
            
            pattern_src = escaped_src
            if occurred_tokens:
                for tok_idx in range(len(occurred_tokens)):
                    pattern_src = pattern_src.replace(f"__TOKEN_{tok_idx}__", "(.*)")
                    
            # エスケープされたスペース '\ ' を単なる半角スペース ' ' に戻す（CSV上の視認性向上のため）
            pattern_src = pattern_src.replace(r'\ ', ' ')
            
            # 完全一致アンカーを追加
            pattern_src = f"^{pattern_src}$"
            
            # 新規生成するパターンの正規化文字列を作成して重複テスト
            new_pat_norm = normalize_pat(pattern_src)
            if new_pat_norm in manual_normalized_patterns:
                # 既に既存の綺麗な手動 Pattern がこのメッセージをカバーしているため、
                # 新しい自動 Pattern の重複作成は行わず、スキャンされた英文を CSV から削除
                # （ただし、削除していいのは === TODO === 付き、または空の未完成行のみ）
                if not trans or trans.strip().startswith('=== TODO ==='):
                    rows_to_remove.append(idx)
                continue
            
            # 行の更新
            self.csv_rows[idx]['Group'] = 'Pattern'
            self.csv_rows[idx]['Source'] = pattern_src
            self.csv_rows[idx]['Translation'] = temp_trans
            converted_count += 1
            
        # 重複行を逆順に削除
        if rows_to_remove:
            for r_idx in sorted(rows_to_remove, reverse=True):
                self.csv_rows.pop(r_idx)
            self.save_csv()
            print(f"情報: すでに既存の手動 Pattern でカバーされているスキャン重複項目 {len(rows_to_remove)} 件を CSV から削除しました。")
            
        if converted_count > 0:
            self.save_csv()
            print(f"成功: {converted_count} 件のトークン付きメッセージを Pattern グループ（正規表現パターン）に自動変換しました。")
        else:
            print("変換対象のトークン付きメッセージはありませんでした。")

    def clean_orphans(self):
        # 現在のソースコードから有効なすべての原文ソースをスキャン
        valid_sources = set()
        valid_sources.update(self.parse_rumors())
        valid_sources.update(self.parse_oracles())
        valid_sources.update(self.parse_epitaph())
        valid_sources.update(self.parse_bogusmon())
        valid_sources.update(self.parse_quest())
        valid_sources.update(self.parse_sokoban_and_levels())
        valid_sources.update(self.parse_c_sounds())
        valid_sources.update(self.parse_c_status())
        valid_sources.update(self.parse_c_traps())
        valid_sources.update(self.parse_c_item_effects())
        valid_sources.update(self.parse_c_prayer())
        valid_sources.update(self.parse_c_achievements())
        
        # valid_sources からトークン付きメッセージを抽出して有効な Pattern の元とする
        token_regex = r'%[-+0-9*.]*[a-zA-Z]+'
        valid_patterns = set()
        for src in valid_sources:
            if re.search(token_regex, src):
                occurred_tokens = []
                def src_repl(match):
                    tok = match.group(0)
                    idx = len(occurred_tokens)
                    occurred_tokens.append(tok)
                    return f"__TOKEN_{idx}__"
                temp = re.sub(token_regex, src_repl, src)
                escaped = re.escape(temp)
                pattern_src = escaped
                for tok_idx in range(len(occurred_tokens)):
                    pattern_src = pattern_src.replace(f"__TOKEN_{tok_idx}__", "(.*)")
                pattern_src = pattern_src.replace(r'\ ', ' ')
                valid_patterns.add(f"^{pattern_src}$")

        new_rows = []
        removed_count = 0
        for row in self.csv_rows:
            g = row['Group']
            src = row['Source']
            trans = row['Translation']
            
            # 手動で翻訳済みの行（=== TODO === で始まらないもの）はグループに関わらず100%不可侵保護
            is_manual_translation = trans and not trans.strip().startswith('=== TODO ===')
            
            # 手動・固定アセットグループ
            preserved_groups = {'Message', 'Item', 'Entity', 'Noun', 'Verb', 'Adj', 'Monster', 'Object'}
            
            if g in preserved_groups or is_manual_translation:
                new_rows.append(row)
            elif g == 'Pattern':
                # Patternグループの場合:
                # 1. 手動の定義（=== TODO === 以外）なら絶対に保護
                # 2. TODO付きの場合は、現在のソースコードの有効パターン (valid_patterns/valid_sources) に存在すれば保持、なければClean
                if is_manual_translation or src in valid_patterns or src in valid_sources:
                    new_rows.append(row)
                else:
                    removed_count += 1
            elif src in valid_sources:
                new_rows.append(row)
            else:
                removed_count += 1
                
        if removed_count > 0:
            self.csv_rows = new_rows
            self.save_csv()
            print(f"成功: ソースコードに存在しない古い孤立データ（過去のTODO付きパターン等） {removed_count} 件を CSV からクリーンアップしました。")
        else:
            print("クリーンアップの必要はありませんでした。")

def main():
    parser = argparse.ArgumentParser(description='NetHack 5.0 翻訳網羅診断・管理システム')
    parser.add_argument('command', choices=['status', 'add', 'translate', 'convert_patterns', 'clean'], help='実行するコマンド: status (網羅率の診断), add (未登録文の追加), translate (未翻訳の自動直訳), convert_patterns (トークン付き行のPattern化), clean (古い孤立データの削除)')
    parser.add_argument('--dict-path', default=DEFAULT_DICT_PATH, help='dictionary.csv のパス')
    parser.add_argument('--nethack-path', default=DEFAULT_NETHACK_PATH, help='NetHack 5.0 本家リポジトリのルートパス')
    parser.add_argument('--add-all', action='store_true', help='ファイル翻訳対象（Help等）も含めてすべての未登録文を強制的にCSVへ追加する')
    parser.add_argument('--limit', type=int, default=None, help='translate コマンド実行時の最大翻訳処理件数')
    parser.add_argument('--start', type=int, default=1, help='translate コマンド実行時の開始件数位置 (1-based)')
    parser.add_argument('--engine', choices=['google', 'local'], default='google', help='翻訳エンジン: google (Google Web), local (ローカルLLM)')
    parser.add_argument('--model', default='gemma2', help='ローカルLLMモデル名 (Ollamaのモデル名等)')
    parser.add_argument('--api-url', default='http://localhost:11434/api/chat', help='ローカルLLM APIのエンドポイントURL')
    
    args = parser.parse_args()

    if not os.path.exists(args.dict_path):
        print(f"Error: 辞書ファイル {args.dict_path} が見つかりません。")
        sys.exit(1)
    if not os.path.exists(args.nethack_path):
        print(f"Error: NetHackリポジトリ {args.nethack_path} が見つかりません。")
        sys.exit(1)

    manager = TranslationManager(
        args.dict_path,
        args.nethack_path,
        engine=args.engine,
        model=args.model,
        api_url=args.api_url
    )

    if args.command == 'status':
        manager.analyze_status()
    elif args.command == 'add':
        manager.add_missing_translations(add_all=args.add_all)
    elif args.command == 'translate':
        manager.translate_missing_items(start=args.start, limit=args.limit)
    elif args.command == 'convert_patterns':
        manager.convert_tokens_to_patterns()
    elif args.command == 'clean':
        manager.clean_orphans()

if __name__ == '__main__':
    main()

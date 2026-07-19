import csv
import os
import sys

# Windowsコンソールでの文字化け対策
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

dict_path = r"c:\Users\e3-sh\Documents\GitHub\Nethack-wasm-webUI\dictionary.csv"
database_path = r"c:\Users\e3-sh\Desktop\works\NetHack-NetHack-5.0_org\NetHack-NetHack-5.0\dat\data.base"

def check_translations():
    if not os.path.exists(dict_path):
        print(f"Error: {dict_path} が見つかりません。")
        return
    if not os.path.exists(database_path):
        print(f"Error: {database_path} が見つかりません。")
        return

    # 1. 翻訳済み辞書の読み込み
    translation_map = {}
    with open(dict_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            src = " ".join(row['Source'].strip().split())
            trans = row['Translation'].strip()
            translation_map[src] = trans

    # 2. data.base のブロックパース
    # ブロック = { "keys": [key1, key2, ...], "lines": [(line_num, raw_text), ...] }
    blocks = []
    current_keys = []
    current_lines = []
    last_line_was_desc = False

    with open(database_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            stripped = line.strip()
            if not line.strip() or line.startswith('#'):
                continue

            is_desc = line.startswith('\t') or line.startswith(' ')
            if is_desc:
                # 引用文献行やコメント行は除外
                if stripped.startswith('[') and stripped.endswith(']'):
                    continue
                if stripped.startswith('#'):
                    continue
                
                current_lines.append((line_num, stripped))
                last_line_was_desc = True
            else:
                # キー行
                if last_line_was_desc:
                    # 前のブロックが終了したので保存
                    if current_keys and current_lines:
                        blocks.append({
                            "keys": current_keys,
                            "lines": current_lines
                        })
                    current_keys = []
                    current_lines = []
                current_keys.append(stripped)
                last_line_was_desc = False

        # 最後のブロックを保存
        if current_keys and current_lines:
            blocks.append({
                "keys": current_keys,
                "lines": current_lines
            })

    # 3. 各ブロックの翻訳判定
    untranslated_blocks = []
    translated_blocks_count = 0

    for block in blocks:
        # ブロック内の説明行が1行でも翻訳されているか判定
        is_translated = False
        for line_num, text in block["lines"]:
            normalized = " ".join(text.split())
            trans = translation_map.get(normalized, "")
            
            # [TODO] や === TODO === で始まらず、かつ空欄でもない翻訳があれば「翻訳済み」とみなす
            if trans and not trans.startswith("[TODO]") and not trans.startswith("=== TODO ==="):
                is_translated = True
                break
        
        if is_translated:
            translated_blocks_count += 1
        else:
            untranslated_blocks.append(block)

    print(f"--- 診断結果 (キーブロック単位) ---")
    print(f"総解説ブロック数: {len(blocks)}")
    print(f"翻訳完了ブロック数: {translated_blocks_count}")
    print(f"未翻訳ブロック数 (未着手): {len(untranslated_blocks)}")

    if untranslated_blocks:
        print("\n[未翻訳ブロックのサンプル (最初の10件)]")
        for i, block in enumerate(untranslated_blocks[:10], 1):
            keys_str = ", ".join(block["keys"])
            first_line_num = block["lines"][0][0]
            first_line_text = block["lines"][0][1]
            print(f"{i}. キー: {keys_str} (L{first_line_num}～) - 行数: {len(block['lines'])}")
            print(f"   サンプル原文: \"{first_line_text}\"")

if __name__ == "__main__":
    check_translations()

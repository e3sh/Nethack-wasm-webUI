import csv
import os
import sys

# Windowsコンソールでの文字化け対策
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

dict_path = r"c:\Users\e3-sh\Documents\GitHub\Nethack-wasm-webUI\dictionary.csv"
database_path = r"c:\Users\e3-sh\Desktop\works\NetHack-NetHack-5.0_org\NetHack-NetHack-5.0\dat\data.base"

def add_missing():
    if not os.path.exists(dict_path):
        print(f"Error: {dict_path} が見つかりません。")
        return
    if not os.path.exists(database_path):
        print(f"Error: {database_path} が見つかりません。")
        return

    # 1. 既存の Source の読み込み
    existing_sources = set()
    with open(dict_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            existing_sources.add(" ".join(row['Source'].strip().split()))

    # 2. data.base から未登録の行を抽出
    new_rows = []
    added_normalized = set()
    
    current_key = ""
    with open(database_path, 'r', encoding='utf-8') as f:
        for line in f:
            stripped = line.strip()
            if not line.strip() or line.startswith('#'):
                continue
            
            if line.startswith('\t') or line.startswith(' '):
                if stripped.startswith('[') and stripped.endswith(']'):
                    continue
                if stripped.startswith('#'):
                    continue
                
                normalized = " ".join(stripped.split())
                if normalized not in existing_sources and normalized not in added_normalized:
                    # CSV登録用の行を作成。
                    # data.base の行はもともと先頭にインデント（タブやスペース）が入っているので、
                    # CSV側でMessageとしてパースしやすいように、先頭スペース4つ程度を保持して追加します。
                    indent_clean = stripped
                    # もともとの行のインデントを再現するか、プレーンなままで追加するか
                    # 既存の dictionary.csv には "    After the Creation..." のようにスペースが入っています。
                    # ここでは data.base の元の行をそのまま Source に追加します。
                    # ただし、改行コードは取り除きます。
                    src_text = line.replace('\n', '').replace('\r', '')
                    
                    new_rows.append({
                        'Group': 'Message',
                        'Source': src_text,
                        'Translation': f"[TODO] {src_text}",
                        'Adj': '',
                        'Verb': ''
                    })
                    added_normalized.add(normalized)
            else:
                current_key = stripped

    if not new_rows:
        print("未登録の英文は見つかりませんでした。すでにすべて登録されています。")
        return

    # 3. dictionary.csv に追記
    with open(dict_path, 'a', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['Group', 'Source', 'Translation', 'Adj', 'Verb'])
        writer.writerows(new_rows)

    print(f"成功: {len(new_rows)} 件の未登録英文を {dict_path} の末尾に追加しました。")
    print("これで CSV に登録された未翻訳行を編集し、 python tools/dict_converter.py import を実行して nhMessage.js に反映できます。")

if __name__ == "__main__":
    add_missing()

import csv
import urllib.request
import urllib.parse
import json
import time
import sys
import os

# Windowsコンソールでの文字化け対策
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

dict_path = r"c:\Users\e3-sh\Documents\GitHub\Nethack-wasm-webUI\dictionary.csv"

def translate_en_to_ja(text):
    # Google Translate free API (client=gtx)
    # 英語(en) -> 日本語(ja)
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=" + urllib.parse.quote(text)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            translated = ""
            for part in data[0]:
                if part[0]:
                    translated += part[0]
            return translated
    except Exception as e:
        print(f"\n翻訳エラー ({text[:20]}...): {e}")
        return None

def auto_translate(limit=None):
    if not os.path.exists(dict_path):
        print(f"Error: {dict_path} が見つかりません。")
        return

    # 1. 既存のCSVを読み込む
    rows = []
    with open(dict_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            rows.append(row)

    # [TODO] が入っている行を抽出
    todo_rows = [r for r in rows if r['Translation'].startswith('[TODO]')]
    total = len(todo_rows)
    
    if limit:
        todo_rows = todo_rows[:limit]
        total = len(todo_rows)
        print(f"今回の自動翻訳制限数: {total} 件 (全体の [TODO] 数: {len([r for r in rows if r['Translation'].startswith('[TODO]')])} 件)")
    else:
        print(f"自動翻訳対象の [TODO] 行数: {total}")
    
    if total == 0:
        print("翻訳対象の [TODO] 行はありません。")
        return

    print("自動翻訳を開始します。Ctrl+C でいつでも安全に中断できます。")
    print("APIのアクセス制限を避けるため、1件ごとに約1.5秒のウェイトを挟みます...\n")
    
    success_count = 0
    try:
        for i, row in enumerate(todo_rows, 1):
            # [TODO] を除いた英語原文を取得して翻訳
            en_text = row['Source'].strip()
            # 行頭のタブや複数スペースなどを綺麗にしてから翻訳に投げる
            clean_text = " ".join(en_text.split())
            
            ja_text = translate_en_to_ja(clean_text)
            if ja_text:
                row['Translation'] = ja_text
                success_count += 1
                print(f"[{i}/{total}] {clean_text[:40]}... \n    -> {ja_text}")
            else:
                print(f"[{i}/{total}] スキップ: {clean_text[:40]}...")
            
            time.sleep(1.5)
            
            # 10件ごとに中間セーブ
            if i % 10 == 0:
                save_csv(rows, fieldnames)
                print("--- [中間セーブ完了] ---")
    except KeyboardInterrupt:
        print("\nユーザーによって処理が中断されました。")
    finally:
        save_csv(rows, fieldnames)
        print(f"\n処理を終了し、CSVを保存しました。 (成功: {success_count}/{total} 件)")

def save_csv(rows, fieldnames):
    with open(dict_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

if __name__ == "__main__":
    # 引数で翻訳件数を制限できるようにする (例: python auto_translate.py 50)
    limit = None
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            pass
    auto_translate(limit)

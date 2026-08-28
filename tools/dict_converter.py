import re
import os
import json
import csv

def unescape_js(s, quote_type):
    if quote_type == '"':
        return s.replace('\\"', '"').replace('\\\\', '\\')
    elif quote_type == "'":
        return s.replace("\\'", "'").replace('\\\\', '\\')
    elif quote_type == "`":
        return s.replace('\\`', '`').replace('\\\\', '\\')
    return s

def extract_js_array(content):
    if not content: return []
    # Detect { en: "...", jp: "..." }
    pattern_en_jp = r'\{\s*en:\s*("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`)\s*,\s*jp:\s*("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\\\]|\\.)*`)\s*\}'
    matches = re.findall(pattern_en_jp, content, re.DOTALL)
    if matches:
        results = []
        for m in matches:
            en_raw, jp_raw = m
            en = unescape_js(en_raw[1:-1], en_raw[0])
            jp = unescape_js(jp_raw[1:-1], jp_raw[0])
            results.append({'en': en, 'jp': jp})
        return results
    
    # Detect { pattern: /.../, replace: "..." }
    pattern_pat_rep = r'\{\s*pattern:\s*(/.*?/|"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\\\]|\\.)*`)\s*,\s*replace:\s*("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\\\]|\\.)*`)\s*\}'
    matches = re.findall(pattern_pat_rep, content, re.DOTALL)
    if matches:
        results = []
        for m in matches:
            pat_raw, rep_raw = m
            if pat_raw.startswith('/'):
                pat = pat_raw[1:-1]
            else:
                pat = unescape_js(pat_raw[1:-1], pat_raw[0])
            rep = unescape_js(rep_raw[1:-1], rep_raw[0])
            results.append({'pattern': pat, 'replace': rep})
        return results
    return []

def extract_js_object(content):
    if not content: return {}
    results = {}
    pair_pattern = r'("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|[^:\s,]+)\s*:\s*(\{.*?\}|"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\\\]|\\.)*`)'
    pairs = re.findall(pair_pattern, content, re.DOTALL)
    
    for k_raw, v_raw in pairs:
        k = k_raw.strip()
        if k.startswith('"') or k.startswith("'"):
            k = unescape_js(k[1:-1], k[0])
            
        v_raw = v_raw.strip()
        if v_raw.startswith('{'):
            pos_dict = {}
            for pos in ['noun', 'adj', 'verb']:
                p_match = re.search(rf'{pos}\s*:\s*("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`)', v_raw)
                if p_match:
                    p_val_raw = p_match.group(1)
                    pos_dict[pos] = unescape_js(p_val_raw[1:-1], p_val_raw[0])
            results[k] = pos_dict
        else:
            v = unescape_js(v_raw[1:-1], v_raw[0])
            results[k] = v
    return results

def get_function_body(content, func_name):
    # Match from function definition to the end of the file or next function
    match = re.search(f'function {func_name}.*?\\{{(.*?)(?=\\nfunction|\\Z)', content, re.DOTALL)
    return match.group(1) if match else ""

def export_to_csv(output_file):
    input_js = 'param/nhMessage.js'
    if not os.path.exists(input_js):
        print(f"Error: {input_js} not found. Please run migration first.")
        return

    with open(input_js, 'r', encoding='utf-8-sig') as f:
        content = f.read()

    messages = extract_js_array(get_function_body(content, 'nhMessage'))
    entities = extract_js_object(get_function_body(content, 'nhEntities'))
    items = extract_js_object(get_function_body(content, 'nhItems'))
    patterns = extract_js_array(get_function_body(content, 'nhPatterns'))

    rows = []
    for m in messages:
        rows.append({'Group': 'Message', 'Source': m['en'], 'Translation': m['jp'], 'Adj': '', 'Verb': ''})
    for k, v in entities.items():
        if isinstance(v, dict):
            rows.append({'Group': 'Entity', 'Source': k, 'Translation': v.get('noun', ''), 'Adj': v.get('adj', ''), 'Verb': v.get('verb', '')})
        else:
            rows.append({'Group': 'Entity', 'Source': k, 'Translation': v, 'Adj': '', 'Verb': ''})
    for k, v in items.items():
        if isinstance(v, dict):
            rows.append({'Group': 'Item', 'Source': k, 'Translation': v.get('noun', ''), 'Adj': v.get('adj', ''), 'Verb': v.get('verb', '')})
        else:
            rows.append({'Group': 'Item', 'Source': k, 'Translation': v, 'Adj': '', 'Verb': ''})
    for p in patterns:
        rows.append({'Group': 'Pattern', 'Source': p['pattern'], 'Translation': p['replace'], 'Adj': '', 'Verb': ''})

    with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['Group', 'Source', 'Translation', 'Adj', 'Verb'])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Exported {len(rows)} entries to {output_file}")

def clean_tag(text):
    if not isinstance(text, str): return text
    text = re.sub(r'\s*\(EN:[^)]*\)', '', text)
    text = re.sub(r'/\*.*?\*/', '', text)
    text = re.sub(r'===\s*BEGIN:?[^=]*===\s?', '', text)
    text = re.sub(r'\s?===\s*END:?[^=]*===', '', text)
    text = re.sub(r'===\s*TODO\s*===\s?', '', text)
    text = re.sub(r'\[BEGIN:?[^\]]*\]\s?', '', text)
    text = re.sub(r'\s?\[END:?[^\]]*\]', '', text)
    text = re.sub(r'\[TODO\]\s?', '', text)
    return text.strip()

def import_from_csv(input_file):
    messages, entities, items, patterns = [], {}, {}, []
    
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            g, src, trans, adj, verb = row['Group'], row['Source'], row['Translation'], row['Adj'], row['Verb']
            trans_clean = clean_tag(trans)
            adj_clean = clean_tag(adj)
            verb_clean = clean_tag(verb)
            
            val = trans_clean
            if adj_clean or verb_clean: val = {'noun': trans_clean, 'adj': adj_clean, 'verb': verb_clean}
            
            if g in ('Message', 'Data.base', 'Oracles', 'Rumors', 'Engrave', 'Epitaph', 'Quest', 'Tribute', 'Help', 'Sokoban/Levels', 'Sounds(聞こえる)', 'Status(状態異常)', 'Traps(罠関連)', 'ItemEffects(効果)', 'Prayer(いのり)', 'Achievements'):
                messages.append({'en': src, 'jp': trans_clean})
            elif g in ('Entity', 'Bogusmon'): entities[src] = val
            elif g == 'Item': items[src] = val
            elif g == 'Pattern': patterns.append({'pattern': src, 'replace': trans_clean})
                
    output_js = 'param/nhMessage.js'
    with open(output_js, 'w', encoding='utf-8-sig') as f:
        # Write functions
        def write_arr(func_name, data, is_msg=True):
            f.write(f"function {func_name}() {{\n    return [\n")
            for d in data:
                if is_msg:
                    f.write(f"        {{ en: {json.dumps(d['en'], ensure_ascii=False)}, jp: {json.dumps(d['jp'], ensure_ascii=False)} }},\n")
                else:
                    pat = d['pattern']
                    pat_formatted = pat.replace(' ', '\\s+')
                    # JSの正規表現リテラル /pattern/ 内でスラッシュが正しく機能するように / を \/ にエスケープ
                    pat_formatted = pat_formatted.replace('/', '\\/')
                    f.write(f"        {{ pattern: /{pat_formatted}/, replace: {json.dumps(d['replace'], ensure_ascii=False)} }},\n")
            f.write("    ];\n}\n\n")

        def write_obj(func_name, data):
            f.write(f"function {func_name}() {{\n    return {{\n")
            for k, v in data.items():
                k_json = json.dumps(k, ensure_ascii=False)
                if isinstance(v, dict):
                    parts = [f"{p}: {json.dumps(v[p], ensure_ascii=False)}" for p in ['noun', 'adj', 'verb'] if v.get(p)]
                    f.write(f"        {k_json}: {{ {', '.join(parts)} }},\n")
                else:
                    f.write(f"        {k_json}: {json.dumps(v, ensure_ascii=False)},\n")
            f.write("    };\n}\n\n")

        write_arr('nhMessage', messages)
        write_obj('nhEntities', entities)
        write_obj('nhItems', items)
        write_arr('nhPatterns', patterns, is_msg=False)

    print(f"Import completed successfully to {output_js}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python tools/dict_converter.py [export|import] [filename.csv]")
    else:
        cmd, filename = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'dictionary.csv'
        if cmd == 'export': export_to_csv(filename)
        elif cmd == 'import': import_from_csv(filename)

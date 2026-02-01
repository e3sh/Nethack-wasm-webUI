import re
import os
import json

def unescape_js(s, quote_type):
    if quote_type == '"':
        return s.replace('\\"', '"').replace('\\\\', '\\')
    elif quote_type == "'":
        return s.replace("\\'", "'").replace('\\\\', '\\')
    elif quote_type == "`":
        return s.replace('\\`', '`').replace('\\\\', '\\')
    return s

def extract_js_array(file_path, func_name=None):
    if not os.path.exists(file_path): return []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    if func_name:
        # Match from function definition to the end of the file or next function
        match = re.search(f'function {func_name}.*?\\{{(.*?)(?=\\nfunction|\\Z)', content, re.DOTALL)
        if not match: return []
        snippet = match.group(1)
    else:
        snippet = content

    # Detect { en: "...", jp: "..." }
    pattern_en_jp = r'\{\s*en:\s*("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`)\s*,\s*jp:\s*("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`)\s*\}'
    matches = re.findall(pattern_en_jp, snippet, re.DOTALL)
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
    matches = re.findall(pattern_pat_rep, snippet, re.DOTALL)
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

def extract_js_object(file_path, func_name=None):
    if not os.path.exists(file_path): return {}
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    if func_name:
        match = re.search(f'function {func_name}.*?\\.?(?:return)?\\s+\\{{(.*?)\\}}', content, re.DOTALL)
        if not match: return {}
        snippet = match.group(1)
    else:
        snippet = content

    results = {}
    pair_pattern = r'("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|[^:\s,]+)\s*:\s*(\{.*?\}|"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\\\]|\\.)*`)'
    pairs = re.findall(pair_pattern, snippet, re.DOTALL)
    
    for k_raw, v_raw in pairs:
        k = k_raw.strip()
        if k.startswith('"') or k.startswith("'"):
            k = unescape_js(k[1:-1], k[0])
            
        v_raw = v_raw.strip()
        if v_raw.startswith('{'):
            pos_dict = {}
            for pos in ['noun', 'adj', 'verb']:
                p_match = re.search(f'{pos}\s*:\s*("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\\\'\\\\]|\\\\.)*\'|`(?:[^`\\\\]|\\.)*`)', v_raw)
                if p_match:
                    p_val_raw = p_match.group(1)
                    pos_dict[pos] = unescape_js(p_val_raw[1:-1], p_val_raw[0])
            results[k] = pos_dict
        else:
            v = unescape_js(v_raw[1:-1], v_raw[0])
            results[k] = v
    return results

def main():
    print("Migrating separate JS dictionaries into a single nhMessage.js...")
    
    # 1. nhMessage (Basic sentences)
    messages = extract_js_array('param/nhMessage.js', 'nhMessage')
    if not messages:
        # Try fallback if it's already integrated but we need to re-read it
        messages = extract_js_array('param/nhMessage.js')
        
    # 2. nhEntities
    entities = extract_js_object('param/nhMessage_entity.js', 'nhMessage_entity')
    
    # 3. nhItems
    items = extract_js_object('param/nhMessage_items.js', 'nhMessage_entity_items')
    
    # 4. nhPatterns
    patterns = extract_js_array('param/nhMessage_pattern.js', 'nhMessage_pattern')
    item_patterns = extract_js_array('param/nhMessage_items.js', 'nhMessage_pattern_items')
    
    all_patterns = patterns + item_patterns
    
    output_path = 'param/nhMessage.js'
    with open(output_path, 'w', encoding='utf-8-sig') as f:
        # Write nhMessage
        f.write("function nhMessage() {\n    return [\n")
        for m in messages:
            f.write(f"        {{ en: {json.dumps(m['en'], ensure_ascii=False)}, jp: {json.dumps(m['jp'], ensure_ascii=False)} }},\n")
        f.write("    ];\n}\n\n")
        
        # Write nhEntities
        f.write("function nhEntities() {\n    return {\n")
        for k, v in entities.items():
            k_json = json.dumps(k, ensure_ascii=False)
            if isinstance(v, dict):
                parts = [f"{p}: {json.dumps(v[p], ensure_ascii=False)}" for p in ['noun', 'adj', 'verb'] if p in v]
                f.write(f"        {k_json}: {{ {', '.join(parts)} }},\n")
            else:
                f.write(f"        {k_json}: {json.dumps(v, ensure_ascii=False)},\n")
        f.write("    };\n}\n\n")

        # Write nhItems
        f.write("function nhItems() {\n    return {\n")
        for k, v in items.items():
            k_json = json.dumps(k, ensure_ascii=False)
            if isinstance(v, dict):
                parts = [f"{p}: {json.dumps(v[p], ensure_ascii=False)}" for p in ['noun', 'adj', 'verb'] if p in v]
                f.write(f"        {k_json}: {{ {', '.join(parts)} }},\n")
            else:
                f.write(f"        {k_json}: {json.dumps(v, ensure_ascii=False)},\n")
        f.write("    };\n}\n\n")

        # Write nhPatterns
        f.write("function nhPatterns() {\n    return [\n")
        for p in all_patterns:
            rep = json.dumps(p['replace'], ensure_ascii=False)
            f.write(f"        {{ pattern: /{p['pattern']}/, replace: {rep} }},\n")
        f.write("    ];\n}\n")

    print(f"Integration complete. All data combined into {output_path}")
    print(f" - Messages: {len(messages)}")
    print(f" - Entities: {len(entities)}")
    print(f" - Items: {len(items)}")
    print(f" - Patterns: {len(all_patterns)} (including {len(item_patterns)} item patterns)")

if __name__ == "__main__":
    main()

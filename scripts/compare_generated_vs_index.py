import json
import os
import re

# Paths
JSON_PATH = '/Users/michael/Documents/Ensinamentos/ShinCollege/data/shin_college_data.json'
INDICES_DIR = '/Users/michael/Documents/Ensinamentos/ShinCollege/Markdown/Indices'

# Map volume index filenames to volume names (or order) to match JSON
# JSON volumes:
# 0: 1.経綸・霊主体従・夜昼転換・祖霊祭祀編
# 1: 2.浄霊・神示の健康法・自然農法編
# 2: 3.信仰編
# 3: 4.その他

# Index filenames:
# 1- 経綸・霊主体従・夜昼転換・祖霊祭祀編.md
# 2 - 浄霊・神示の健康法・自然農法編.md
# 3- 信仰編.md
# 4 - その他.md

def normalize_string(s):
    # Remove "について" (about)
    s = s.replace('について', '')
    # Remove quotes
    s = s.replace('「', '').replace('」', '')
    # Remove spaces (full width and half width)
    s = s.replace('　', '').replace(' ', '')
    return s

def parse_index_file(filepath):
    """
    Parses an index markdown file.
    Returns a dict: { "Theme Name": {NormalizedTitle: OriginalTitle} }
    """
    themes = {}
    current_theme = None
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if line.startswith('・'):
            # It's a title
            title = line[1:].strip()
            if current_theme:
                 norm = normalize_string(title)
                 themes[current_theme][norm] = title
        else:
            current_theme = line
            if current_theme not in themes:
                themes[current_theme] = {}
                
    return themes

def load_json_data(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def check_mismatches():
    json_data = load_json_data(JSON_PATH)
    index_files = sorted(os.listdir(INDICES_DIR))
    
    for vol_idx, vol_data in enumerate(json_data):
        vol_name = vol_data['volume']
        vol_prefix = vol_name.split('.')[0]
        
        target_index_file = None
        for f in index_files:
            if f.startswith(f"{vol_prefix}-") or f.startswith(f"{vol_prefix} -"):
                target_index_file = f
                break
        
        if not target_index_file:
            print(f"Skipping Volume {vol_name}: No matching index file found.")
            continue
            
        print(f"Checking Volume: {vol_name}")
        
        index_content = parse_index_file(os.path.join(INDICES_DIR, target_index_file))
        
        # Flatten index keys for fuzzy matching themes
        # Map NormalizedTheme -> OriginalIndexTheme
        index_themes_norm = {normalize_string(k): k for k in index_content.keys()}

        for theme in vol_data['themes']:
            json_theme_name = theme['theme']
            norm_json_theme = normalize_string(json_theme_name)
            
            # Find matching theme in Index
            matched_index_theme_key = index_themes_norm.get(norm_json_theme)
            
            if not matched_index_theme_key:
                print(f"  [WARNING] JSON Theme '{json_theme_name}' NOT found in Index.")
                continue
            
            expected_titles_map = index_content[matched_index_theme_key] # {Norm: Orig}
            
            accidental = []
            for t in theme['titles']:
                if t['title'] == '---': continue
                json_title = t['title']
                norm_json_title = normalize_string(json_title)
                
                if norm_json_title not in expected_titles_map:
                    accidental.append(json_title)
            
            if accidental:
                print(f"  Theme: {json_theme_name} (Index: {matched_index_theme_key})")
                print(f"    Possible Accidental Titles (No match after normalization):")
                for t in accidental:
                     print(f"      - {t}")

if __name__ == "__main__":
    check_mismatches()

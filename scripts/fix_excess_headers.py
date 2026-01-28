import os
import json
import re

JSON_PATH = '/Users/michael/Documents/Ensinamentos/ShinCollege/data/shin_college_data.json'
INDICES_DIR = '/Users/michael/Documents/Ensinamentos/ShinCollege/Markdown/Indices'
BASE_MARKDOWN_DIR = '/Users/michael/Documents/Ensinamentos/ShinCollege/Markdown'

def normalize_string(s):
    # Same normalization as before
    s = s.replace('について', '')
    s = s.replace('「', '').replace('」', '')
    s = s.replace('　', '').replace(' ', '')
    return s

def load_json_data(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def parse_index_file(filepath):
    themes = {}
    current_theme = None
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for line in lines:
        line = line.strip()
        if not line: continue
        if line.startswith('・'):
            title = line[1:].strip()
            if current_theme:
                 norm = normalize_string(title)
                 themes[current_theme][norm] = title
        else:
            current_theme = line
            if current_theme not in themes:
                themes[current_theme] = {}
    return themes

def fix_excess_headers():
    json_data = load_json_data(JSON_PATH)
    index_files = sorted(os.listdir(INDICES_DIR))
    
    modified_files = set()
    edits_count = 0

    for vol_data in json_data:
        vol_name = vol_data['volume']
        vol_prefix = vol_name.split('.')[0]
        
        target_index_file = None
        for f in index_files:
             if f.startswith(f"{vol_prefix}-") or f.startswith(f"{vol_prefix} -"):
                target_index_file = f
                break
        
        if not target_index_file:
            continue
            
        index_content = parse_index_file(os.path.join(INDICES_DIR, target_index_file))
        index_themes_norm = {normalize_string(k): k for k in index_content.keys()}

        for theme in vol_data['themes']:
            json_theme_name = theme['theme']
            norm_json_theme = normalize_string(json_theme_name)
            
            matched_index_theme_key = index_themes_norm.get(norm_json_theme)
            if not matched_index_theme_key:
                continue
            
            expected_titles_map = index_content[matched_index_theme_key]
            
            for t_entry in theme['titles']:
                if t_entry['title'] == '---': continue
                
                json_title = t_entry['title']
                norm_json_title = normalize_string(json_title)
                
                # Check if it's a mismatch
                if norm_json_title not in expected_titles_map:
                    # FOUND A MISMATCH - EXCESS ITEM
                    # We need to remove '#' from the file
                    origin_filename = t_entry.get('origin_filename')
                    if not origin_filename:
                        print(f"Warning: No origin_filename for {json_title}")
                        continue
                        
                    # Find full path
                    # Volume is known from loop
                    # But parse_json structure: volume is a dir in Markdown
                    # vol_name is '1.経綸...'
                    
                    file_path = os.path.join(BASE_MARKDOWN_DIR, vol_name, origin_filename)
                    if not os.path.exists(file_path):
                        print(f"Warning: File not found {file_path}")
                        continue
                        
                    # Read file and replace
                    with open(file_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                    
                    new_lines = []
                    file_modified = False
                    
                    for line in lines:
                        # Match the header line
                        # The line in file starts with '# ' and may have 'について'
                        if line.strip().startswith('# '):
                            header_content = line.strip()[2:].strip()
                            # Apply 'replace' logic that generate_json used
                            cleaned_header_content = header_content.replace('について', '')
                            
                            # Compare with json_title (which also had つい stripped in generate_json)
                            # But wait, json_title is exactly what generate_json produced
                            # So if I apply the same transform to the line, they should match
                            
                            if cleaned_header_content == json_title:
                                # MATCH! Remove '#'
                                print(f"Removing '#' from: {header_content} in {origin_filename}")
                                new_lines.append(header_content + '\n') # Keep text, remove '#'
                                file_modified = True
                                edits_count += 1
                            else:
                                new_lines.append(line)
                        else:
                            new_lines.append(line)
                    
                    if file_modified:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.writelines(new_lines)
                        modified_files.add(file_path)

    print(f"Total edits: {edits_count}")
    print(f"Modified files: {len(modified_files)}")

if __name__ == "__main__":
    fix_excess_headers()

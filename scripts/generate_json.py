import os
import json
import re

# Base directory
BASE_DIR = "/Users/michael/Documents/Ensinamentos/ShinCollege/Markdown"
OUTPUT_FILE = "/Users/michael/Documents/Ensinamentos/ShinCollege/data/shin_college_data.json"

def parse_header(header_line):
    """
    Parses the H2 header line to extract Source, Title, and Date.
    Example: 明主様御教え　「救世主の出現」　（昭和10年8月5日発行）
    """
    # Clean markdown formatting (bold)
    header_line = re.sub(r'^(\*\*|＊＊)|(\*\*|＊＊)$', '', header_line.strip()).strip()

    # Initialize defaults
    source = ""
    title = ""
    date = ""

    # Try to find content inside 「」 for title
    title_match = re.search(r'「(.*?)」', header_line)
    if title_match:
        title = title_match.group(1)
    
    # Try to find content inside （） for date (looking for date-like chars or ends with 发行/published)
    # Using a broad catch for parentheses at the end of the string usually containing date info
    date_match = re.search(r'（(.*?)）', header_line)
    if date_match:
        date = date_match.group(1)

    # Source is usually the part before the title
    # We remove the title and date parts to get the source
    clean_line = header_line
    if title_match:
        clean_line = clean_line.replace(title_match.group(0), '')
    if date_match:
        clean_line = clean_line.replace(date_match.group(0), '')
    
    # Strip whitespace to get the source
    source = clean_line.strip()

    return {
        "full_header": header_line.strip(),
        "source": source,
        "publication_title": title,
        "date": date
    }

def convert_to_json():
    data = []

    # Iterate over volumes (directories)
    # Sorting to ensure "1.xxx", "2.xxx" order
    for volume_name in sorted(os.listdir(BASE_DIR)):
        volume_path = os.path.join(BASE_DIR, volume_name)
        
        if not os.path.isdir(volume_path) or volume_name.startswith('.'):
            continue

        if volume_name == 'Indices':
            continue

        volume_data = {
            "volume": volume_name,
            "themes": []
        }
        
        # Structure:
        # themes_map[theme_order] = {
        #   "name": theme_name,
        #   "groups": {
        #   "titles": [list of titles]
        # }
        themes_map = {}

        # Iterate over themes (files)
        # We process all files, sorting ensures _01, _02, etc are processed in order
        all_files = sorted(os.listdir(volume_path))
        all_files_set = set(all_files)

        for filename in all_files:
            if filename.startswith('.'):
                continue
            
            # Allow .md or no extension provided it matches pattern
            # Regex to parse: [Order] - [Name]_[Group]...
            match = re.match(r'^(\d+)\s*-\s*(.+?)(?:_(\d+))?(?:_edited)?\.md$', filename)
            
            if not match:
                continue

            # Skip unedited file if edited version exists
            if not filename.endswith('_edited.md'):
                potential_edited = filename[:-3] + "_edited.md"
                if potential_edited in all_files_set:
                    print(f"DEBUG: Skipping {filename} in favor of {potential_edited}")
                    continue

            print(f"DEBUG: Processing file: {filename}")

            theme_order = int(match.group(1))
            theme_name = match.group(2).strip()
            # group_order is ignored now - we merge all files for the same theme

            # Initialize theme entry if not exists
            if theme_order not in themes_map:
                themes_map[theme_order] = {
                    "name": theme_name,
                    "titles": []
                }
            
            file_path = os.path.join(volume_path, filename)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Split by H1 (# ) or H2 (## )
            # We want to capture the header itself to identify type
            tokens = re.split(r'^((?:#|##)\s+.+)$', content, flags=re.MULTILINE)
            
            current_title_entry = None
            pending_source = None
            
            # Token 0 is text before first header (usually empty or intro)
            # Token 1 is Header
            # Token 2 is Content following Header
            # ...
            
            for i in range(1, len(tokens), 2):
                header_line = tokens[i].strip()
                section_content = tokens[i+1].strip() if i+1 < len(tokens) else ""
                
                if header_line.startswith('# '):
                    # H1 - New Title
                    title_text = header_line[1:].strip() # remove '# '
                    
                    # Normalize title: Remove 'について' (About) to match Index format
                    title_text = title_text.replace('について', '')
                    
                    current_title_entry = {
                        "title": title_text,
                        "publications": []
                    }
                    
                    # Add pending source if any (H2 appeared before H1)
                    if pending_source:
                        parsed = parse_header(pending_source)
                        pub_entry = {
                            "header": parsed["full_header"],
                            "source": parsed["source"],
                            "publication_title": parsed["publication_title"],
                            "date": parsed["date"],
                            "content": "", # Intro content attached to H2 usually? Or empty.
                            "type": "intro"
                        }
                        
                        current_title_entry["publications"].append(pub_entry)
                        pending_source = None

                    # Store origin filename to handle separators later
                    current_title_entry["origin_filename"] = filename
                    themes_map[theme_order]["titles"].append(current_title_entry)
                    
                    pass

                elif header_line.startswith('## '):
                    # H2 - Publication Source
                    if current_title_entry:
                        # Parse header
                        parsed = parse_header(header_line[3:]) # remove '## '
                        
                        pub_entry = {
                            "header": parsed["full_header"],
                            "source": parsed["source"],
                            "publication_title": parsed["publication_title"],
                            "date": parsed["date"],
                            "content": section_content,
                            "type": "publication"
                        }
                        current_title_entry["publications"].append(pub_entry)
                    else:
                        # Treat as pending source for next H1
                        pending_source = header_line[3:]
        
        # After processing all files in volume, flatten into volume_data
        sorted_theme_keys = sorted(themes_map.keys())
        
        for t_key in sorted_theme_keys:
            theme_obj = themes_map[t_key]
            
            # Filter out empty titles
            filtered_titles = [
                title for title in theme_obj["titles"]
                if title.get("publications") and len(title["publications"]) > 0
            ]
            
            if not filtered_titles:
                continue

            final_titles_list = []
            last_filename = None

            for title in filtered_titles:
                current_filename = title.get("origin_filename")
                
                # If filename changed and it's not the first item, add separator
                if last_filename and current_filename and current_filename != last_filename:
                     final_titles_list.append({
                        "title": "---",
                        "publications": []
                    })
                
                # Remove origin_filename before adding to final list to keep JSON clean (optional, but good practice)
                # title_copy = title.copy()
                # if "origin_filename" in title_copy:
                #    del title_copy["origin_filename"]
                # final_titles_list.append(title_copy)
                # Actually, keeping it might be useful for debugging, but let's keep it clean
                
                # For now just append the object, extra keys are ignored by frontend usually
                final_titles_list.append(title)
                last_filename = current_filename

            theme_entry = {
                "theme": theme_obj["name"],
                "titles": final_titles_list
            }
            
            volume_data["themes"].append(theme_entry)
        
        data.append(volume_data)

    # Write JSON output
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"JSON generated at: {OUTPUT_FILE}")

if __name__ == "__main__":
    convert_to_json()

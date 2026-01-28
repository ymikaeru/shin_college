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

        volume_data = {
            "volume": volume_name,
            "themes": []
        }
        
        # Structure:
        # themes_map[theme_order] = {
        #   "name": theme_name,
        #   "groups": {
        #       group_order: [list of titles]
        #   }
        # }
        themes_map = {}

        # Iterate over themes (files)
        # We process all files, sorting doesn't stricly matter here as we will sort by extracted ID later, 
        # but sorted() is good for deterministic processing order.
        for filename in sorted(os.listdir(volume_path)):
            if filename.startswith('.'):
                continue
            
            # Allow .md or no extension provided it matches pattern
            # Regex to parse: [Order] - [Name]_[Group]...
            # Examples:
            # "9 - 祖霊祭祀_01_edited.md" -> Order=9, Name=祖霊祭祀, Group=01
            # "1 - 序文" -> Order=1, Name=序文, Group=0 (default)
            
            # Pattern breakdown:
            # ^(\d+)        : Start with digits (Theme Order)
            # \s*-\s*       : Separator " - "
            # (.+?)         : Theme Name (non-greedy)
            # (?:_(\d+))?   : Optional Group Order (underscore + digits)
            # (?:_edited)?  : Optional _edited suffix
            # (?:\.md)?$    : Optional .md extension
            match = re.match(r'^(\d+)\s*-\s*(.+?)(?:_(\d+))?(?:_edited)?(?:\.md)?$', filename)
            
            if not match:
                # Skip files that don't match the numbering convention
                print(f"Skipping non-matching file: {filename}")
                continue

            theme_order = int(match.group(1))
            theme_name_base = match.group(2)
            group_order = int(match.group(3)) if match.group(3) else 0
            
            # Construct display theme name: "9 - 祖霊祭祀"
            display_theme_name = f"{theme_order} - {theme_name_base}"

            if theme_order not in themes_map:
                themes_map[theme_order] = {
                    "name": display_theme_name,
                    "groups": {}
                }
            
            if group_order not in themes_map[theme_order]["groups"]:
                 themes_map[theme_order]["groups"][group_order] = []

            file_path = os.path.join(volume_path, filename)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Split by headers (H1 or H2), capturing the delimiter
            tokens = re.split(r'^((?:#|##)\s+.+)$', content, flags=re.MULTILINE)

            current_title_entry = None
            pending_source = None 

            i = 1
            while i < len(tokens):
                header_line = tokens[i].strip()
                section_content = tokens[i+1].strip() if i+1 < len(tokens) else ""
                
                # Clean markdown formatting from header (bold)
                header_line_clean = re.sub(r'^(\*\*|＊＊)|(\*\*|＊＊)$', '', header_line).strip()
                
                if header_line.startswith('# '):
                    # H1 - New Title
                    title_text = header_line[1:].strip() # remove '# '
                    
                    current_title_entry = {
                        "title": title_text,
                        "publications": []
                    }
                    
                    themes_map[theme_order]["groups"][group_order].append(current_title_entry)

                    if pending_source:
                         parsed = parse_header(pending_source)
                         pub_entry = {
                            "header": parsed["full_header"],
                            "source": parsed["source"],
                            "publication_title": parsed["publication_title"],
                            "date": parsed["date"],
                            "content": section_content,
                            "type": "publication"
                         }
                         current_title_entry["publications"].append(pub_entry)
                         pending_source = None
                    else:
                        if section_content:
                            current_title_entry["publications"].append({
                                "header": "Introduction", 
                                "content": section_content,
                                "type": "intro"
                            })

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
                        # Found H2 before H1 (e.g. at start of file before first title?)
                        # Treat as pending source for next H1
                        pending_source = header_line[3:]

                i += 2

        # After processing all files in volume, flatten into volume_data
        
        # Sort themes by order
        sorted_theme_keys = sorted(themes_map.keys())
        
        for t_key in sorted_theme_keys:
            theme_obj = themes_map[t_key]
            theme_entry = {
                "theme": theme_obj["name"],
                "titles": []
            }
            
            # Sort groups by order
            sorted_group_keys = sorted(theme_obj["groups"].keys())
            
            for index, g_key in enumerate(sorted_group_keys):
                group_titles = theme_obj["groups"][g_key]
                
                # Add titles from this group
                theme_entry["titles"].extend(group_titles)
                
                # Add separator if this is not the last group
                if index < len(sorted_group_keys) - 1:
                    theme_entry["titles"].append({
                        "title": "---",
                        "publications": []
                    })
            
            volume_data["themes"].append(theme_entry)

        data.append(volume_data)

    # Write JSON output
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"JSON generated at: {OUTPUT_FILE}")

if __name__ == "__main__":
    convert_to_json()

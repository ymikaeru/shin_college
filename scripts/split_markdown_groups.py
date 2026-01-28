import os
import re
import glob

def get_base_title(title):
    # Remove H1 marker
    clean = re.sub(r'^#\s*', '', title).strip()
    # Remove numbers at the end (full width or half width)
    # Example: "浄霊の原理　１" -> "浄霊の原理"
    # Example: "浄霊の原理　1" -> "浄霊の原理"
    # Example: "浄霊の原理 1" -> "浄霊の原理"
    base = re.sub(r'[　\s]*[0-9０-９]+$', '', clean)
    # Remove specific suffixes if needed, or rely on base match
    # Remove "について" -> Optional? "病気の根本原因について" vs "病気の根本原因" might be same?
    # Let's keep "について" for now as it usually persists in the series.
    return base

def process_file(filepath):
    print(f"Processing {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    sections = []
    current_section = []
    current_title = ""
    
    # Identify boundaries
    for line in lines:
        if re.match(r'^#\s+', line):
            if current_section:
                sections.append({'title': current_title, 'lines': current_section})
            current_section = [line]
            current_title = line.strip()
        else:
            current_section.append(line)
    
    if current_section:
        sections.append({'title': current_title, 'lines': current_section})

    if not sections:
        print("No sections found.")
        return

    # Group sections
    groups = []
    if sections:
        current_group = [sections[0]]
        last_base = get_base_title(sections[0]['title'])
        
        for i in range(1, len(sections)):
            sec = sections[i]
            this_base = get_base_title(sec['title'])
            
            # Logic: If base title is same or very similar, keep in group.
            # Also handle the case where title changes slightly but logic implies group?
            # E.g. "浄霊の原理　１" -> "浄霊の原理 ２" (Base: 浄霊の原理) -> Match
            # "浄霊の原理について　１" (Base: 浄霊の原理について) -> Mismatch with "浄霊の原理"
            # But maybe we want them separate if they are different series?
            # Yes, "浄霊の原理" and "浄霊の原理について" might be distinct series.
            
            if this_base == last_base:
                current_group.append(sec)
            else:
                groups.append(current_group)
                current_group = [sec]
                last_base = this_base
        
        groups.append(current_group)

    if len(groups) <= 1:
        print(f"File {filepath} contains only 1 group. No need to split (or already split).")
        # However, if the file is HUGE and has 1 group? Unlikely if base title is identical.
        # But if the file was named "Theme_edited.md" and we want "Theme_01_edited.md", we should rename it.
        # For now, only split if > 1 group.
        return

    # Write groups
    dirname = os.path.dirname(filepath)
    basename = os.path.basename(filepath)
    # Expected basename: "Number - Name_edited.md" or "Name_edited.md"
    # We want "Number - Name_01_edited.md"
    
    # Extract prefix number if present
    # Regex for "1 - Name_edited.md"
    match = re.match(r'^(\d+)\s*-\s*(.*)_edited\.md$', basename)
    if match:
        prefix_num = match.group(1)
        core_name = match.group(2)
    else:
        # Fallback
        prefix_num = "0"
        core_name = basename.replace('_edited.md', '')

    print(f"Found {len(groups)} groups.")
    
    for idx, group in enumerate(groups):
        suffix = f"{idx+1:02d}"
        new_filename = f"{prefix_num} - {core_name}_{suffix}_edited.md"
        new_path = os.path.join(dirname, new_filename)
        
        print(f"Writing {new_filename}...")
        with open(new_path, 'w', encoding='utf-8') as f:
            for sec in group:
                f.writelines(sec['lines'])

    # Rename original to .bak
    os.rename(filepath, filepath + ".bak")
    print(f"Renamed original to {filepath}.bak")

def main():
    # Folder 2
    target_dir = "/Users/michael/Documents/Ensinamentos/ShinCollege/Markdown/2.浄霊・神示の健康法・自然農法編"
    # Specific files to split
    # files_to_check = glob.glob(os.path.join(target_dir, "*_edited.md"))
    # We only want to process the monolithic ones.
    # Exclude those that already have "_01_", "_02_" in name?
    # Monolithic pattern: "Number - Name_edited.md"
    # Split pattern: "Number - Name_XX_edited.md"
    
    files = glob.glob(os.path.join(target_dir, "*_edited.md"))
    for f in files:
        if re.search(r'_\d{2}_edited\.md$', f):
            continue # Already split
        
        # Check size or content? Just process it.
        # If it has only 1 group, process_file returns without doing anything.
        process_file(f)

    # Folder 3
    target_dir_3 = "/Users/michael/Documents/Ensinamentos/ShinCollege/Markdown/3.信仰編"
    files_3 = glob.glob(os.path.join(target_dir_3, "*_edited.md"))
    for f in files_3:
        if re.search(r'_\d{2}_edited\.md$', f):
            continue
        process_file(f)

    # Folder 4
    target_dir_4 = "/Users/michael/Documents/Ensinamentos/ShinCollege/Markdown/4.その他"
    files_4 = glob.glob(os.path.join(target_dir_4, "*_edited.md"))
    for f in files_4:
        if re.search(r'_\d{2}_edited\.md$', f):
            continue
        process_file(f)

if __name__ == "__main__":
    main()

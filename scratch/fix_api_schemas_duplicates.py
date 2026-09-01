import re

schemas_path = 'lib/api-client-react/src/generated/api.schemas.ts'
with open(schemas_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find interface blocks and remove duplicate lines that start with "languages"

def fix_interface_block(match):
    block = match.group(0)
    lines = block.split('\n')
    new_lines = []
    seen_languages = False
    for line in lines:
        if re.search(r'^\s*languages\??\s*:', line):
            if seen_languages:
                # skip duplicate
                continue
            seen_languages = True
        new_lines.append(line)
    return '\n'.join(new_lines)

# Find export interface { ... } blocks
new_content = re.sub(r'export interface [A-Za-z0-9_]+\s*\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}', fix_interface_block, content)

with open(schemas_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Fixed duplicate properties in api.schemas.ts")

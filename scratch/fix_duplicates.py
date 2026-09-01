import re

api_path = 'lib/api-zod/src/generated/api.ts'
with open(api_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find zod.object({ ... }) blocks and remove duplicate lines that start with "languages"

def fix_object_block(match):
    block = match.group(0)
    lines = block.split('\n')
    new_lines = []
    seen_languages = False
    for line in lines:
        # Check if the line defines "languages"
        if re.search(r'"languages"\s*:', line):
            if seen_languages:
                # Skip duplicate
                # Also we need to make sure we don't leave a trailing comma issue, but JS objects in zod don't care much, 
                # wait, if the duplicate had a comma from the previous line? The line we skip might have a comma.
                # Actually, let's just use regex to strip out the exact line we added if it's a duplicate.
                continue
            seen_languages = True
        new_lines.append(line)
    
    # fix dangling commas before we join? We just skipped a line.
    # The line before might have a comma, which is fine in JS/TS.
    return '\n'.join(new_lines)

# Find zod.object({ ... }) blocks
new_content = re.sub(r'zod\.object\(\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}\)', fix_object_block, content)

with open(api_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Fixed duplicate properties in api.ts")

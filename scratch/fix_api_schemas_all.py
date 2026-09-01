import re

schemas_path = 'lib/api-client-react/src/generated/api.schemas.ts'
with open(schemas_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all occurrences of `shoeSize?: string | null;` with itself + languages
pattern = r'(shoeSize\?:\s*string\s*\|\s*null;)'
parts = re.split(pattern, content)
new_content = ""
for i in range(len(parts)):
    new_content += parts[i]
    if i % 2 == 1:
        # Check if the next part already starts with languages
        if i + 1 < len(parts) and not re.search(r'^\s*languages\?', parts[i+1]):
            new_content += '\n  languages?: string[] | null;'

with open(schemas_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Added languages to api.schemas.ts")

import re

api_path = 'lib/api-zod/src/generated/api.ts'
with open(api_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find shoeSize
pattern = r'(\s*"shoeSize":\s*zod\.string\(\)\.nullish\(\))'

# We want to replace it with shoeSize and languages, but only if languages isn't already there.
# Let's split by the pattern, and reconstruct.
parts = re.split(pattern, content)
new_content = ""
for i in range(len(parts)):
    new_content += parts[i]
    if i % 2 == 1: # This is the shoeSize match
        # Check if the next part already starts with languages
        if i + 1 < len(parts) and not re.match(r'^\s*,\s*"languages"', parts[i+1]):
            new_content += ',\n  "languages": zod.array(zod.string()).nullish()'

with open(api_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Added languages to all shoeSize occurrences in api.ts")

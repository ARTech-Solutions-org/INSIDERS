import re

schemas_path = 'lib/api-client-react/src/generated/api.schemas.ts'
with open(schemas_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add languages: string[] | null; if it's not already in UsherProfile
# we can look for export interface UsherProfile { ... }

target = "export interface UsherProfile {"
if target in content and "languages?: string[]" not in content and "languages?: string[] | null;" not in content:
    replacement = target + "\n  languages?: string[] | null;"
    content = content.replace(target, replacement)
    with open(schemas_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added languages to UsherProfile in api.schemas.ts")
else:
    print("Could not find UsherProfile or languages already exists")

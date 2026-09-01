import re

api_path = 'lib/api-zod/src/generated/api.ts'
with open(api_path, 'r', encoding='utf-8') as f:
    content = f.read()

# find UpdateMyUsherProfileBody
target = 'export const UpdateMyUsherProfileBody = zod.object({'
if target in content and '"languages"' not in content:
    replacement = target + '\n    "languages": zod.array(zod.string()).nullish(),'
    content = content.replace(target, replacement)
    with open(api_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added languages to UpdateMyUsherProfileBody")
else:
    print("Could not find UpdateMyUsherProfileBody or languages already exists")

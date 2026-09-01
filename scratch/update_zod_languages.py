import re

api_path = 'lib/api-zod/src/generated/api.ts'
with open(api_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add languages to UpdateMyUsherProfileBody
target = '"shoeSize": zod.string().nullish()\n  })'
replacement = '"shoeSize": zod.string().nullish(),\n    "languages": zod.array(zod.string()).nullish()\n  })'
content = content.replace(target, replacement)

# Add languages to UsherProfile if not there
target_profile = '"shoeSize": zod.string().nullish()\n  })'
content = content.replace(target_profile, replacement)

with open(api_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed api.ts')

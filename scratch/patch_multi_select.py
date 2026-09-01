import re

# Patch profile.tsx
profile_path = 'artifacts/ushers-app/src/pages/profile.tsx'
with open(profile_path, 'r', encoding='utf-8') as f:
    content = f.read()

if "import { MultiSelectDropdown }" not in content:
    # insert after Badge import or similar
    content = re.sub(r"(import \{ Skeleton \} from '@/components/ui/skeleton';)", r"\1\nimport { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';", content)
    with open(profile_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched profile.tsx")


# Patch register.tsx
register_path = 'artifacts/ushers-app/src/pages/register.tsx'
with open(register_path, 'r', encoding='utf-8') as f:
    content = f.read()

if "import { MultiSelectDropdown }" not in content:
    # insert import
    content = re.sub(r"(import \{ Badge \} from '@/components/ui/badge';)", r"\1\nimport { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';", content)
    # remove definition
    def_regex = r"function MultiSelectDropdown\([^\{]+\{[^}]*return \(\s*<DropdownMenu>.*?</DropdownMenu>\s*\);\s*\}"
    content = re.sub(def_regex, "", content, flags=re.DOTALL)
    
    with open(register_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched register.tsx")


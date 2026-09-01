import re

# 1. Fix register.tsx definition
register_path = 'artifacts/ushers-app/src/pages/register.tsx'
with open(register_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Instead of regex, just split and remove the function if it's there
# It looks like:
# function MultiSelectDropdown({ options, value = [], onChange, placeholder = "Select..." }: { options: string[], value: string[], onChange: (v: string[]) => void, placeholder?: string }) {
#   return (
# ...
#   );
# }

def remove_function(code, func_name):
    start = code.find(f"function {func_name}(")
    if start == -1:
        return code
    
    # find matching brace
    brace_count = 0
    in_func = False
    end = -1
    for i in range(start, len(code)):
        if code[i] == '{':
            if not in_func:
                in_func = True
            brace_count += 1
        elif code[i] == '}':
            brace_count -= 1
            if in_func and brace_count == 0:
                end = i + 1
                break
    
    if end != -1:
        return code[:start] + code[end:]
    return code

content = remove_function(content, 'MultiSelectDropdown')
with open(register_path, 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Fix profile.tsx useState missing languages
profile_path = 'artifacts/ushers-app/src/pages/profile.tsx'
with open(profile_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace setFormData({ fullName: profile.fullName, phone: profile.phone })
# with setFormData({ fullName: profile.fullName, phone: profile.phone, languages: profile.languages || [] })
content = content.replace("setFormData({ fullName: profile.fullName, phone: profile.phone });", "setFormData({ fullName: profile.fullName, phone: profile.phone, languages: profile.languages || [] });")

with open(profile_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed register.tsx and profile.tsx")

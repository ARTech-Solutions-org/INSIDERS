import yaml

file_path = "f:/ARTech/Usher-Management/Usher-Management/lib/api-spec/openapi.yaml"
with open(file_path, "r", encoding="utf-8") as f:
    data = yaml.safe_load(f)

# UpdateMyUsherProfileBody
props = data['components']['schemas']['UpdateMyUsherProfileBody']['properties']
if 'languages' not in props:
    props['languages'] = {
        'type': 'array',
        'items': {
            'type': 'string'
        },
        'nullable': True
    }

# UsherProfile (if needed)
props_profile = data['components']['schemas']['UsherProfile']['properties']
if 'languages' not in props_profile:
    props_profile['languages'] = {
        'type': 'array',
        'items': {
            'type': 'string'
        },
        'nullable': True
    }

with open(file_path, "w", encoding="utf-8") as f:
    yaml.dump(data, f, sort_keys=False, allow_unicode=True)
print("Updated openapi.yaml")

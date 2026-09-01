import yaml

file_path = "f:/ARTech/Usher-Management/Usher-Management/lib/api-spec/openapi.yaml"
with open(file_path, "r", encoding="utf-8") as f:
    data = yaml.safe_load(f)

# Find the updateMyUsherProfile operation and its body
paths = data.get('paths', {})
for path, methods in paths.items():
    if 'patch' in methods and methods['patch'].get('operationId') == 'updateMyUsherProfile':
        req_body = methods['patch']['requestBody']['content']['application/json']['schema']
        if '$ref' in req_body:
            ref_name = req_body['$ref'].split('/')[-1]
            props = data['components']['schemas'][ref_name]['properties']
            print(f"Adding languages to {ref_name}")
            props['languages'] = {
                'type': 'array',
                'items': {'type': 'string'},
                'nullable': True
            }
        else:
            print("Adding languages to inline schema")
            props = req_body['properties']
            props['languages'] = {
                'type': 'array',
                'items': {'type': 'string'},
                'nullable': True
            }

with open(file_path, "w", encoding="utf-8") as f:
    yaml.dump(data, f, sort_keys=False, allow_unicode=True)
print("Updated openapi.yaml")

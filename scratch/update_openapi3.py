import yaml

with open('lib/api-spec/openapi.yaml', 'r') as f:
    data = yaml.safe_load(f)

# Update EventAssignment
if 'EventAssignment' in data['components']['schemas']:
    props = data['components']['schemas']['EventAssignment']['properties']
    props['lateArrivalMinutes'] = {'type': ['number', 'null']}
    props['earlyLeaveMinutes'] = {'type': ['number', 'null']}
    props['checkinPhotoKey'] = {'type': ['string', 'null']}

# Update MyAssignment 
if 'MyAssignment' in data['components']['schemas']:
    props = data['components']['schemas']['MyAssignment']['properties']
    props['lateArrivalMinutes'] = {'type': ['number', 'null']}
    props['earlyLeaveMinutes'] = {'type': ['number', 'null']}
    props['checkinPhotoKey'] = {'type': ['string', 'null']}

with open('lib/api-spec/openapi.yaml', 'w') as f:
    yaml.dump(data, f, sort_keys=False)

import json, re

# load JSON
with open('CelesteLevelData.json','r',encoding='utf-8') as f:
    data=json.load(f)

# load ap names
loc_text = open('src/Data/locations.ts','r',encoding='utf-8').read()
m = re.search(r'RAW_LOCATIONS\s*=\s*\[(.*?)\];', loc_text, re.S)
items = re.findall(r'"([^\"]+)"', m.group(1))
ap_set = set(items)

# build mechanic lookup
map_text = open('src/Logic/mechanicsMapping.ts','r',encoding='utf-8').read()
entries = re.findall(r"['\"]([^'\"]+)['\"]\s*:\s*\{\s*logicKey\s*:\s*['\"]([^'\"]+)['\"]", map_text)
lookup = {re.sub('[^a-z0-9]','',k.lower()):v for k,v in entries}
for v in set(v for k,v in entries):
    lookup[re.sub('[^a-z0-9]','',v.lower())]=v

rule_map = {}
unmapped = set()

for lvl in data['levels']:
    levelDisplay=lvl['display_name']
    for room in lvl['rooms']:
        roomName=room['name']
        for reg in room['regions']:
            for loc in reg.get('locations',[]):
                if loc['type']=='strawberry':
                    suffix=f"Room {roomName} {loc['display_name']}"
                else:
                    suffix=loc['display_name']
                apName=f"{levelDisplay} - {suffix}"
                if apName not in ap_set:
                    continue
                rule = loc.get('rule') and loc['rule'][0] or []
                keys=[]
                for mech in rule:
                    norm=re.sub('[^a-z0-9]','',mech.lower())
                    key = lookup.get(norm) or lookup.get('has'+norm)
                    if key:
                        keys.append(key)
                    else:
                        if norm.startswith('gem') or norm.endswith('clutter') or norm=='kevinblocks':
                            continue
                        if norm=='fireiceballs':
                            k2=lookup.get('fireandiceballs')
                            if k2: keys.append(k2)
                            continue
                        unmapped.add((mech, apName))
                rule_map[apName]=keys

# show rules for B/C-side locations
print('\nB/C side requirements:')
for name,keys in rule_map.items():
    if ' B - ' in name or ' C - ' in name:
        if keys:
            print(name, '=>', keys)
        else:
            print(name, '=> <none>')

print('mapped', len(rule_map), 'of', len(ap_set))
nonempty = [k for k,v in rule_map.items() if v]
print('with requirements', len(nonempty))
print('example entries', nonempty[:5])
missing = [n for n in items if n not in rule_map]
print('unmapped ap count', len(missing))
print('sample unmapped', missing[:10])
print('unmapped mechanics examples', list(unmapped)[:10])

# show a few locations that require particular keys
print('\nlocations containing front/entrance keys:')
for name,keys in rule_map.items():
    if 'hasFrontDoorKey' in keys or 'hasEntranceKey' in keys:
        print(name, '=>', keys)

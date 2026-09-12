from pathlib import Path
import hashlib,json,sys
p=Path(__file__).resolve().parents[1];root=p.parent
base=json.loads((p/'evidence/source-baseline.json').read_text(encoding='utf-8'))
changed=[]
for item in base['files']:
 f=root/item['path']
 if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest()!=item['sha256']: changed.append(item['path'])
print('Baseline commit: '+base['commit'])
print('Changed/missing since package: '+str(len(changed)))
for n in changed: print(n)
print('Read-only comparison; changes are not errors and must never be reset automatically.')

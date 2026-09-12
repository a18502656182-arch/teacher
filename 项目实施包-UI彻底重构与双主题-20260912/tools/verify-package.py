from pathlib import Path
import hashlib,json,re,sys
from html.parser import HTMLParser
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
errors=[]
for item in manifest['files']:
 p=(root/item['path']).resolve()
 if not p.is_relative_to(root.resolve()): errors.append('unsafe path '+item['path']);continue
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=item['sha256']: errors.append('missing/changed '+item['path'])
class Links(HTMLParser):
 def handle_starttag(self,tag,attrs):
  for k,v in attrs:
   if k in ('href','src') and v and not v.startswith(('#','http:','https:','data:')) and not (root/v).exists(): errors.append('broken index link '+v)
Links().feed((root/'index.html').read_text(encoding='utf-8'))
tasks=list((root/'tasks').glob('TASK-*.md')); pages=list((root/'pages').glob('*.md'))
if len(tasks)!=33 or len(pages)!=23: errors.append('task/page count mismatch')
if len(list((root/'references/campus').glob('*.png')))!=6 or len(list((root/'references/glass').glob('*.png')))!=6: errors.append('reference count mismatch')
if errors:
 print('FAILED\n'+'\n'.join(errors));sys.exit(1)
print(f"PASS: {len(manifest['files'])} file hashes; 33 tasks; 23 page cards; 12 references; index links valid. This is package integrity, not product acceptance.")

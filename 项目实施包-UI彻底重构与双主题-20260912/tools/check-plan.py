from pathlib import Path
import json,csv,sys
p=Path(__file__).resolve().parents[1]
def rows(n):
 with (p/'trackers'/n).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
errors=[];tasks=rows('tasks.csv');ids={r['task'] for r in tasks}
for i,r in enumerate(tasks,1):
 if r['task']!=f'TASK-{i:02}': errors.append('task ordering '+r['task'])
 if r['depends_on']!='无':
  for d in r['depends_on'].split(','):
   if 'TASK-'+d not in ids or int(d)>=i:errors.append('invalid dependency '+r['task']+' '+d)
 if r['status']=='done' and (not r['commit'] or not r['evidence']):errors.append('done without evidence '+r['task'])
features=rows('feature-preservation.csv');covered={r['module'] for r in features}
required=set('dashboard students homework attendance dictation points rules growth health records scores reflection weekly comments schedule tools seating duty cadres family entry account admin'.split())
if covered!=required:errors.append('module coverage mismatch')
acceptance=rows('acceptance.csv')
for r in acceptance:
 if r['result']=='pass' and (not r['commit'] or not r['evidence']):errors.append('pass without evidence '+r['id'])
for f in p.rglob('*'):
 if f.suffix in ('.md','.json','.csv','.html','.mjs','.py','.txt'):
  text=f.read_text(encoding='utf-8-sig')
  if chr(65533) in text:errors.append('replacement character '+f.name)
if errors: print('FAILED\n'+'\n'.join(errors));sys.exit(1)
print(f'PASS: task DAG, 23 module/surface scopes, {len(acceptance)} acceptance rows, evidence gates and UTF-8 text. Implementation remains planned.')

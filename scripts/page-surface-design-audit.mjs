import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex').toUpperCase();
function local(root,p){return typeof p==='string'&&!path.isAbsolute(p)&&!p.includes(':')&&!p.replaceAll('\\','/').split('/').includes('..')&&existsSync(path.join(root,p));}
// A human/source inventory owns completeness; this verifies that its named surfaces were not skipped.
export function auditSurfaceDesign(root,record,stage='candidates'){
 const errors=[],coverage=record.surfaceCoverage;
 if(!coverage?.inventoryReviewed||!coverage.sourceFiles?.length||!coverage.surfaces?.length)return ['source-backed independent-surface inventory missing'];
 for(const f of coverage.sourceFiles)if(!local(root,f.path)||hash(path.join(root,f.path))!==f.sha256)errors.push('surface inventory source missing or changed: '+f.path);
 const used=new Map(),ids=new Set();
 for(const surface of coverage.surfaces){
  if(!surface.id||!surface.entry||!surface.purpose)errors.push('surface id/entry/purpose missing');
  if(ids.has(surface.id))errors.push('duplicate surface id: '+surface.id);ids.add(surface.id);
  if(surface.type==='overlay'&&surface.deferred){if(!surface.deferralSource)errors.push(surface.id+': overlay deferral source missing');continue;}
  if(surface.requiredKinds&&(!surface.requiredKinds.length||surface.requiredKinds.some(k=>!['desktop','mobile'].includes(k))))errors.push(surface.id+': requiredKinds must name desktop/mobile');
  for(const kind of surface.requiredKinds??['desktop','mobile']){
   const list=(surface.candidates??[]).filter(c=>c.kind===kind);
   if(!list.length)errors.push(surface.id+': '+kind+' independent candidate missing');
   for(const c of list){const registered=record.candidates?.find(e=>e.path===c.path&&e.kind===kind);if(!registered||!local(root,c.path)||hash(path.join(root,c.path))!==registered.sha256)errors.push(surface.id+': candidate missing/stale');
    const owner=used.get(c.path);if(owner&&owner!==surface.id)errors.push(surface.id+': candidate reused from '+owner);used.set(c.path,surface.id);
    if(stage==='prototype'&&!registered?.approval)errors.push(surface.id+': candidate direction not user approved');
   }
   if(stage==='prototype'&&!(surface.actualEvidence??[]).some(e=>e.kind===kind&&local(root,e.path)&&hash(path.join(root,e.path))===e.sha256))errors.push(surface.id+': '+kind+' runnable surface evidence missing');
  }
 }
 return errors;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const arg=k=>process.argv[process.argv.indexOf(k)+1],root=process.cwd(),recordPath=arg('--record'),stage=process.argv.includes('--stage')?arg('--stage'):'candidates';
 if(!process.argv.includes('--record')||!['candidates','prototype'].includes(stage)){console.error('Usage: node scripts/page-surface-design-audit.mjs --record <record.json> --stage candidates|prototype');process.exitCode=1;}else{const errors=auditSurfaceDesign(root,JSON.parse(readFileSync(recordPath,'utf8')),stage);console.log(JSON.stringify({stage,record:recordPath,errors,note:'Inventory completeness requires source walk-through; this does not grant visual approval.'},null,2));if(errors.length)process.exitCode=1;}
}

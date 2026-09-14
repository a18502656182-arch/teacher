import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

// Type-check the new surface against committed dependencies in memory only.
// Never write a second checkout or replace the user's working-tree edits.
const root=process.cwd();
const config=ts.readConfigFile(path.join(root,'tsconfig.json'),ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
const overrides=new Map(['StudentsView.tsx','read-model.ts','useStudentsController.ts'].map(name=>{
 const relative=`app/w/[token]/features/students/${name}`;
 return [path.resolve(root,relative).replaceAll('\\','/'),execFileSync('git',['show',`HEAD:${relative}`],{cwd:root,encoding:'utf8'})];
}));
const host=ts.createCompilerHost(parsed.options);const read=host.readFile;
host.readFile=file=>overrides.get(path.resolve(file).replaceAll('\\','/'))??read(file);
const program=ts.createProgram(parsed.fileNames,{...parsed.options,incremental:false},host);
const diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));process.exitCode=1;}
else console.log('PASS: entire TypeScript graph with three pre-existing student changes virtually replaced by committed HEAD; working files untouched.');

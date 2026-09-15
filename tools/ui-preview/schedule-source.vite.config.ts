import {mergeConfig} from 'vite';import base from './vite.config';
export default mergeConfig(base,{define:{'process.env':'{}'},server:{port:4221},plugins:[{name:'schedule-source-recovery',enforce:'pre',transform(code:string,id:string){if(id.replaceAll('\\','/').endsWith('/app/w/[token]/ClassroomApp.tsx'))return code+'\nexport {MobileSecondaryPage as ScheduleMobileSource};';}}]});

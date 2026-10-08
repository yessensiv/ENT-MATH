import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {sourceExercises} from '../lib/source-exercises.ts';
mkdirSync('.sites-runtime/source-review',{recursive:true});
writeFileSync('.sites-runtime/source-review/legacy-source-keys.json',JSON.stringify(sourceExercises.map(t=>t.source.sha256+':'+t.source.exercise)));
const result=spawnSync('python',['scripts/promote-source-exercises.py'],{stdio:'inherit'});
process.exit(result.status??1);

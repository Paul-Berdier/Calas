import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {configurationProblems,checkServices} from '../apps/web/src/server/config';
import {closeDatabase} from '../apps/web/src/server/db';
try{loadEnvFile(fileURLToPath(new URL('../apps/web/.env',import.meta.url)));}catch{/* CI environment */}
try{
 const problems=configurationProblems();
 for(const label of problems)console.log(`À configurer : ${label}`);
 if(problems.length)process.exitCode=1;
 else if(process.argv.includes('--services')){await checkServices();console.log('Configuration, PostgreSQL et stockage privé joignables. Aucun contenu modifié.');}
 else console.log('Configuration complète. Utiliser --services pour contrôler les connexions.');
}catch{console.error('Services indisponibles ou schéma non migré. Aucun identifiant affiché.');process.exitCode=1;}finally{await closeDatabase();}

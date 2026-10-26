import { runContentCommand } from './content-common.mjs';
runContentCommand('content-backup.ts', ['import', ...process.argv.slice(2)]);

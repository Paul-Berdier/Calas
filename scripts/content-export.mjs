import { runContentCommand } from './content-common.mjs';
runContentCommand('content-backup.ts', ['export', ...process.argv.slice(2)]);

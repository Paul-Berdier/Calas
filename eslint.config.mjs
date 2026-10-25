import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
export default [
  {ignores:['**/dist/**','**/node_modules/**','**/.astro/**','**/.sanity/**','**/.cache/**','**/sanity.generated.ts','apps/studio/public/ocr/**']},
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}}
];

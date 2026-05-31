import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/src', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('src/app.js', 'dist/src/app.js');
await cp('src/styles.css', 'dist/src/styles.css');
await writeFile(
  'dist/src/config.js',
  `window.PPRCLP_CONFIG = ${JSON.stringify({ supabaseUrl, supabaseAnonKey }, null, 2)};\n`,
);

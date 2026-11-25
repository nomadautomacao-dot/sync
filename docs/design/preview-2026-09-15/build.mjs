import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
await build({
  entryPoints: [here + 'preview.tsx'], outfile: here + 'app.js',
  bundle: true, minify: true, sourcemap: false, platform: 'browser',
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
});
console.log('Prévia compilada: ' + here + 'index.html');

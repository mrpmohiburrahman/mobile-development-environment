import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function prepareWebFonts(root) {
  const absoluteRoot = resolve(root);
  const files = await readdir(absoluteRoot, { recursive: true });
  for (const file of files.filter((path) => path.endsWith('.css'))) {
    const path = resolve(absoluteRoot, file);
    const css = await readFile(path, 'utf8');
    const rewritten = css.replace(/url\((['"]?)(\/fonts\/spline-sans\/[^'"\s)]+)\1\)/g, (_, quote, url) => {
      const target = resolve(absoluteRoot, url.slice(1));
      const asset = relative(dirname(path), target).split(sep).join('/');
      return `url("${asset}")`;
    });
    if (rewritten !== css) await writeFile(path, rewritten);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareWebFonts(process.argv[2] ?? 'dist');
}

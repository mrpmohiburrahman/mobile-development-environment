import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function verifyWebExport(root, basePath = '') {
  const absoluteRoot = resolve(root);
  const prefix = basePath.replace(/\/$/, '');
  for (const route of ['index.html', 'ide.html']) {
    if (!(await stat(resolve(absoluteRoot, route))).isFile()) {
      throw new Error(`Missing route: ${route}`);
    }
  }
  const pages = (await readdir(absoluteRoot, { recursive: true })).filter((file) => file.endsWith('.html'));
  const assets = new Set();
  for (const page of pages) {
    const html = await readFile(resolve(absoluteRoot, page), 'utf8');
    if (/<!--\$(?:!|\?)-->/.test(html)) {
      throw new Error(`Incomplete server render: ${page}`);
    }
    if (page === 'ide.html' && !html.includes('id="screen-login"')) {
      throw new Error('The studio export has no screen frames.');
    }
    const origin = 'https://export.invalid';
    const pageUrl = `${origin}${prefix}/${page.split(sep).join('/')}`;
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"[^>]*>/g)) {
      const url = new URL(match[1], pageUrl);
      if (url.origin !== origin) continue;
      if (!url.pathname.startsWith(`${prefix}/`)) {
        throw new Error(`Asset has no base path: ${match[1]}`);
      }
      const asset = resolve(absoluteRoot, decodeURIComponent(url.pathname.slice(prefix.length + 1)));
      const path = relative(absoluteRoot, asset);
      if (path === '..' || path.startsWith(`..${sep}`) || !(await stat(asset)).isFile()) {
        throw new Error(`Missing export asset: ${match[1]}`);
      }
      assets.add(asset);
    }
  }
  return { pages: pages.length, assets: assets.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyWebExport(process.argv[2] ?? 'dist', process.env.EXPO_BASE_URL ?? '');
    console.log(`Verified ${result.pages} pages and ${result.assets} assets.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

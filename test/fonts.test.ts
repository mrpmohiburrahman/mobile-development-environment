import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../mobile/app.json' with { type: 'json' };
import tokens from '../mobile/src/ds/tokens.json' with { type: 'json' };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = resolve(root, 'mobile');
const faces = [
  { weight: 400, file: 'SplineSans_400Regular.ttf' },
  { weight: 600, file: 'SplineSans_600SemiBold.ttf' },
  { weight: 700, file: 'SplineSans_700Bold.ttf' },
];
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

function fontTable(font: Buffer, name: string): Buffer {
  assert.equal(font.readUInt32BE(0), 0x00010000);
  for (let index = 0; index < font.readUInt16BE(4); index++) {
    const entry = 12 + index * 16;
    if (font.toString('ascii', entry, entry + 4) !== name) continue;
    const offset = font.readUInt32BE(entry + 8);
    return font.subarray(offset, offset + font.readUInt32BE(entry + 12));
  }
  assert.fail(`Missing font table: ${name}`);
}

test('native font configuration includes all required weights and the shared family', () => {
  const plugin = config.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-font');
  assert.ok(plugin);
  const options = plugin[1] as {
    android: { fonts: { fontFamily: string; fontDefinitions: { path: string; weight: number; style: string }[] }[] };
    ios: { fonts: string[] };
  };
  assert.equal(tokens.type.family, 'Spline Sans');
  assert.equal(tokens.type.display.weight, '700');
  assert.equal(options.android.fonts.length, 1);
  const family = options.android.fonts[0];
  assert.equal(family.fontFamily, 'Spline Sans');
  assert.deepEqual(family.fontDefinitions.map(({ weight }) => weight), [400, 600, 700]);
  assert.deepEqual(options.ios.fonts, family.fontDefinitions.map(({ path }) => path));
  for (const { weight, path, style } of family.fontDefinitions) {
    assert.equal(style, 'normal');
    const font = readFileSync(resolve(mobile, path));
    assert.equal(fontTable(font, 'OS/2').readUInt16BE(4), weight);
    const names = fontTable(font, 'name');
    const strings = names.readUInt16BE(4);
    const families: string[] = [];
    for (let index = 0; index < names.readUInt16BE(2); index++) {
      const entry = 6 + index * 12;
      const platform = names.readUInt16BE(entry);
      const id = names.readUInt16BE(entry + 6);
      if (![0, 3].includes(platform) || ![1, 16].includes(id)) continue;
      const start = strings + names.readUInt16BE(entry + 10);
      const bytes = Buffer.from(names.subarray(start, start + names.readUInt16BE(entry + 8)));
      families.push(bytes.swap16().toString('utf16le'));
    }
    assert.ok(families.includes('Spline Sans'), `${path}: ${families.join(', ')}`);
  }
});

test('web fonts use bundled files with explicit weights and no installed-font source', () => {
  const css = read('mobile/src/global.css');
  const declarations = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((match) => match[1]);
  assert.equal(declarations.length, 3);
  for (const { weight, file } of faces) {
    const declaration = declarations.find((rule) => rule.includes(file));
    assert.ok(declaration, file);
    assert.match(declaration, /font-family:\s*['"]Spline Sans['"]/);
    assert.match(declaration, new RegExp(`font-weight:\\s*${weight}\\s*;`));
    assert.match(declaration, /font-style:\s*normal/);
    assert.match(declaration, /font-display:\s*block/);
    assert.doesNotMatch(declaration, /local\(|https?:/);
    const url = /url\(['"]([^'"]+)['"]\)/.exec(declaration)?.[1];
    assert.ok(url);
    assert.ok(url.startsWith('/fonts/spline-sans/'));
    assert.ok(readFileSync(resolve(mobile, 'public', url.slice(1))).length > 50000);
  }
  assert.match(css, /font-synthesis:\s*none/);
  assert.match(css, /-webkit-font-smoothing:\s*antialiased/);
  assert.match(css, /-moz-osx-font-smoothing:\s*grayscale/);
  assert.match(css, /text-rendering:\s*optimizeLegibility/);
});

test('font files include the original copyright notice and license', () => {
  const license = read('mobile/public/fonts/spline-sans/OFL.txt');
  assert.match(license, /Copyright 2021 The Spline Sans Project Authors/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(license, /PERMISSION & CONDITIONS/);
  assert.match(license, /DISCLAIMER/);
});

test('each shared native text path uses the family token', () => {
  const source = read('mobile/src/ui/index.tsx');
  const paths = [...source.matchAll(/<RNText\b[^>]*>/g)];
  assert.equal(paths.length, 5);
  for (const [path] of paths) assert.match(path, /fontFamily:\s*t\.type\.family/);
  assert.match(read('mobile/src/ds/store.ts'), /fontFamily:\s*type\.family/);
});

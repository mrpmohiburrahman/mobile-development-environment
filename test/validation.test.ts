// Token value validation, and the claim that the two sides agree.
//
// The server used to write whatever it was handed once the path existed, so a
// malformed hex in `color.light.accent` landed in `tokens.json` and rendered as
// garbage on every screen until someone noticed. The fix exists on both sides —
// the client so a drag gets immediate feedback, the server because it must refuse
// a write from anything that is not this client.
//
// **The rule parameters are shared; the logic is mirrored.** `tokenRules.json` is
// read by both, so a range cannot differ between them. The validation logic is
// written twice — once in TypeScript for the client, once in `tokens.mjs` for a
// Node-stdlib-only server that cannot import a .ts file. That mirror is the one
// thing that could drift, so the largest block of tests here is two functions
// agreeing case for case. If they ever disagree, that test fails before either
// side's behaviour does.
//
// Rules are pinned against the real `tokens.json`, so a token edited upstream into
// an illegal shape fails here on purpose.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../mobile/src/ds/tokens.json' with { type: 'json' };
import {
  validateTokenValue,
  validateBoxShadow,
  isValidTokenValue,
} from '../mobile/src/ds/tokenValidation.ts';
import {
  validateTokenValue as serverValidate,
  validateBoxShadow as serverValidateBoxShadow,
  rules as serverRules,
} from '../token-server/tokens.mjs';
import rules from '../mobile/src/ds/tokenRules.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Every real token in the file is legal. The point of the rules is to protect
// the file, so a file that fails them would mean the rules are wrong.
// ---------------------------------------------------------------------------

const realPaths: string[] = [];
for (const [scheme, group] of Object.entries(tokens.color)) {
  for (const name of Object.keys(group)) realPaths.push(`color.${scheme}.${name}`);
}
for (const family of ['space', 'radius'] as const) {
  for (const name of Object.keys(tokens[family])) realPaths.push(`${family}.${name}`);
}
for (const [role, spec] of Object.entries(tokens.type)) {
  for (const key of Object.keys(spec)) realPaths.push(`type.${role}.${key}`);
}
for (const name of Object.keys(tokens.elevation)) realPaths.push(`elevation.${name}`);

test('every real token in tokens.json passes its own rule', () => {
  const failures: string[] = [];
  for (const path of realPaths) {
    const value = path
      .split('.')
      .reduce<any>((node, key) => node[key], tokens);
    const verdict = validateTokenValue(path, value);
    if (!verdict.ok) failures.push(`${path} = ${JSON.stringify(value)} → ${verdict.error}`);
  }
  assert.deepEqual(failures, []);
});

test('the real tokens.json was actually walked, not silently skipped', () => {
  // A generator that produced nothing would pass the test above vacuously.
  assert.ok(realPaths.length >= 30, `only found ${realPaths.length} token paths`);
  assert.ok(realPaths.includes('color.light.accent'));
  assert.ok(realPaths.includes('elevation.sm'));
  assert.ok(realPaths.includes('type.caption.weight'));
});

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

test('hex colour is accepted in 3, 4, 6 and 8 digit forms', () => {
  // The panel writes 6-digit from <input type=color>, but the file is
  // hand-editable, so the shorthand and alpha forms are legal.
  for (const value of ['#fff', '#FFFF', '#D9481E', '#D9481EFF']) {
    assert.equal(validateTokenValue('color.light.accent', value).ok, true, value);
  }
});

test('a malformed colour is refused with a message that shows the shape', () => {
  for (const value of ['D9481E', '#GGGGGG', '#12345', '', 'rebeccapurple ']) {
    const verdict = validateTokenValue('color.light.accent', value);
    assert.equal(verdict.ok, false, `${JSON.stringify(value)} should be refused`);
    assert.ok(!verdict.ok && verdict.error.includes('#D9481E'), 'the message should show the expected shape');
  }
});

test('rgb() colour is refused, because nothing in this app parses it', () => {
  // tokens.json holds hex everywhere and no component reads a parsed colour, so
  // accepting rgb() would let the file carry a value that renders as garbage.
  assert.equal(validateTokenValue('color.light.accent', 'rgb(217,72,30)').ok, false);
});

test('a number is not a colour', () => {
  assert.equal(validateTokenValue('color.light.accent', 217).ok, false);
});

// ---------------------------------------------------------------------------
// space / radius — including the pill trap
// ---------------------------------------------------------------------------

test('radius.pill is accepted, not refused by accident', () => {
  // This is the reason the radius ceiling is 999. A tighter cap derived from the
  // visible radii (10/16/24) would reject the one value that exists to be huge.
  assert.equal(validateTokenValue('radius.pill', tokens.radius.pill).ok, true);
  assert.equal(validateTokenValue('radius.pill', 999).ok, true);
});

test('a radius above the ceiling is refused', () => {
  assert.equal(validateTokenValue('radius.pill', 1000).ok, false);
});

test('negative space and radius are refused', () => {
  assert.equal(validateTokenValue('space.md', -4).ok, false);
  assert.equal(validateTokenValue('radius.md', -1).ok, false);
});

test('space and radius must be numbers, not numeric strings', () => {
  // A slider sends a number. A string here means something upstream coerced it,
  // and writing "16" into a numeric token is how a scale drifts.
  assert.equal(validateTokenValue('space.md', '16').ok, false);
  assert.equal(validateTokenValue('radius.md', '16').ok, false);
});

test('NaN and Infinity are not numbers worth writing', () => {
  assert.equal(validateTokenValue('space.md', NaN).ok, false);
  assert.equal(validateTokenValue('space.md', Infinity).ok, false);
  assert.equal(validateTokenValue('space.md', -Infinity).ok, false);
});

test('zero space is legal; zero radius is legal', () => {
  assert.equal(validateTokenValue('space.md', 0).ok, true);
  assert.equal(validateTokenValue('radius.sm', 0).ok, true);
});

// ---------------------------------------------------------------------------
// type — and the weight that is a string
// ---------------------------------------------------------------------------

test('type weight is validated as a string, because that is what it is', () => {
  // The brief listed `type.*.weight` alongside the numeric fields. It is not
  // numeric: tokens.json holds "800". Typing it as a number would have made the
  // rules refuse every real weight in the file.
  assert.equal(validateTokenValue('type.title.weight', '800').ok, true);
  assert.equal(validateTokenValue('type.title.weight', '700').ok, true);
  assert.equal(validateTokenValue('type.title.weight', 800).ok, false);
});

test('a font weight outside the multiples of 100 is refused', () => {
  assert.equal(validateTokenValue('type.title.weight', '750').ok, false);
  assert.equal(validateTokenValue('type.title.weight', 'bold').ok, false);
  assert.equal(validateTokenValue('type.title.weight', '1000').ok, false);
});

test('type size, lineHeight and letterSpacing are numbers', () => {
  assert.equal(validateTokenValue('type.title.size', 20).ok, true);
  assert.equal(validateTokenValue('type.title.lineHeight', 26).ok, true);
  assert.equal(validateTokenValue('type.title.letterSpacing', -0.3).ok, true);
  assert.equal(validateTokenValue('type.title.size', '20').ok, false);
});

test('letterSpacing may be negative, because the real scale uses it', () => {
  // display is -0.5 and title is -0.3. A rule that refused negatives would have
  // rejected the committed file.
  assert.equal(validateTokenValue('type.display.letterSpacing', -0.5).ok, true);
});

test('a zero type size is refused, because it renders nothing', () => {
  assert.equal(validateTokenValue('type.title.size', 0).ok, false);
});

test('an unknown type key is refused rather than ignored', () => {
  // Silently accepting a typo'd key is how a token ends up written but unused.
  assert.equal(validateTokenValue('type.title.lineheight', 26).ok, false);
});

test('an unknown family has no rule and is left to the caller', () => {
  // Unknown paths are refused separately, by setPath on the server side. This
  // function declining to invent a rule for an unknown family is deliberate.
  assert.equal(validateTokenValue('whatever.thing', 1).ok, true);
});

// ---------------------------------------------------------------------------
// elevation — a real box-shadow, not a string that looks like one
// ---------------------------------------------------------------------------

test('the real elevation values are accepted', () => {
  for (const [name, value] of Object.entries(tokens.elevation)) {
    assert.equal(validateTokenValue(`elevation.${name}`, value).ok, true, name);
  }
});

test('rgba() commas do not split a layer', () => {
  // Every elevation in tokens.json contains rgba(35,25,20,0.05) — three commas.
  // Splitting naively on "," turns one good layer into four and rejects a
  // perfectly valid shadow. This test is the regression guard for that.
  assert.equal(validateBoxShadow('0px 1px 2px 0px rgba(35,25,20,0.05)').ok, true);
  assert.equal(validateBoxShadow('0px 2px 4px 0px rgba(35,25,20,0.06), 0px 16px 40px 0px rgba(35,25,20,0.13)').ok, true);
});

test('a shadow with too few lengths is refused', () => {
  // A blur alone cannot render a shadow.
  assert.equal(validateBoxShadow('0px').ok, false);
  assert.equal(validateBoxShadow('0px 2px').ok === false, false, 'offset+blur is valid');
  assert.equal(validateBoxShadow('2px solid red').ok, false);
});

test('a bare number without a unit is refused', () => {
  // `0` is the one exception — unitless zero is legal CSS.
  assert.equal(validateBoxShadow('0 2px 4px red').ok, true);
  assert.equal(validateBoxShadow('2 4px 6px red').ok, false);
});

test('inset and hex colours are accepted', () => {
  assert.equal(validateBoxShadow('inset 0px 2px 4px #000000').ok, true);
  assert.equal(validateBoxShadow('0px 2px 4px 0px #00000040').ok, true);
});

test('a non-shadow string is refused', () => {
  assert.equal(validateBoxShadow('hello').ok, false);
  assert.equal(validateBoxShadow('').ok, false);
  assert.equal(validateBoxShadow(42).ok, false);
});

test('an absurdly long shadow is refused rather than written', () => {
  const long = `${'0px 1px 2px 0px #000000, '.repeat(60)}0px 1px 2px #000000`;
  assert.equal(validateBoxShadow(long).ok, false);
});

// ---------------------------------------------------------------------------
// The shared file
// ---------------------------------------------------------------------------

test('both sides read the same rule parameters', () => {
  // The guarantee that makes the mirror safe: not that the logic is shared, but
  // that the ranges and patterns cannot differ.
  assert.deepEqual(serverRules(), rules);
});

test('the rules file holds parameters, not functions', () => {
  // A function here would be unreadable by the server's readFile path, so this
  // fails early rather than at the first write on the server.
  const walk = (node: any): void => {
    for (const v of Object.values(node)) {
      assert.notEqual(typeof v, 'function', 'tokenRules.json must hold data only');
      if (v && typeof v === 'object') walk(v);
    }
  };
  walk(rules);
});

// ---------------------------------------------------------------------------
// The mirror: client and server must agree, case for case
// ---------------------------------------------------------------------------

const CASES: Array<[string, string | number]> = [
  // real values
  ['color.light.accent', '#D9481E'],
  ['color.dark.bg', '#191512'],
  ['color.light.accent', '#fff'],
  ['color.light.accent', '#FFFF'],
  ['color.light.accent', '#D9481EFF'],
  ['space.md', 16],
  ['space.xl', 52],
  ['space.md', 0],
  ['space.md', 512],
  ['radius.pill', 999],
  ['radius.sm', 10],
  ['radius.md', 0],
  ['type.display.size', 32],
  ['type.display.weight', '800'],
  ['type.display.letterSpacing', -0.5],
  ['type.title.lineHeight', 26],
  ['elevation.sm', tokens.elevation.sm],
  ['elevation.md', tokens.elevation.md],
  // malformed
  ['color.light.accent', 'D9481E'],
  ['color.light.accent', '#GGGGGG'],
  ['color.light.accent', '#12345'],
  ['color.light.accent', ''],
  ['color.light.accent', 'rgb(217,72,30)'],
  ['color.light.accent', 217],
  ['color.light.accent', null as any],
  ['color.light.accent', undefined as any],
  ['space.md', -4],
  ['space.md', '16'],
  ['space.md', NaN],
  ['space.md', Infinity],
  ['space.md', -Infinity],
  ['space.md', 513],
  ['radius.pill', 1000],
  ['radius.pill', -1],
  ['type.title.weight', 800],
  ['type.title.weight', '750'],
  ['type.title.weight', 'bold'],
  ['type.title.weight', '1000'],
  ['type.title.weight', ''],
  ['type.title.size', '20'],
  ['type.title.size', 0],
  ['type.title.size', 401],
  ['type.title.lineheight', 26],
  ['elevation.sm', 'hello'],
  ['elevation.sm', ''],
  ['elevation.sm', 42],
  ['elevation.sm', '0px'],
  ['elevation.sm', '2px solid red'],
  ['elevation.sm', '2 4px 6px red'],
  ['elevation.sm', `${'0px 1px 2px #000000, '.repeat(60)}0px 1px 2px #000000`],
  // families with no rule
  ['whatever.thing', 1],
  ['unknownFamily.x', 'anything'],
];

test('client and server agree on every case, verdict and message', () => {
  const disagreements: string[] = [];
  for (const [path, value] of CASES) {
    const client = validateTokenValue(path, value as any);
    const server = serverValidate(path, value);
    if (client.ok !== server.ok) {
      disagreements.push(`${path} = ${JSON.stringify(value)}: client ok=${client.ok}, server ok=${server.ok}`);
    } else if (!client.ok && !server.ok && client.error !== server.error) {
      // Not just the verdict: a different message means one side is explaining
      // the rule differently, which is the drift this whole block watches for.
      disagreements.push(`${path}: message differs\n    client: ${client.error}\n    server: ${server.error}`);
    }
  }
  assert.deepEqual(disagreements, []);
});

test('the mirror cases cover both verdicts, so agreement is not vacuous', () => {
  const accepted = CASES.filter(([p, v]) => validateTokenValue(p, v as any).ok).length;
  const refused = CASES.length - accepted;
  assert.ok(accepted > 10, `only ${accepted} accepted cases`);
  assert.ok(refused > 15, `only ${refused} refused cases`);
});

test('client and server box-shadow validators agree', () => {
  const shadows = [
    '0px 1px 2px 0px rgba(35,25,20,0.05)',
    'inset 0px 2px 4px #000000',
    '0px 2px 4px 0px #00000040',
    '0px',
    '2 4px 6px red',
    'hello',
    '0px 2px 4px 0px rgba(35,25,20,0.06), 0px 16px 40px 0px rgba(35,25,20,0.13)',
  ];
  for (const shadow of shadows) {
    const client = validateBoxShadow(shadow);
    const server = serverValidateBoxShadow(shadow);
    assert.equal(client.ok, server.ok, `${shadow}: ${JSON.stringify(client)} vs ${JSON.stringify(server)}`);
  }
});

test('isValidTokenValue agrees with validateTokenValue', () => {
  for (const [path, value] of CASES) {
    assert.equal(isValidTokenValue(path, value as any), validateTokenValue(path, value as any).ok);
  }
});

test('a refusal explains itself', () => {
  // The caller is a person holding a slider. "not a number" helps; `false` does not.
  const verdict = validateTokenValue('radius.pill', 5000);
  assert.ok(!verdict.ok);
  assert.match(verdict.error, /radius/);
  assert.match(verdict.error, /999/);
});
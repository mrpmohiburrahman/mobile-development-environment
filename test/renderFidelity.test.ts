// What the browser actually rendered, as a verdict.
//
// ## The question this answers
//
// The original talk hedged its visual-regression idea behind a condition:
//
//   "If I have a reasonable confidence that what is displayed here will be what's
//   displayed on mobile, then it's just probably easier to do visual regression
//   testing on web."
//
// So the question was never *should we take screenshots*. It was *do I have that
// confidence*. The condition is checkable, and checking it is cheaper than either
// building a pixel-diff suite or refusing one on taste.
//
// ## The measured answer is no, and the gap is fonts
//
// The display stack names two families ahead of the system fallbacks. On the
// machine this was written on, neither is installed; no `@font-face` is declared
// anywhere in the app; and the type tokens carry no `fontFamily` at all. The stack
// therefore resolves to the system face here, to a different face on a machine
// that has the named family, and to a third on Linux. Three machines, three
// rasters, one committed tree.
//
// That is worse than a font-loading race, which `document.fonts.ready` solves. It
// is font *availability*: a per-machine property, already settled, that waiting
// cannot move. Which is why the answer here is a measurement rather than a
// screenshot suite.
//
// ## Why these assertions are shaped the way they are
//
// A verdict that flatters itself is worse than no verdict, so:
//
//   - an unanswerable candidate reads as **unknown**, never as fine;
//   - a candidate the studio could not measure at all is a distinct state from
//     one it measured and found absent;
//   - every browser-gathered number arrives with a count, and zero never renders
//     as "nothing found" — a sound decision function fed nothing by a broken
//     reader is a defect this codebase has already shipped once.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFontStack,
  judgeCandidates,
  fontVerdictCopy,
  typeVerdictCopy,
  verifyTypeTokens,
  REFERENCES,
  isKeyword,
  type CandidateProbe,
  type TypeRoleToken,
} from '../mobile/src/ide/renderFidelity.ts';

const DISPLAY = 'Spline Sans, Inter, ui-sans-serif, system-ui, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji';

/**
 * What each reference renders on its own. A candidate that fell through to a
 * fallback renders exactly this, which is what turns "the widths match each
 * other" into "the widths match the fallback".
 */
const REFS = { monospace: 42, serif: 99 };

/** A candidate that rendered itself: the same face whichever fallback followed. */
const found = (family: string): CandidateProbe => ({
  family,
  widths: { monospace: 300, serif: 300 },
  referenceWidths: REFS,
});

/**
 * A candidate that fell through: each fallback showed through, so the widths are
 * the references' own and differ from each other.
 */
const fellThrough = (family: string): CandidateProbe => ({
  family,
  widths: { monospace: REFS.monospace, serif: REFS.serif },
  referenceWidths: REFS,
});

test('the stack splits on top-level commas only', () => {
  // A naive `split(',')` would shred `Noto Color Emoji` into two candidates and
  // then report a verdict about a family nobody asked about.
  const stack = parseFontStack(DISPLAY);
  assert.equal(stack[0], 'Spline Sans');
  assert.equal(stack[1], 'Inter');
  assert.ok(stack.includes('Apple Color Emoji'), 'a multi-word family stays one entry');
  assert.ok(stack.includes('Noto Color Emoji'));
  assert.equal(stack.length, 9);
});

test('quoted family names lose their quotes and keep their spaces', () => {
  assert.deepEqual(parseFontStack("'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, sans-serif"), [
    'SF Pro Rounded',
    'Hiragino Maru Gothic ProN',
    'Meiryo',
    'sans-serif',
  ]);
});

test('a candidate is present only when it renders itself, not the fallback', () => {
  // One reference is not enough. A family that happened to match `serif` exactly
  // would be called absent on the strength of a coincidence, which is the kind of
  // confident wrong this pass exists to stop making.
  const judged = judgeCandidates(parseFontStack(DISPLAY), [
    found('Spline Sans'),
    found('Inter'),
    fellThrough('Segoe UI Symbol'),
  ]);

  const byName = Object.fromEntries(judged.map((c) => [c.family, c.fate]));
  assert.equal(byName['Spline Sans'], 'present');
  assert.equal(byName.Inter, 'present');
  assert.equal(byName['Segoe UI Symbol'], 'fell-through');
});

test('a candidate that matched exactly one reference is unknown, never fine', () => {
  const judged = judgeCandidates(parseFontStack(DISPLAY), [
    { family: 'Spline Sans', widths: { monospace: 42, serif: 55 }, referenceWidths: REFS },
  ]);

  assert.equal(judged.find((c) => c.family === 'Spline Sans')?.fate, 'unknown');
});

test('a candidate the studio could not measure at all is unmeasured, not absent', () => {
  // Zero is a distinct state from "nothing found". A candidate with no probe
  // result has not been looked for.
  const judged = judgeCandidates(parseFontStack('Spline Sans, Inter'), [
    { family: 'Spline Sans', widths: { monospace: 300, serif: 301 } },
  ]);

  const inter = judged.find((c) => c.family === 'Inter');
  assert.equal(inter?.fate, 'unmeasured');
  assert.notEqual(inter?.fate, 'fell-through', 'an absent probe is not evidence of absence');
});

test('a probe with no reference widths is unknown, never judged against invented ones', () => {
  // The regression this replaces. `judge` used to fall back on a hard-coded
  // `{ monospace: 42, serif: 99 }` when the reader sent no reference widths, so a
  // browser whose real references differ from those two numbers would have a family
  // compared against widths that were made up — and "equal to none of them" reads
  // as `present`. That is this module's own rule ("an unanswerable candidate reads
  // as unknown or unmeasured, never as fine") broken in the one place it matters,
  // by the fallback that was supposed to be harmless.
  const widths = { monospace: 42, serif: 99 };

  // Widths that *equal* the old invented table: the case that used to be called
  // fell-through on the strength of a coincidence with a constant.
  assert.equal(
    judgeCandidates(parseFontStack('Spline Sans'), [{ family: 'Spline Sans', widths }])[0].fate,
    'unknown',
  );
  // And widths that differ from everything: the case that used to be called present.
  assert.equal(
    judgeCandidates(parseFontStack('Spline Sans'), [
      { family: 'Spline Sans', widths: { monospace: 300, serif: 301 } },
    ])[0].fate,
    'unknown',
  );
  // A partial reference table is as unanswerable as no table at all.
  assert.equal(
    judgeCandidates(parseFontStack('Spline Sans'), [
      { family: 'Spline Sans', widths: { monospace: 42, serif: 55 }, referenceWidths: { monospace: 42 } },
    ])[0].fate,
    'unknown',
  );

  // With real reference widths the same numbers decide properly, so the guard is
  // not simply refusing to answer everything.
  assert.equal(
    judgeCandidates(parseFontStack('Spline Sans'), [
      { family: 'Spline Sans', widths: { monospace: 300, serif: 301 }, referenceWidths: REFS },
    ])[0].fate,
    'present',
  );
});

test('generic keywords are named as keywords, not probed as families', () => {
  // `system-ui` is not an installable family: it names "whatever the platform
  // uses". Probing it produces a number that looks like a measurement of
  // something it cannot measure.
  assert.equal(isKeyword('system-ui'), true);
  assert.equal(isKeyword('ui-sans-serif'), true);
  assert.equal(isKeyword('sans-serif'), true);
  assert.equal(isKeyword('monospace'), true);
  assert.equal(isKeyword('Inter'), false);
  assert.equal(isKeyword('Spline Sans'), false);

  const judged = judgeCandidates(parseFontStack(DISPLAY), []);
  assert.equal(judged.find((c) => c.family === 'system-ui')?.fate, 'keyword');
  assert.equal(judged.find((c) => c.family === 'Spline Sans')?.fate, 'unmeasured');
});

test('the verdict names every candidate in the stack, and its fate', () => {
  const judged = judgeCandidates(parseFontStack(DISPLAY), [
    fellThrough('Spline Sans'),
    fellThrough('Inter'),
  ]);

  assert.deepEqual(judged.map((c) => c.family), parseFontStack(DISPLAY));
  assert.ok(judged.every((c) => c.fate !== undefined));
});

test('the winner is the first family that is really there', () => {
  const judged = judgeCandidates(parseFontStack(DISPLAY), [
    fellThrough('Spline Sans'),
    found('Inter'),
  ]);

  assert.equal(judged.find((c) => c.winner)?.family, 'Inter');
});

test('when no named family is present the winner is a keyword, and it says so', () => {
  // Today's answer on this machine. The report has to name what actually rendered
  // rather than leave the reader to infer it from two absences.
  const judged = judgeCandidates(parseFontStack(DISPLAY), [
    fellThrough('Spline Sans'),
    fellThrough('Inter'),
  ]);

  const winner = judged.find((c) => c.winner);
  assert.equal(winner?.family, 'ui-sans-serif');
  assert.equal(winner?.fate, 'keyword');
});

test('with nothing measured at all there is no winner', () => {
  // The zero-count rule. A verdict with a winner and no measurements would be the
  // most confident possible lie.
  const judged = judgeCandidates(parseFontStack('A, B'), []);
  assert.equal(judged.find((c) => c.winner), undefined);
  assert.equal(judged.every((c) => c.fate === 'unmeasured'), true);
});

test('the font copy never claims confidence it does not have', () => {
  const honest = fontVerdictCopy(
    judgeCandidates(parseFontStack(DISPLAY), [fellThrough('Spline Sans'), fellThrough('Inter')]),
  );
  assert.equal(honest.answered, true);
  assert.notEqual(honest.tone, 'ok', 'nothing named is available, so this is not a clean bill of health');
  assert.match(honest.label, /not installed/i);

  const blind = fontVerdictCopy(judgeCandidates(parseFontStack('A, B'), []));
  assert.equal(blind.answered, false);
  assert.match(blind.label, /not measured/i);
  assert.notEqual(blind.label, honest.label);
  assert.notEqual(blind.detail, honest.detail);
});

test('a named family winning is the headline, because the repo never shipped it', () => {
  // The measured answer on this machine. The map predicted both named families
  // would be absent and was half right: `Spline Sans` is absent, and `Inter`
  // resolves — to a face that came from somewhere the repository does not control,
  // since nothing here declares a font face and `type.*` carries no font family.
  //
  // So the verdict leads with the winner, not with the absence. "Spline Sans is
  // missing" would have been a true statement that buried the finding.
  const copy = fontVerdictCopy(
    judgeCandidates(parseFontStack(DISPLAY), [fellThrough('Spline Sans'), found('Inter')]),
  );

  assert.match(copy.label, /renders in Inter/);
  assert.match(copy.label, /does not ship/);
  assert.notEqual(copy.tone, 'ok', 'a face the commit does not ship is still machine-dependent');
  assert.match(copy.detail, /not part of the font bundle/i);
  assert.match(copy.detail, /Spline Sans is absent|1 of 6 named families/);
});

test('when nothing named resolves, the copy names the platform face instead', () => {
  const copy = fontVerdictCopy(
    judgeCandidates(parseFontStack(DISPLAY), [fellThrough('Spline Sans'), fellThrough('Inter')]),
  );
  assert.match(copy.label, /ui-sans-serif/);
  assert.match(copy.label, /not installed/i);
  assert.notEqual(copy.tone, 'ok');
});

test('the copy names how many candidates were actually measured', () => {
  const copy = fontVerdictCopy(
    judgeCandidates(parseFontStack(DISPLAY), [fellThrough('Spline Sans'), fellThrough('Inter')]),
  );
  assert.equal(copy.measured, 2);
  assert.equal(copy.total, 9);
});

test('a winner sitting behind an unresolved family is called provisional', () => {
  // A cascade draws the first family it has, so the first family the studio could
  // *judge* is not necessarily the one that drew the glyphs. Observed on a cold
  // load: an inconclusive measurement of `Inter` promoted `Apple Color Emoji` —
  // sixth in the stack — and the badge named it with total confidence. The rule
  // this module exists to hold is that an unanswerable candidate never reads as
  // fine, and quietly promoting a later family over one is the same break wearing
  // a confident label.
  const inconclusive = (family: string): CandidateProbe => ({
    family,
    // Matches one reference and not the other: a coincidence the studio declines to
    // read either way.
    widths: { monospace: REFS.monospace, serif: 300 },
    referenceWidths: REFS,
  });

  const copy = fontVerdictCopy(
    judgeCandidates(parseFontStack(DISPLAY), [fellThrough('Spline Sans'), inconclusive('Inter'), found('Apple Color Emoji')]),
  );

  assert.match(copy.label, /renders in Apple Color Emoji/);
  assert.match(copy.label, /provisional/, 'the label has to say the answer is not settled');
  assert.match(copy.detail, /Inter sits ahead of it/, 'and name the family that could not be resolved');
  assert.match(copy.detail, /could not be resolved/);

  // The settled case still reads as settled, so the caveat is not decoration.
  const settled = fontVerdictCopy(
    judgeCandidates(parseFontStack(DISPLAY), [fellThrough('Spline Sans'), found('Inter')]),
  );
  assert.doesNotMatch(settled.label, /provisional/);
  assert.doesNotMatch(settled.detail, /sits ahead|sit ahead/);
});

// -- The type tokens, checked against what the screens really render. ----------

const roles: Record<string, TypeRoleToken> = {
  body: { size: 16, weight: '400', lineHeight: 24, letterSpacing: 0 },
  title: { size: 20, weight: '700', lineHeight: 26, letterSpacing: -0.3 },
};

const rendered = (over: Partial<Record<string, string>> = {}) => ({
  fontSize: '16px',
  lineHeight: '24px',
  letterSpacing: '0px',
  fontWeight: '400',
  ...over,
});

test('a failed font weight prevents a successful bundled-font verdict', () => {
  const candidates = judgeCandidates(parseFontStack(DISPLAY), [found('Spline Sans')]);
  const copy = fontVerdictCopy(candidates, [600, 700]);
  assert.equal(copy.tone, 'degraded');
  assert.match(copy.label, /600, 700/);
  assert.match(copy.detail, /failed to load/);
});

test('a measured bundled family does not claim native font verification', () => {
  const copy = fontVerdictCopy(judgeCandidates(parseFontStack(DISPLAY), [found('Spline Sans')]));
  assert.equal(copy.tone, 'ok');
  assert.equal(copy.answered, true);
  assert.match(copy.label, /bundled Spline Sans/);
  assert.doesNotMatch(copy.label, /does not ship/);
  assert.match(copy.detail, /does not prove native/);
});

test('a role whose values all agree is verified, with the sample size beside it', () => {
  const report = verifyTypeTokens(roles, [
    { screen: 'index', style: rendered() },
    { screen: 'habits', style: rendered() },
  ]);

  const body = report.roles.find((r) => r.role === 'body');
  assert.equal(body?.verdict, 'verified');
  assert.equal(body?.nodes, 2);
  assert.equal(body?.agreeing, 2);
  assert.deepEqual(body?.overrides, []);

  // The sample size sits next to the claim, so "everything matches" is never a
  // claim about nothing.
  assert.equal(report.screensVerified, 2);
  assert.equal(report.measured, true);
});

test('a type token that fails to reach a screen is caught', () => {
  // The negative control. Nothing on the board renders `type.title` at 20px, so
  // the token did not land. Reporting "all verified" here would be a clean bill of
  // health on a broken render.
  const report = verifyTypeTokens(roles, [{ screen: 'index', style: rendered() }]);

  const title = report.roles.find((r) => r.role === 'title');
  assert.equal(title?.verdict, 'unreached');
  assert.equal(title?.nodes, 0);
});

test('a rendered value that disagrees with its token is named, not rounded away', () => {
  const report = verifyTypeTokens(roles, [
    { screen: 'index', style: rendered({ lineHeight: '28px' }) },
  ]);

  const body = report.roles.find((r) => r.role === 'body');
  assert.equal(body?.verdict, 'mismatch');
  assert.deepEqual(body?.overrides, [
    { property: 'lineHeight', expected: '24px', found: '28px', nodes: 1 },
  ]);
});

test('a role that reaches some nodes and is overridden on others says both', () => {
  // The real board: `type.label` is 13/600, and the app's uppercase section
  // headings are also 13/600 with a letter spacing the token does not describe.
  // Calling that a failure would be overclaiming — the token *did* reach the
  // screen, and the app overrode part of it on purpose. Calling it a pass would
  // hide a real observation. So it gets its own verdict and both counts.
  const report = verifyTypeTokens(
    { label: { size: 13, weight: '600', lineHeight: 18, letterSpacing: 0.2 } },
    [
      { screen: 'index', style: rendered({ fontSize: '13px', fontWeight: '600', lineHeight: '18px', letterSpacing: '0.2px' }) },
      { screen: 'habits', style: rendered({ fontSize: '13px', fontWeight: '600', lineHeight: '18px', letterSpacing: '1.2px' }) },
    ],
  );

  const label = report.roles[0];
  assert.equal(label.verdict, 'overridden');
  assert.equal(label.agreeing, 1);
  assert.equal(label.nodes, 2);
  assert.deepEqual(label.overrides, [
    { property: 'letterSpacing', expected: '0.2px', found: '1.2px', nodes: 1 },
  ]);
});

test('an overridden role is not counted as reaching nothing', () => {
  const report = verifyTypeTokens(
    { label: { size: 13, weight: '600', lineHeight: 18, letterSpacing: 0.2 } },
    [
      { screen: 'index', style: rendered({ fontSize: '13px', fontWeight: '600', lineHeight: '18px', letterSpacing: '0.2px' }) },
      { screen: 'index', style: rendered({ fontSize: '13px', fontWeight: '600', lineHeight: '18px', letterSpacing: '1.2px' }) },
    ],
  );
  // Two, not four: size and weight found the node, line height and letter spacing
  // were compared against the token. Counting the attribution keys would print a
  // sample size twice the measurement behind it.
  assert.equal(report.propertiesVerified, 2, 'the role was checked; it is not skipped');
});

test('the browser font-weight vocabulary is folded back to the file', () => {
  // getComputedStyle resolves 400 to `normal` and 700 to `bold`; the token file
  // holds the numbers. Comparing the strings directly would report every bold
  // heading in the app as wrong.
  const report = verifyTypeTokens(roles, [
    {
      screen: 'index',
      style: rendered({ fontSize: '20px', fontWeight: 'bold', lineHeight: '26px', letterSpacing: '-0.3px' }),
    },
  ]);

  assert.equal(report.roles.find((r) => r.role === 'title')?.verdict, 'verified');
});

test('a node sharing a role’s size but not its weight is not that role', () => {
  // The real board says size is not a key: `type.caption.size` is 12 and the tab
  // strip also renders 12 at a different weight. Attributing by size alone swept
  // six unrelated nodes into the caption role and then reported them as caption
  // drift — a sound decision fed ambiguous facts, printing a confident wrong.
  const report = verifyTypeTokens(
    { caption: { size: 12, weight: '400', lineHeight: 16, letterSpacing: 0.1 } },
    [
      { screen: 'index', style: rendered({ fontSize: '12px', fontWeight: '400', lineHeight: '16px', letterSpacing: '0.1px' }) },
      { screen: 'index', style: rendered({ fontSize: '12px', fontWeight: '600', lineHeight: '16px', letterSpacing: 'normal' }) },
    ],
  );

  assert.equal(report.roles[0].verdict, 'verified');
  assert.equal(report.roles[0].nodes, 1, 'only the node that carries the role counts');
});

test('a size nobody carries the weight for is unowned, not verified', () => {
  // Something is using the size and nothing is using the role. Reporting a pass
  // would clear a token the board never showed; reporting a failure would invent
  // one. So it reports neither.
  //
  // Named `unowned` rather than `unattributed`, which the press verdicts already
  // use for a different fact — a later press in a task that was not credited with
  // the change. Two meanings sharing one word in one diff is how a reader comes to
  // believe a report says something it does not.
  const report = verifyTypeTokens(
    { caption: { size: 12, weight: '400', lineHeight: 16, letterSpacing: 0.1 } },
    [{ screen: 'index', style: rendered({ fontSize: '12px', fontWeight: '700' }) }],
  );

  assert.equal(report.roles[0].verdict, 'unowned');
  assert.equal(report.propertiesVerified, 0, 'an unclaimed role verified no properties');
});

test('letter-spacing of normal is read as zero, which is what it means', () => {
  // Chromium answers `normal` for a zero letter-spacing. Comparing the strings
  // directly reported 28 nodes as caption drift that did not exist.
  const report = verifyTypeTokens(
    { body: { size: 16, weight: '400', lineHeight: 24, letterSpacing: 0 } },
    [{ screen: 'index', style: rendered({ letterSpacing: 'normal' }) }],
  );

  assert.equal(report.roles[0].verdict, 'verified');
});

test('line-height of normal is not folded in, because it is not the token’s value', () => {
  // `normal` for letter-spacing means zero and folding it in is a definition.
  // `normal` for line-height means the property is unset, which is not the same as
  // rendering at the token's line height — and saying so is the finding.
  const report = verifyTypeTokens(
    { body: { size: 16, weight: '400', lineHeight: 24, letterSpacing: 0 } },
    [{ screen: 'index', style: rendered({ lineHeight: 'normal' }) }],
  );

  assert.equal(report.roles[0].verdict, 'mismatch');
  assert.deepEqual(report.roles[0].overrides, [
    { property: 'lineHeight', expected: '24px', found: 'normal', nodes: 1 },
  ]);
});

test('with no screens read at all the report is unmeasured, not verified', () => {
  const report = verifyTypeTokens(roles, []);

  assert.equal(report.measured, false);
  assert.equal(report.screensVerified, 0);
  assert.ok(report.roles.every((r) => r.verdict === 'unread'), 'nothing was read, so nothing is claimed');
  assert.equal(report.propertiesVerified, 0);
});

test('the properties verified are counted, not assumed', () => {
  const report = verifyTypeTokens(roles, [
    { screen: 'index', style: rendered() },
    { screen: 'habits', style: rendered() },
    { screen: 'habit', style: rendered({ fontSize: '20px', fontWeight: '700', lineHeight: '26px', letterSpacing: '-0.3px' }) },
  ]);

  // Two roles matched at least one node, and two properties were compared for each.
  // Size and weight are how a node is attributed to a role, so they are not
  // verifications — counting them would double the sample size on paper.
  assert.equal(report.propertiesVerified, 4);
  // Three screens contributed a node, which is the sample size behind the claim.
  assert.equal(report.screensVerified, 3);
});

test('letter-spacing is compared as a length, not as a string', () => {
  const report = verifyTypeTokens(
    { title: { size: 20, weight: '700', lineHeight: 26, letterSpacing: -0.3 } },
    [{ screen: 'index', style: rendered({ fontSize: '20px', fontWeight: '700', lineHeight: '26px', letterSpacing: '-0.3px' }) }],
  );
  assert.equal(report.roles[0].verdict, 'verified');
});

test('a role added to the tokens without a screen is reported, not skipped', () => {
  const report = verifyTypeTokens(
    { ...roles, ghost: { size: 99, weight: '400', lineHeight: 120, letterSpacing: 0 } },
    [{ screen: 'index', style: rendered() }],
  );

  assert.deepEqual(report.roles.map((r) => r.role).sort(), ['body', 'ghost', 'title']);
  assert.equal(report.roles.find((r) => r.role === 'ghost')?.verdict, 'unreached');
});

// ---------------------------------------------------------------------------
// The verdict sentence, as the badge prints it
// ---------------------------------------------------------------------------

test('every answered type verdict carries its sample size', () => {
  // Ticket 06: "The report states how many screens and how many properties were
  // verified, so the sample size sits next to the claim." Worth least exactly where
  // a report looks most settled, so it is appended to every answered branch rather
  // than to the clean one. The real board lands in `overridden`, which is the
  // branch that used to print a verdict and no sample size at all.
  const observed = [
    { screen: 'index', style: rendered({ fontSize: '13px', fontWeight: '600', lineHeight: '18px', letterSpacing: '0.2px' }) },
    { screen: 'index', style: rendered({ fontSize: '13px', fontWeight: '600', lineHeight: '18px', letterSpacing: '1.2px' }) },
    { screen: 'habits', style: rendered() },
  ];

  const cases: [string, ReturnType<typeof verifyTypeTokens>, boolean][] = [
    ['overridden', verifyTypeTokens({ label: { size: 13, weight: '600', lineHeight: 18, letterSpacing: 0.2 } }, observed), true],
    ['mismatch', verifyTypeTokens({ body: { size: 16, weight: '400', lineHeight: 99, letterSpacing: 0 } }, [{ screen: 'index', style: rendered() }]), true],
    ['unreached', verifyTypeTokens({ ghost: { size: 99, weight: '400', lineHeight: 120, letterSpacing: 0 } }, [{ screen: 'index', style: rendered() }]), true],
    ['verified', verifyTypeTokens({ body: { size: 16, weight: '400', lineHeight: 24, letterSpacing: 0 } }, [{ screen: 'index', style: rendered() }]), true],
    ['unread', verifyTypeTokens(roles, []), false],
  ];

  for (const [name, report, measured] of cases) {
    const copy = typeVerdictCopy(report, measured);
    if (name === 'unread') {
      assert.match(copy.label, /not measured/i, 'an unread board says so');
      assert.doesNotMatch(copy.detail, /properties compared/, 'an unread board claims no sample');
      continue;
    }
    assert.match(copy.detail, /\d+ properties compared/, `${name} printed a verdict with no sample size`);
    assert.match(copy.detail, /lineHeight and letterSpacing/, `${name} did not say which properties were compared`);
    // The attribution keys are named as what they are, so the count cannot be read
    // as four properties checked per role.
    assert.match(copy.detail, /found the nodes/, `${name} did not say what size and weight were used for`);
  }
});

test('the type verdict is not a string-typed tone the badge has to cast', () => {
  // `TONE[type.tone as keyof typeof TONE]` was a cast over a tone the function
  // typed as `string`, which is how a fourth tone would have reached the palette
  // lookup and printed `undefined` as a colour.
  const copy = typeVerdictCopy(verifyTypeTokens(roles, [{ screen: 'index', style: rendered() }]), true);
  assert.ok(['ok', 'degraded', 'muted'].includes(copy.tone), `unexpected tone ${copy.tone}`);
});
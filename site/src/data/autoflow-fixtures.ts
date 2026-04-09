// Autoflow rule fixtures — same files used by test/autoflow-fixtures.test.js.
// This is the SINGLE SOURCE OF TRUTH: each .deck.md is read by the test runner
// AND embedded in the docs page for that rule. Break the fixture in the engine
// and both the test AND the doc page stop working at the same time.

import skipChecks from '../../../test/autoflow-fixtures/00-skip-checks.deck.md?raw';
import title from '../../../test/autoflow-fixtures/01-title.deck.md?raw';
import divider from '../../../test/autoflow-fixtures/02-divider.deck.md?raw';
import diagonal from '../../../test/autoflow-fixtures/03-diagonal.deck.md?raw';
import zPattern from '../../../test/autoflow-fixtures/04-z-pattern.deck.md?raw';
import alternating from '../../../test/autoflow-fixtures/05-alternating.deck.md?raw';
import statement from '../../../test/autoflow-fixtures/06-statement.deck.md?raw';
import bareImageRotate from '../../../test/autoflow-fixtures/07-bare-image-rotate.deck.md?raw';
import autoscale from '../../../test/autoflow-fixtures/08-autoscale.deck.md?raw';

export interface AutoflowFixture {
  rule: string;
  title: string;
  priority: number;
  description: string;
  md: string;
}

export const autoflowFixtures: Record<string, AutoflowFixture> = {
  'skip-checks': {
    rule: 'skip-checks',
    title: 'Skip checks',
    priority: 0,
    description: 'When autoflow does NOTHING — explicit directives, code, custom blocks.',
    md: skipChecks,
  },
  title: {
    rule: 'title',
    title: 'Title',
    priority: 10,
    description: 'First slide gets a centered #[fit] title with subtitle below.',
    md: title,
  },
  divider: {
    rule: 'divider',
    title: 'Divider',
    priority: 20,
    description: 'A 1-2 word slide becomes a giant section break.',
    md: divider,
  },
  diagonal: {
    rule: 'diagonal',
    title: 'Diagonal',
    priority: 30,
    description: 'Two short paragraphs (one ending in ?) get pulled across the slide.',
    md: diagonal,
  },
  'z-pattern': {
    rule: 'z-pattern',
    title: 'Z-Pattern',
    priority: 40,
    description: 'Four short paragraphs land at the four corners of the slide.',
    md: zPattern,
  },
  alternating: {
    rule: 'alternating',
    title: 'Alternating colors',
    priority: 50,
    description: '3+ short paragraphs alternate between heading color and accent.',
    md: alternating,
  },
  statement: {
    rule: 'statement',
    title: 'Statement',
    priority: 60,
    description: '1-4 short lines (≤8 words each) get the #[fit] treatment.',
    md: statement,
  },
  'bare-image-rotate': {
    rule: 'bare-image-rotate',
    title: 'Bare image rotate (history-based)',
    priority: 70,
    description: 'A bare ![](src) rotates position across the deck: inline → left → right → ...',
    md: bareImageRotate,
  },
  autoscale: {
    rule: 'autoscale',
    title: 'Autoscale (safety net)',
    priority: 80,
    description: 'Long slides (9+ lines OR 80+ words) shrink to fit.',
    md: autoscale,
  },
};

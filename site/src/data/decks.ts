import gettingStarted from '../../../demo/getting-started.md?raw';
import kitchenSink from '../../../demo/kitchen-sink.md?raw';
import autoflow from '../../../demo/autoflow.md?raw';
import beanToBar from '../../../demo/bean-to-bar-chocolate.md?raw';
import handBalancing from '../../../demo/hand-balancing.md?raw';
import vibeCoding from '../../../demo/vibe-coding.md?raw';

export interface Deck {
  title: string;
  description: string;
  category: 'learn' | 'real';
  slug: string;
  md: string;
}

export const decks: Record<string, Deck> = {
  'getting-started': {
    title: 'Getting Started',
    description: 'Learn the basics: headings, images, splits, code blocks, and speaker notes.',
    category: 'learn',
    slug: 'getting-started',
    md: gettingStarted,
  },
  'kitchen-sink': {
    title: 'Kitchen Sink',
    description: 'Every supported feature in one deck: columns, diagrams, math, QR, alternating colors.',
    category: 'learn',
    slug: 'kitchen-sink',
    md: kitchenSink,
  },
  'autoflow': {
    title: 'Autoflow',
    description: 'Zero-config layout inference. Plain markdown in, designed slides out.',
    category: 'learn',
    slug: 'autoflow',
    md: autoflow,
  },
  'bean-to-bar': {
    title: 'Bean to Bar Chocolate',
    description: 'Craft chocolate movement — diagrams, columns, custom backgrounds.',
    category: 'real',
    slug: 'bean-to-bar',
    md: beanToBar,
  },
  'hand-balancing': {
    title: 'Hand Balancing',
    description: 'Training discipline showcase — split layouts with coach portraits.',
    category: 'real',
    slug: 'hand-balancing',
    md: handBalancing,
  },
  'vibe-coding': {
    title: 'Vibe Coding',
    description: 'AI-assisted coding and the new developer — a real keynote.',
    category: 'real',
    slug: 'vibe-coding',
    md: vibeCoding,
  },
};

export const learnDecks = Object.values(decks).filter(d => d.category === 'learn');
export const realDecks = Object.values(decks).filter(d => d.category === 'real');

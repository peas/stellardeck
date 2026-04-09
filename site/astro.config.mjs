// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://stellardeck.dev',
  integrations: [
    starlight({
      title: 'StellarDeck',
      logo: {
        src: './src/assets/logo.svg',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/peas/stellardeck' },
      ],
      editLink: {
        baseUrl: 'https://github.com/peas/stellardeck/edit/main/site/',
      },
      sidebar: [
        {
          label: 'Guide',
          items: [
            { label: 'Getting Started', slug: 'guide/getting-started' },
            { label: 'Images & Layouts', slug: 'guide/images-layouts' },
            { label: 'Code, Math & Diagrams', slug: 'guide/code-math-diagrams' },
            { label: 'Autoflow', slug: 'guide/autoflow' },
            {
              label: 'Autoflow Rules',
              collapsed: true,
              items: [
                { label: 'Overview', slug: 'guide/autoflow-rules' },
                { label: 'Skip checks', slug: 'guide/autoflow-rules/skip-checks' },
                { label: 'Title', slug: 'guide/autoflow-rules/title' },
                { label: 'Divider', slug: 'guide/autoflow-rules/divider' },
                { label: 'Diagonal', slug: 'guide/autoflow-rules/diagonal' },
                { label: 'Z-Pattern', slug: 'guide/autoflow-rules/z-pattern' },
                { label: 'Alternating colors', slug: 'guide/autoflow-rules/alternating' },
                { label: 'Statement', slug: 'guide/autoflow-rules/statement' },
                { label: 'Bare image position variation', slug: 'guide/autoflow-rules/bare-image-position-variation' },
                { label: 'Phrase + bullets palette', slug: 'guide/autoflow-rules/phrase-bullets' },
                { label: 'Autoscale', slug: 'guide/autoflow-rules/autoscale' },
              ],
            },
            { label: 'Themes & Colors', slug: 'guide/themes-colors' },
            { label: 'Embedding Presentations', slug: 'guide/embedding' },
            { label: 'PDF Export', slug: 'guide/pdf-export' },
            { label: 'Command Line', slug: 'guide/cli' },
            { label: 'Claude Code Skill', slug: 'guide/skill' },
          ],
        },
        {
          label: 'Examples',
          items: [
            { label: 'Bean to Bar Chocolate', slug: 'examples/bean-to-bar' },
            { label: 'Hand Balancing', slug: 'examples/hand-balancing' },
            { label: 'Vibe Coding', slug: 'examples/vibe-coding' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
      credits: true,
      pagefind: false,
      head: [
        {
          tag: 'link',
          attrs: { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        },
      ],
    }),
  ],
});

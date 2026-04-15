/**
 * Theme metadata for documentation pages.
 * Source of truth: constants.js THEMES object.
 * Update this file when adding/removing themes.
 */
export interface ThemeInfo {
  slug: string;
  label: string;
  fonts: string;
  style: string;
  schemeCount: number;
}

export const themes: ThemeInfo[] = [
  { slug: 'nordic',              label: 'Nordic',              fonts: 'Poppins + Lato',          style: 'Dark, clean',                schemeCount: 5 },
  { slug: 'letters-from-brazil', label: 'Letters from Brazil', fonts: 'Saira Condensed',         style: 'Warm tan, editorial',        schemeCount: 7 },
  { slug: 'serif',               label: 'Serif',               fonts: 'Playfair Display',        style: 'Classic light serif',        schemeCount: 4 },
  { slug: 'minimal',             label: 'Minimal',             fonts: 'System fonts',            style: 'Light, no distractions',     schemeCount: 4 },
  { slug: 'hacker',              label: 'Hacker',              fonts: 'JetBrains Mono',          style: 'Green-on-black terminal',    schemeCount: 4 },
  { slug: 'poster',              label: 'Poster',              fonts: 'Bebas Neue',              style: 'Bold geometric, large type', schemeCount: 4 },
  { slug: 'alun',                label: 'Alun',                fonts: 'FK Grotesk',              style: 'Grupo Alun brand',           schemeCount: 5 },
  { slug: 'borneli',             label: 'Borneli',             fonts: 'DM Sans',                 style: 'StartSe brand',              schemeCount: 5 },
  { slug: 'keynote',             label: 'Keynote',             fonts: 'Montserrat + Raleway',    style: 'Gradient backgrounds',       schemeCount: 5 },
];

// Type definitions for @stellardeck/core
//
// These are hand-written to match the runtime API of src/index.js (CJS)
// and src/index.mjs (ESM barrel). Update them whenever a public export
// is added/renamed/removed — the test/core-api-surface.test.js contract
// test will catch the runtime drift, but TypeScript consumers won't see
// it until these are updated.

// ──────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────

export interface CDNUrls {
  HTML2CANVAS: string;
  PDFLIB: string;
  HLJS: string;
  HLJS_THEME: string;
  KATEX: string;
  KATEX_CSS: string;
  MERMAID: string;
  QRCODE: string;
}

export interface SlideDimensions {
  WIDTH: number;
  HEIGHT: number;
}

export interface ThemeScheme {
  id: string;
  bg: string;
  fg: string;
}

export interface Theme {
  label: string;
  schemes: ThemeScheme[];
}

export type ThemeId = '' | 'keynote' | 'alun' | 'nordic' | 'editorial' | string;

export const CDN: CDNUrls;
export const SLIDE: SlideDimensions;
export const THEMES: Record<ThemeId, Theme>;

// ──────────────────────────────────────────────────────────────────────
// Autoflow
// ──────────────────────────────────────────────────────────────────────

export interface AutoflowDefaults {
  statementMaxWords: number;
  statementDenseMaxWords: number;
  statementMaxLines: number;
  dividerMaxWords: number;
  autoscaleMinLines: number;
  autoscaleMinWords: number;
}

export type AutoflowOptions = Partial<AutoflowDefaults> & {
  totalSlides?: number;
};

export interface AutoflowState {
  lastBareImagePosition: 'left' | 'right' | 'center' | null;
  lastSplitSide: 'left' | 'right' | null;
  lastPhraseBulletsLayout: string | null;
  [k: string]: unknown;
}

export interface AutoflowHistoryEntry {
  slideIndex: number;
  ruleApplied: string;
  info: unknown;
}

export interface AutoflowContext {
  state: AutoflowState;
  history: AutoflowHistoryEntry[];
  options: AutoflowOptions;
}

export interface AutoflowResult {
  rule: string;
  lines: string[];
  detail: string;
}

export interface AutoflowRule {
  name: string;
  priority: number;
  match: (info: unknown, ctx: AutoflowContext) => boolean;
  transform: (info: unknown, ctx: AutoflowContext) => AutoflowResult;
  vary?: (result: AutoflowResult, repetitionIndex: number) => AutoflowResult;
  guard?: (info: unknown, ctx: AutoflowContext) => boolean;
  skipIfDirective?: string[];
}

export interface AutoflowSkipCheck {
  name: string;
  match: (info: unknown, ctx?: AutoflowContext) => boolean;
}

export const AUTOFLOW_DEFAULTS: AutoflowDefaults;
export const RULES: AutoflowRule[];
export const SKIP_CHECKS: AutoflowSkipCheck[];
export const LAYOUT_MODIFIERS: readonly string[];
export const POSITIONS: readonly string[];

export function createAutoflowContext(options?: AutoflowOptions): AutoflowContext;

export function applyAutoflow(
  slideLines: string[],
  slideIndex: number,
  options?: AutoflowOptions,
  prevRules?: string[],
  ctx?: AutoflowContext,
): AutoflowResult;

// ──────────────────────────────────────────────────────────────────────
// Parser
// ──────────────────────────────────────────────────────────────────────

export interface MediaRef {
  modifiers: string[];
  src: string;
  full: string;
  rawMods: string;
}

export interface SlideDirectives {
  [k: string]: string | boolean | number;
}

export interface SectionAttrs {
  [attr: string]: string;
}

export interface ParseSlideResult {
  html: string;
  attrs: SectionAttrs;
  notes: string;
}

export interface ParseOptions {
  applyAutoflow?: boolean;
  autoflowContext?: AutoflowContext;
  totalSlides?: number;
}

/** Returns concatenated `<section>` HTML for the whole deck. */
export function parseDecksetMarkdown(raw: string, options?: ParseOptions): string;

/** Parse a single slide's lines into HTML + section attrs + speaker notes. */
export function parseSlide(rawLines: string[], globalDirectives?: SlideDirectives): ParseSlideResult;

export function findMedia(line: string): MediaRef[];
export function isMediaOnly(line: string): boolean;
export function isVideo(media: MediaRef | string): boolean;
export function isAudio(media: MediaRef | string): boolean;
export function parseYouTube(url: string): { id: string; start?: number } | null;

export function extractDirectives(lines: string[]): { directives: SlideDirectives; remaining: string[] };
export function extractNotes(lines: string[]): { notes: string; remaining: string[] };
export function sectionAttrsFromDirectives(directives: SlideDirectives): SectionAttrs;

export function isFrontmatterLine(line: string): boolean;

export const FRONTMATTER_NAMES: readonly string[];

export interface DirectiveSpec {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'color' | 'enum';
  scope: 'slide' | 'deck' | 'both';
  values?: readonly string[];
  description?: string;
}

export const DIRECTIVE_REGISTRY: readonly DirectiveSpec[];

// ──────────────────────────────────────────────────────────────────────
// Diagnostics
// ──────────────────────────────────────────────────────────────────────

export type DiagnosticType =
  | 'overflow'
  | 'missing-image'
  | 'empty-slide'
  | 'code-no-lang'
  | 'theme-mismatch'
  | 'slide-out-of-range'
  | 'statement-degraded'
  | 'expected-fit'
  | 'too-small-font'
  | 'dense-slide';

export type DiagnosticSeverity = 'error' | 'warn' | 'info';

export interface Diagnostic {
  type: DiagnosticType | string;
  severity: DiagnosticSeverity;
  slide: number | null;
  message: string;
  url?: string;
  line?: number;
  [k: string]: unknown;
}

export interface GroupedDiagnostics {
  byType: Record<string, number>;
  bySlide: Record<string | number, Diagnostic[]>;
  count: number;
}

export function mergeDiagnostics(target: Diagnostic[], incoming: Diagnostic[]): Diagnostic[];
export function groupDiagnostics(warnings: Diagnostic[]): GroupedDiagnostics;

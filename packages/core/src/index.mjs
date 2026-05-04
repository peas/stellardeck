// ESM entry for @stellardeck/core.
//
// The source modules use the dual-export idiom (CommonJS + window globals)
// so static `import { x } from './foo.js'` analysis fails. We import the
// CJS default and re-export named keys explicitly. Node treats this file
// as ESM because of the .mjs extension regardless of package.json "type".

import core from './index.js';

export const applyAutoflow = core.applyAutoflow;
export const createAutoflowContext = core.createAutoflowContext;
export const AUTOFLOW_DEFAULTS = core.AUTOFLOW_DEFAULTS;
export const RULES = core.RULES;
export const SKIP_CHECKS = core.SKIP_CHECKS;
export const LAYOUT_MODIFIERS = core.LAYOUT_MODIFIERS;
export const POSITIONS = core.POSITIONS;

export const parseDecksetMarkdown = core.parseDecksetMarkdown;
export const parseSlide = core.parseSlide;
export const findMedia = core.findMedia;
export const isMediaOnly = core.isMediaOnly;
export const isVideo = core.isVideo;
export const isAudio = core.isAudio;
export const parseYouTube = core.parseYouTube;
export const extractDirectives = core.extractDirectives;
export const extractNotes = core.extractNotes;
export const DIRECTIVE_REGISTRY = core.DIRECTIVE_REGISTRY;
export const FRONTMATTER_NAMES = core.FRONTMATTER_NAMES;
export const isFrontmatterLine = core.isFrontmatterLine;
export const sectionAttrsFromDirectives = core.sectionAttrsFromDirectives;

export const mergeDiagnostics = core.mergeDiagnostics;
export const groupDiagnostics = core.groupDiagnostics;

export const CDN = core.CDN;
export const SLIDE = core.SLIDE;
export const THEMES = core.THEMES;

export default core;

/**
 * The rule set. Adding a rule = one file in this directory + one line here.
 * Order here is documentation order; the engine tries rules by `priority`
 * (lower first) and the first match wins.
 *
 * Rule shape:
 *   name, description, example  — identity + docs (scripts/autoflow-docs.js)
 *   priority                    — lower runs first
 *   guard?(info, ctx)           — cheap precondition (e.g. "first slide only")
 *   match(info, ctx)            — does this slide have the rule's shape?
 *   transform(info, ctx)        — { lines, detail, tier? } — may update ctx.state
 *   vary?(result, rep, ctx)     — anti-monotony when the previous `rep` slides
 *                                 used the same rule
 *   observe?(info, ctx)         — runs on EVERY slide, even skipped ones, to
 *                                 keep cross-slide state honest
 */
module.exports = [
  require('./title.js'),
  require('./divider.js'),
  require('./diagonal.js'),
  require('./z-pattern.js'),
  require('./alternating.js'),
  require('./statement.js'),
  require('./bare-image-position-variation.js'),
  require('./phrase-bullets.js'),
  require('./autoscale.js'),
];

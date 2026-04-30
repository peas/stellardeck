// StellarDeck VS Code Extension
// Extends the built-in markdown preview with StellarDeck rendering.
// Activates on any .md file; only engages when StellarDeck frontmatter is detected.

const stellardeckPlugin = require('./stellardeck-plugin');

exports.activate = function activate() {
  return {
    extendMarkdownIt(md) {
      return md.use(stellardeckPlugin);
    }
  };
};

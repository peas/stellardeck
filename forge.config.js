const path = require('node:path');

// electron-forge configuration.
//
// `npm run start` packages the app on every launch into a temporary .app
// bundle whose Info.plist declares the name "StellarDeck" — that's how
// macOS picks up the menu-bar app name in dev. (Plain `electron .` always
// shows "Electron" because it runs the unmodified Electron framework
// binary.)
//
// `npm run make` produces distributable artifacts under out/make/ — a
// zip on every platform plus a .dmg on macOS.

module.exports = {
  packagerConfig: {
    name: 'StellarDeck',
    appBundleId: 'dev.stellardeck.app',
    icon: path.join(__dirname, 'electron', 'icons', 'icon'),
    appCategoryType: 'public.app-category.productivity',
    // Trim packaging time + bundle size — these dirs aren't shipped.
    ignore: [
      '^/test($|/)',
      '^/test-results($|/)',
      '^/playwright-report($|/)',
      '^/site($|/)',
      '^/docs($|/)',
      '^/\\.github($|/)',
      '^/scripts/dev-server\\.py$',
      '^/\\.claude($|/)',
      '^/\\.git($|/)',
      '\\.test\\.js$',
    ],
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux', 'win32'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
      },
    },
  ],
  plugins: [],
};

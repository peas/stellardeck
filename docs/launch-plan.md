# StellarDeck Open Source Launch Plan

## Positioning

**Tagline:** "Markdown presentations that feel native."

**One-liner:** A fast, offline-first presentation tool for developers — write Markdown, present anywhere.

**vs competitors:**
- vs Slidev: no build step, offline, native desktop app
- vs Marp: GUI with grid/presenter/themes, not just CLI
- vs Keynote/PowerPoint: Markdown + version control + open source

---

## Phase 1 — Pre-Launch (2-3 weeks)

### GitHub repo polish
- [ ] README.md with 30-sec demo GIF, screenshots, install, usage
- [ ] Badges: build status, license, version, platforms
- [ ] CONTRIBUTING.md with build/test/PR instructions
- [ ] CODE_OF_CONDUCT.md
- [ ] Issue templates: bug report, feature request
- [ ] PR template
- [ ] LICENSE (MIT)
- [ ] GitHub Discussions enabled (Q&A, Feature Requests, Show & Tell)

### Documentation site
- [ ] Use **Starlight** (Astro-based, zero config, i18n built-in)
- [ ] Content: Installation, Getting Started, Keyboard Shortcuts, Themes, Deckset Compatibility, Marp Compatibility
- [ ] stellardeck.dev domain

### Landing page
- [ ] 10-15 sec demo video (screen recording of creating + presenting a deck)
- [ ] "Why StellarDeck" comparison table (honest)
- [ ] Download buttons (.dmg, .msi, .AppImage)
- [ ] Screenshot gallery (different themes, grid view, presenter mode)
- [ ] Single CTA: Download + GitHub
- [ ] No pricing, no testimonials at launch (add later)

### Packaging
- [ ] macOS .dmg (signed + notarized via `cargo tauri build`)
- [ ] Windows .msi
- [ ] Linux .AppImage + .deb
- [ ] GitHub Releases with auto-generated changelog
- [ ] GitHub Actions CI: build + test on macOS/Windows/Linux on every PR

### Launch assets
- [ ] 30-sec demo GIF (for README + social)
- [ ] 5 screenshots: title slide, grid view, presenter mode, theme picker, code slide
- [ ] Blog post draft: "Why I built StellarDeck" (Paulo's story, first talk at StartSe)
- [ ] "Show & Tell" request: "Share a photo of yourself presenting with StellarDeck! Tag @paulo_caelum on X"

---

## Phase 2 — Launch Day (Monday-Wednesday)

### Sequence

| Day | Platform | Action |
|-----|----------|--------|
| Mon 10AM PT | **Hacker News** | "Show HN: StellarDeck — open-source Markdown presentations with Tauri" → link to GitHub |
| Tue 12:01AM PST | **Product Hunt** | Launch with tagline, screenshots, video |
| Tue afternoon | **Reddit** | r/programming, r/rust, r/webdev — tailored posts per subreddit |
| Wed | **Dev.to** | Technical post: "Building a presentation app with Tauri 2.0 and StellarSlides" |
| All week | **X/Twitter** | Thread with GIFs, reply to every mention |
| All week | **LinkedIn** | Post targeting CTOs/tech leads |

### Critical: respond to EVERYTHING in first 48 hours
- Every HN comment
- Every Product Hunt question
- Every GitHub issue/star
- Every Reddit reply

---

## Phase 3 — Momentum (weeks 2-8)

### Community
- [ ] GitHub Discussions as primary (async, searchable, permanent)
- [ ] Discord only after 500+ active users
- [ ] Weekly "What's New" discussion post
- [ ] Identify 2-3 power users as community champions
- [ ] "Good first issue" labels for contributor onboarding

### Content
- [ ] Blog post: "Lessons from launching StellarDeck" (retro)
- [ ] Blog post: "How we migrated 372 presentations from Deckset to open source"
- [ ] YouTube: 5-min "Getting Started with StellarDeck" tutorial
- [ ] Reach out to 2-3 dev tool YouTubers for reviews

### i18n (after 1K stars)
- [ ] **Phase 1 (launch):** English only — get product-market fit first
- [ ] **Phase 2 (1K+ stars):** Portuguese + Spanish docs (highest ROI — 500M+ speakers, underserved dev tool market)
- [ ] **Phase 3 (5K+ stars, if demand):** Chinese docs
- [ ] Tool: Crowdin (free for open source, GitHub sync) or Starlight built-in i18n
- [ ] Software i18n: extract strings to locale files, community translations

### Distribution
- [ ] Homebrew cask: `brew install --cask stellardeck`
- [ ] AUR package (Arch Linux)
- [ ] Chocolatey (Windows)
- [ ] Snap/Flatpak (Linux)

---

## Realistic Goals

| Milestone | Target | How |
|-----------|--------|-----|
| Week 1 | 500-1K stars | HN + Product Hunt launch |
| Month 1 | 2-3K stars | Sustained Reddit/Dev.to + content |
| Month 3 | 5K+ stars | Community growth + tutorials |
| Month 6 | 10K stars | Plugin ecosystem + i18n |

---

## What Actually Drives Stars (Data)

- HN front page = 100-300 instant stars
- Product Hunt top 10 = 200-500 stars in 24h
- YouTube tutorial by popular creator = 500+ stars
- Good README with demo GIF = 42% more stars than text-only
- Responding to issues in <24h = #1 differentiator for sustained growth

---

## Reference: How Competitors Launched

**Slidev** (17K stars): Anthony Fu (Vue core team) built it, HN launch, fast release cadence, Vue community support

**Marp** (15K stars): Steady word-of-mouth, VS Code extension drove adoption, CLI-first simplicity

**Obsidian** (500K users): Free + plugin ecosystem + YouTube educators (Nick Milo, Ali Abdaal) + community newsletter

**Pake** (Tauri, 30K stars): Simple value prop, tiny bundle size marketing, HN launch

---

## Key Principle

> Launch something real, launch it publicly, and respond to every person who engages. Consistency beats perfect timing.

Sources: [HN launch guide](https://www.markepear.dev/blog/dev-tool-hacker-news-launch), [Product Hunt checklist](https://usewhale.io/blog/product-hunt-launch-checklist/), [Dev tool landing pages study](https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025), [GitHub stars guide](https://scrapegraphai.com/blog/gh-stars), [Starlight docs](https://starlight.astro.build/)

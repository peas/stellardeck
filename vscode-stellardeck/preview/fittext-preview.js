// StellarDeck preview: font loading + SVG viewBox correction + navigation
// CSS does initial scaling via estimated viewBox. This script corrects
// the viewBox after fonts load for pixel-perfect fit.

(function() {
  'use strict';

  // Load theme fonts
  function loadFonts() {
    if (document.getElementById('sd-fonts')) return;
    var link = document.createElement('link');
    link.id = 'sd-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + [
      'Inter:wght@400;600;700;900',
      'Poppins:wght@400;500;600;700;800;900',
      'Lato:wght@300;400;700;900',
      'Playfair+Display:wght@400;600;700;900',
      'JetBrains+Mono:wght@400;500;700',
      'Bebas+Neue',
      'Montserrat:wght@400;500;600;700;800;900',
      'DM+Sans:wght@400;500;600;700',
    ].join('&family=') + '&display=swap';
    document.head.appendChild(link);
  }

  // Correct SVG viewBox to match actual text width after fonts load
  function correctViewBoxes() {
    var svgs = document.querySelectorAll('.sd-fit-svg');
    svgs.forEach(function(svg) {
      var inner = svg.querySelector('.sd-fit-inner');
      if (!inner) return;
      // Measure actual rendered text width inside foreignObject
      var w = inner.scrollWidth;
      var h = inner.scrollHeight || inner.offsetHeight || 84;
      if (w > 0) {
        svg.setAttribute('viewBox', '0 0 ' + Math.ceil(w * 1.02) + ' ' + Math.ceil(h));
        // Also set foreignObject dimensions
        var fo = svg.querySelector('foreignObject');
        if (fo) {
          fo.setAttribute('width', Math.ceil(w * 1.05));
          fo.setAttribute('height', Math.ceil(h * 1.1));
        }
      }
    });
  }

  // Navigation
  function addNav() {
    var c = document.querySelector('.stellardeck-preview');
    if (!c || c.querySelector('.sd-preview-slide-num')) return;
    var slides = c.querySelectorAll('section');
    slides.forEach(function(s, i) {
      var n = document.createElement('div');
      n.className = 'sd-preview-slide-num';
      n.textContent = (i+1) + ' / ' + slides.length;
      s.appendChild(n);
      if (i > 0) { var u = document.createElement('button'); u.className = 'sd-preview-nav sd-up'; u.innerHTML = '&#x25B2;'; u.onclick = function(e){e.preventDefault();slides[i-1].scrollIntoView({behavior:'smooth',block:'center'});}; s.appendChild(u); }
      if (i < slides.length-1) { var d = document.createElement('button'); d.className = 'sd-preview-nav sd-down'; d.innerHTML = '&#x25BC;'; d.onclick = function(e){e.preventDefault();slides[i+1].scrollIntoView({behavior:'smooth',block:'center'});}; s.appendChild(d); }
    });
  }

  function injectStyles() {
    if (document.getElementById('sd-nav-css')) return;
    var s = document.createElement('style'); s.id = 'sd-nav-css';
    s.textContent = '.sd-preview-nav{position:absolute;z-index:10;background:rgba(0,0,0,0.5);color:rgba(255,255,255,0.7);border:none;width:28px;height:28px;border-radius:50%;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s}section:hover .sd-preview-nav{opacity:0.6}.sd-preview-nav:hover{opacity:1!important;background:rgba(0,0,0,0.8)}.sd-up{right:12px;top:8px}.sd-down{right:12px;bottom:24px}.sd-preview-slide-num{position:absolute;bottom:6px;right:10px;font-family:"Inter",system-ui,sans-serif;font-size:0.6rem;color:rgba(255,255,255,0.25);pointer-events:none}';
    document.head.appendChild(s);
  }

  function init() {
    loadFonts();
    injectStyles();
    addNav();
    // Correct viewBox: immediate, after fonts, and delayed
    correctViewBoxes();
    if (document.fonts) {
      document.fonts.ready.then(function() {
        correctViewBoxes();
        // Extra correction after a delay for late-loading fonts
        setTimeout(correctViewBoxes, 1000);
      });
    }
    setTimeout(correctViewBoxes, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 50);
  }

  var t;
  new MutationObserver(function() {
    clearTimeout(t);
    t = setTimeout(function() {
      if (document.querySelector('.stellardeck-preview')) { addNav(); correctViewBoxes(); }
    }, 200);
  }).observe(document.body, { childList: true, subtree: true });
})();

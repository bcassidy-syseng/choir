/* Choir: shared by the front page and both sections (Grimoire, MagicCon).
 * The Discord sign-in token lives in this site's localStorage, so signing in
 * once covers every section. Each server checks the token itself. */
(function () {
  const script = document.currentScript;
  const root = new URL('./', script ? script.src : location.href).href; // choir.js sits at the site root
  const get = key => { try { return localStorage.getItem('choir_' + key) || ''; } catch (e) { return ''; } };
  const set = (key, value) => {
    try { if (value) localStorage.setItem('choir_' + key, value); else localStorage.removeItem('choir_' + key); } catch (e) { /* private mode: sign-in lasts this visit */ }
  };
  window.CHOIR = {
    root: root,
    token: () => get('token'),
    name: () => get('name'),
    signIn(token, name) { set('token', token); set('name', name || ''); },
    /** Clears the sign-in everywhere and returns to the front page. */
    signOut(reason) { set('token', ''); set('name', ''); location.href = root + (reason ? '#signed-out' : ''); },
    /** Opens the front page to switch sections. */
    hubUrl: root + '?switch',
    remember(section) { set('last', section); },
    last: () => get('last'),
    backdrop: backdrop
  };

  /* ---- Card art in empty space ----
   * Commander art from the group's own decks (Grimoire's saved data), shown at the
   * bottom of the screen only where the page leaves room. A different card each
   * visit, credited to its artist (from Scryfall's card data). */
  function artPool() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem('cg_data') || 'null'); } catch (e) { data = null; }
    const out = [], seen = {};
    ((data && data.decks) || []).forEach(d => {
      [[d.art, (d.cmd || [])[0]], [d.art2, (d.cmd || [])[1]]].forEach(([direct, name]) => {
        const url = direct || (name ? 'https://api.scryfall.com/cards/named?exact=' + encodeURIComponent(name) + '&format=image&version=art_crop' : '');
        if (url && !seen[url]) { seen[url] = 1; out.push({ url: url, name: name || '' }); }
      });
    });
    return out;
  }
  function pick() {
    const pool = artPool();
    if (!pool.length) return null;
    const last = get('art_last');
    const choices = pool.length > 1 ? pool.filter(a => a.url !== last) : pool;
    const a = choices[Math.floor(Math.random() * choices.length)];
    set('art_last', a.url);
    return a;
  }
  function artist(a, done) {
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem('choir_artists') || '{}'); } catch (e) { cache = {}; }
    if (cache[a.url] !== undefined) return done(cache[a.url]);
    const id = /\/art_crop\/(?:front|back)\/[0-9a-f]\/[0-9a-f]\/([0-9a-f-]{36})\./.exec(a.url);
    const url = id ? 'https://api.scryfall.com/cards/' + id[1] : (a.name ? 'https://api.scryfall.com/cards/named?exact=' + encodeURIComponent(a.name) : '');
    if (!url) return done('');
    fetch(url).then(r => r.ok ? r.json() : null).catch(() => null).then(card => {
      const name = card ? (card.artist || ((card.card_faces || [])[0] || {}).artist || '') : '';
      if (card) { cache[a.url] = name; try { localStorage.setItem('choir_artists', JSON.stringify(cache)); } catch (e) {} }
      done(name);
    });
  }
  const STYLE = '.choir-bd{position:relative;display:block;width:100vw;margin:8px 0 0 calc(50% - 50vw);overflow:hidden;pointer-events:none;' +
    '-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 34%);mask-image:linear-gradient(180deg,transparent 0,#000 34%)}' +
    '.choir-bd img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 30%;max-width:none;opacity:0;transition:opacity .6s ease}' +
    '.choir-bd img.on{opacity:1}' +
    '.choir-bd::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(26,19,11,.3),rgba(26,19,11,0) 45%,rgba(26,19,11,.5))}' +
    '.choir-bd span{position:absolute;right:12px;bottom:10px;z-index:1;font:12px/1.2 "Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif;color:#f1e5cc;' +
    'background:rgba(26,19,11,.72);padding:4px 8px;border-radius:999px}.choir-bd span:empty{display:none}' +
    '@media (prefers-reduced-motion:reduce){.choir-bd img{transition:none}}';
  /** Adds card art after the content of `content`: it fills the empty part of a short
   * screen, and closes out a long one. `bottomBar` is a selector for a fixed bottom nav. */
  function backdrop(content, bottomBar) {
    if (!content || window.__choirBackdrop) return;
    const a = pick();
    if (!a) return;
    window.__choirBackdrop = true;
    const style = document.createElement('style'); style.textContent = STYLE; document.head.appendChild(style);
    const el = document.createElement('div'); el.className = 'choir-bd'; el.setAttribute('aria-hidden', 'true');
    const img = new Image(); img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    const credit = document.createElement('span');
    el.appendChild(img); el.appendChild(credit);
    img.onload = () => { img.classList.add('on'); artist(a, name => { credit.textContent = name ? 'Art: ' + name : ''; }); };
    img.onerror = () => { el.remove(); window.__choirBackdrop = 'failed'; };
    img.src = a.url;
    let busy = false;
    function place() {
      if (window.__choirBackdrop === 'failed') return;
      busy = true;
      if (el.parentNode !== content || content.lastElementChild !== el) content.appendChild(el);
      el.style.height = '0px';
      const bar = bottomBar ? document.querySelector(bottomBar) : null;
      const barH = bar && getComputedStyle(bar).display !== 'none' && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect().height : 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const pad = parseFloat(getComputedStyle(content).paddingBottom) || 0;
      const gap = window.innerHeight - barH - top - Math.max(0, pad - barH);
      el.style.height = Math.round(Math.min(window.innerHeight * 0.8, Math.max(300, gap))) + 'px';
      busy = false;
    }
    let queued = false;
    const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; place(); }); } };
    new MutationObserver(() => { if (!busy) later(); }).observe(content, { childList: true });
    window.addEventListener('resize', later);
    place();
  }
})();

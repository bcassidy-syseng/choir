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
  const STYLE = '.choir-bd{position:fixed;left:0;right:0;z-index:0;pointer-events:none;overflow:hidden;opacity:0;transition:opacity .6s ease;' +
    '-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 38%);mask-image:linear-gradient(180deg,transparent 0,#000 38%)}' +
    '.choir-bd.on{opacity:1}.choir-bd img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 30%;max-width:none}' +
    '.choir-bd::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(26,19,11,.35),rgba(26,19,11,0) 45%,rgba(26,19,11,.55))}' +
    '.choir-bd span{position:absolute;right:12px;bottom:10px;z-index:1;font:12px/1.2 "Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif;color:#f1e5cc;' +
    'background:rgba(26,19,11,.72);padding:4px 8px;border-radius:999px}.choir-bd span:empty{display:none}' +
    '@media (prefers-reduced-motion:reduce){.choir-bd{transition:none}}';
  /** Shows card art in the empty space below `content`. `bottomBar` is a selector for a fixed bottom nav, if any. */
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
    document.body.insertBefore(el, document.body.firstChild);
    if (getComputedStyle(content).position === 'static') content.style.position = 'relative';
    content.style.zIndex = '1';
    let loaded = false;
    img.onload = () => { loaded = true; place(); artist(a, name => { credit.textContent = name ? 'Art: ' + name : ''; }); };
    img.onerror = () => el.remove();
    img.src = a.url;
    function bottomOfContent() {
      let max = 0;
      Array.prototype.forEach.call(content.querySelectorAll(':scope > *, :scope > * > *'), n => {
        const cs = getComputedStyle(n);
        if (cs.position === 'fixed' || cs.display === 'none' || n.classList.contains('choir-bd')) return;
        const r = n.getBoundingClientRect();
        if (r.height && r.bottom > max) max = r.bottom;
      });
      return max;
    }
    function place() {
      if (!loaded) return;
      const bar = bottomBar ? document.querySelector(bottomBar) : null;
      const barH = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().height : 0;
      const scrolls = document.documentElement.scrollHeight > window.innerHeight + 4;
      const top = bottomOfContent() + 8;
      const room = window.innerHeight - barH - top;
      if (scrolls || room < 170) { el.classList.remove('on'); return; }
      el.style.bottom = barH + 'px';
      el.style.height = Math.min(window.innerHeight * 0.75, room + 60) + 'px';
      el.classList.add('on');
    }
    let queued = false;
    const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; place(); }); } };
    new MutationObserver(later).observe(content, { childList: true, subtree: true });
    window.addEventListener('resize', later);
    window.addEventListener('hashchange', () => setTimeout(later, 50));
  }
})();

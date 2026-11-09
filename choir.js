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
    last: () => get('last')
  };
})();

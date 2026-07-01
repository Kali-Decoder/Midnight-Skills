/**
 * Site metadata helper — SITE object synced from skills.json via npm run sync:registry
 */
(function () {
  const SITE = {
    "name": "MIDSKILLS",
    "tagline": "Knowledge Skills for AI Agents Building on Midnight Network",
    "description": "Open knowledge skills for AI agents building privacy-preserving apps on Midnight Network — Compact contracts, wallet integration, SDK guides, and runnable templates.",
    "url": "https://midnight-skills.netlify.app",
    "repository": "https://github.com/Kali-Decoder/Midnight-skills",
    "license": "MIT",
    "themeColor": "#070b10",
    "ogImage": "/logos/pi.svg",
    "keywords": "Midnight Network, Compact, zk-SNARKs, privacy blockchain, AI agents, knowledge skills, dApp, web3, confidential computing",
    "authors": "Tusharpamnani, Kali-Decoder"
  };

  function upsertMeta(name, content, isProperty) {
    if (!content) return;
    const attr = isProperty ? 'property' : 'name';
    let el = document.head.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function setLink(rel, href) {
    if (!href) return;
    let el = document.head.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.href = href;
  }

  function buildTitle(pageTitle, kind) {
    if (kind === 'home' || !pageTitle) {
      return SITE.name + ' — ' + SITE.tagline;
    }
    return pageTitle + ' — ' + SITE.name;
  }

  function buildCanonical(path) {
    const base = SITE.url.replace(/\/$/, '');
    if (!path || path === '/') return base + '/';
    return base + (path.startsWith('/') ? path : '/' + path);
  }

  window.SiteMeta = {
    site: SITE,
    apply(opts) {
      const kind = opts.kind || '';
      const title = buildTitle(opts.title, kind);
      const desc = opts.description || SITE.description;
      const type = opts.type || 'website';
      const canonical = buildCanonical(opts.path);

      document.title = title;
      upsertMeta('description', desc, false);
      upsertMeta('og:title', title, true);
      upsertMeta('og:description', desc, true);
      upsertMeta('og:type', type, true);
      upsertMeta('og:url', canonical, true);
      upsertMeta('og:site_name', SITE.name, true);
      upsertMeta('og:image', buildCanonical(SITE.ogImage), true);
      upsertMeta('twitter:card', 'summary', false);
      upsertMeta('twitter:title', title, false);
      upsertMeta('twitter:description', desc, false);
      upsertMeta('twitter:image', buildCanonical(SITE.ogImage), false);
      setLink('canonical', canonical);
    },
    initFromBody() {
      const b = document.body;
      if (!b || b.dataset.siteMeta !== 'auto') return;
      this.apply({
        kind: b.dataset.pageKind || '',
        title: b.dataset.pageTitle || '',
        description: b.dataset.pageDescription || SITE.description,
        path: b.dataset.pagePath || window.location.pathname + window.location.search,
        type: b.dataset.pageType || 'website',
      });
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SiteMeta.initFromBody());
  } else {
    SiteMeta.initFromBody();
  }
})();

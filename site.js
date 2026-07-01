(function () {
  const NAV_ITEMS = [
    { id: 'home', href: '/', label: 'Home' },
    { id: 'skills', href: 'skill.html', label: 'Browse skills' },
    { id: 'howto', href: 'howto.html', label: 'How to use' },
    { id: 'contribute', href: 'CONTRIBUTING.md', label: 'Contribute' },
    { id: 'analytics', href: 'analytics.html', label: 'Analytics' },
  ];

  const FOOTER_LINKS = NAV_ITEMS.filter((i) => i.id !== 'home');

  function renderNav(activeId) {
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('aria-label', 'Main');

    const brand = document.createElement('a');
    brand.className = 'site-nav-brand';
    brand.href = '/';
    brand.textContent = 'MIDSKILLS';
    nav.appendChild(brand);

    const links = document.createElement('div');
    links.className = 'site-nav-links';
    NAV_ITEMS.forEach((item) => {
      if (item.id === 'home') return;
      const a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      if (item.id === activeId) a.classList.add('active');
      links.appendChild(a);
    });
    nav.appendChild(links);
    return nav;
  }

  function renderFooter() {
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    const parts = ['MIT License'];
    FOOTER_LINKS.forEach((item) => {
      parts.push('<a href="' + item.href + '">' + item.label + '</a>');
    });
    footer.innerHTML =
    parts.join(' · ') +
    ' · <a href="https://github.com/Kali-Decoder/Midnight-skills" rel="noopener">GitHub</a>' +
    '<br><span class="text-muted" style="opacity:0.8;">Anonymous usage analytics may record public GitHub usernames.</span>';
    return footer;
  }

  const active = document.body.dataset.navActive || '';
  if (document.body.dataset.siteNav !== 'off') {
    document.body.insertBefore(renderNav(active), document.body.firstChild);
  }
  if (document.body.dataset.siteFooter === 'on') {
    document.body.appendChild(renderFooter());
  }
})();

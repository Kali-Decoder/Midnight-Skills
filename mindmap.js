/**
 * Interactive skill journey mind map — loads skillLevels from skills.json
 */
(function () {
  const LEVEL_COLORS = {
    beginner: '#7ec8e3',
    intermediate: '#ffd400',
    advanced: '#b8e986',
  };
  const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];
  const MOBILE_BP = 820;

  let activeLevel = 'all';
  let skillsById = {};
  let levelMeta = [];
  let selectedNode = null;
  let mobileSlide = 0; // 0=hub, 1-3=levels
  let tooltipEl = null;

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isMobile() {
    return window.innerWidth <= MOBILE_BP;
  }

  function buildMindMap(levels) {
    levelMeta = levels;
    const section = document.getElementById('mindmap-section');
    if (!section || !levels.length) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'mindmap-toolbar';

    const controls = document.createElement('div');
    controls.className = 'mindmap-controls';
    controls.setAttribute('role', 'tablist');
    controls.setAttribute('aria-label', 'Skill level');

    const allBtn = mkLevelBtn('all', 'All levels', 'var(--accent)');
    allBtn.classList.add('active');
    controls.appendChild(allBtn);

    levels.forEach((lvl) => {
      controls.appendChild(mkLevelBtn(lvl.id, lvl.title, lvl.color || LEVEL_COLORS[lvl.id]));
    });

    const pager = document.createElement('div');
    pager.className = 'mindmap-pager';
    pager.innerHTML =
      '<button type="button" class="mindmap-pager-btn" id="mm-prev" aria-label="Previous">‹</button>' +
      '<span class="mindmap-pager-label" id="mm-pager-label">Start</span>' +
      '<button type="button" class="mindmap-pager-btn" id="mm-next" aria-label="Next">›</button>';

    toolbar.appendChild(controls);
    toolbar.appendChild(pager);

    const dots = document.createElement('div');
    dots.className = 'mindmap-dots';
    dots.setAttribute('role', 'tablist');
    dots.setAttribute('aria-label', 'Carousel position');
    const dotLabels = ['Start', ...levels.map((l) => l.title)];
    dotLabels.forEach((label, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'mindmap-dot' + (i === 0 ? ' active' : '');
      dot.dataset.slide = String(i);
      dot.setAttribute('aria-label', label);
      dots.appendChild(dot);
    });

    const frame = document.createElement('div');
    frame.className = 'mindmap-frame';
    frame.id = 'mindmap-frame';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mindmap-svg');
    svg.setAttribute('aria-hidden', 'true');
    frame.appendChild(svg);

    const scroll = document.createElement('div');
    scroll.className = 'mindmap-scroll';
    scroll.id = 'mindmap-scroll';

    const grid = document.createElement('div');
    grid.className = 'mindmap-grid';
    grid.id = 'mindmap-grid';

    const hubWrap = document.createElement('div');
    hubWrap.className = 'mindmap-hub-wrap';
    const hub = document.createElement('button');
    hub.type = 'button';
    hub.className = 'mindmap-hub';
    hub.id = 'mindmap-hub';
    hub.setAttribute('aria-label', 'Reset map to show all levels');
    hub.innerHTML =
      '<span class="mindmap-hub-label">You are here</span>' +
      '<span class="mindmap-hub-title">Start</span>';
    hubWrap.appendChild(hub);
    grid.appendChild(hubWrap);

    levels.forEach((lvl, levelIdx) => {
      const col = document.createElement('div');
      col.className = 'mindmap-column';
      col.dataset.level = lvl.id;

      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'mindmap-col-head';
      head.dataset.level = lvl.id;
      const skillCount = (lvl.skills || []).filter((s) => {
        const sk = skillsById[s.skillId];
        return sk && sk.enabled !== false;
      }).length;
      head.innerHTML =
        '<div class="mindmap-col-title">' + esc(lvl.title) + '</div>' +
        '<div class="mindmap-col-sub">' + esc(lvl.subtitle || '') + '</div>' +
        '<div class="mindmap-col-count">' + skillCount + ' skill' + (skillCount === 1 ? '' : 's') + '</div>';
      head.addEventListener('click', () => setActiveLevel(lvl.id));
      col.appendChild(head);

      const nodes = document.createElement('div');
      nodes.className = 'mindmap-nodes';

      (lvl.skills || []).forEach((step, stepIdx) => {
        const skill = skillsById[step.skillId];
        if (!skill || skill.enabled === false) return;

        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'mindmap-node';
        node.dataset.skillId = step.skillId;
        node.dataset.level = lvl.id;
        node.dataset.step = String(stepIdx + 1);
        node.style.setProperty('--node-color', lvl.color || LEVEL_COLORS[lvl.id]);
        node.setAttribute('aria-label', skill.name + ' — ' + (step.summary || skill.description || ''));
        node.innerHTML =
          '<div class="mindmap-node-step">Step ' + (stepIdx + 1) + '</div>' +
          '<div class="mindmap-node-name">' + esc(skill.name) + '</div>' +
          '<div class="mindmap-node-desc">' + esc(step.summary || skill.description || '') + '</div>';

        node.addEventListener('click', (e) => {
          e.preventDefault();
          selectNode(node, skill, step, lvl);
        });
        node.addEventListener('dblclick', () => {
          window.location.href = 'skill.html?name=' + encodeURIComponent(step.skillId);
        });
        node.addEventListener('mouseenter', (e) => showTooltip(e, skill, step));
        node.addEventListener('mouseleave', hideTooltip);
        node.addEventListener('focus', (e) => showTooltip(e, skill, step));
        node.addEventListener('blur', hideTooltip);

        nodes.appendChild(node);
      });

      col.appendChild(nodes);
      grid.appendChild(col);
    });

    scroll.appendChild(grid);
    frame.appendChild(scroll);

    const preview = document.createElement('div');
    preview.className = 'mindmap-preview';
    preview.id = 'mindmap-preview';
    preview.setAttribute('role', 'region');
    preview.setAttribute('aria-live', 'polite');
    preview.setAttribute('aria-label', 'Selected skill');

    const hint = document.createElement('p');
    hint.className = 'mindmap-progress-hint';
    hint.id = 'mindmap-hint';
    hint.innerHTML =
      'Tap a skill to preview · double-click or use <strong>Open skill</strong> to read it. ' +
      '<span class="desktop-hint">Use <kbd>←</kbd> <kbd>→</kbd> for levels, <kbd>↑</kbd> <kbd>↓</kbd> for skills.</span>';

    const mount = section.querySelector('.mindmap-mount');
    if (mount) mount.innerHTML = '';
    mount.appendChild(toolbar);
    mount.appendChild(dots);
    mount.appendChild(frame);
    mount.appendChild(preview);
    mount.appendChild(hint);

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'mindmap-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipEl);

    controls.querySelectorAll('.mindmap-level-btn').forEach((btn) => {
      btn.addEventListener('click', () => setActiveLevel(btn.dataset.level));
    });

    hub.addEventListener('click', () => {
      setActiveLevel('all');
      clearSelection();
      if (isMobile()) goToSlide(0);
    });

    document.getElementById('mm-prev').addEventListener('click', () => goToSlide(mobileSlide - 1));
    document.getElementById('mm-next').addEventListener('click', () => goToSlide(mobileSlide + 1));

    dots.querySelectorAll('.mindmap-dot').forEach((dot) => {
      dot.addEventListener('click', () => goToSlide(Number(dot.dataset.slide)));
    });

    setupSwipe(scroll);
    setupKeyboard();
    updatePager();

    const ro = new ResizeObserver(debounce(() => {
      drawConnectors(false);
      if (isMobile()) syncScrollToSlide(false);
    }, 100));
    ro.observe(frame);

    if (!prefersReducedMotion()) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          drawConnectors(true);
          animateIn();
        });
      });
    } else {
      document.querySelectorAll('.mindmap-hub, .mindmap-col-head, .mindmap-node, .mindmap-progress-hint').forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }
  }

  function mkLevelBtn(id, label, color) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mindmap-level-btn';
    btn.dataset.level = id;
    btn.setAttribute('role', 'tab');
    btn.style.setProperty('--level-color', color);
    btn.innerHTML = '<span class="level-dot"></span> ' + esc(label);
    return btn;
  }

  function setActiveLevel(level) {
    activeLevel = level;
    const grid = document.getElementById('mindmap-grid');

    document.querySelectorAll('.mindmap-level-btn').forEach((b) => {
      const on = b.dataset.level === level;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    document.querySelectorAll('.mindmap-column').forEach((col) => {
      const isMatch = level === 'all' || col.dataset.level === level;
      col.classList.toggle('dimmed', level !== 'all' && col.dataset.level !== level);
      col.classList.toggle('focused', level !== 'all' && col.dataset.level === level);
    });

    document.querySelectorAll('.mindmap-col-head').forEach((h) => {
      h.classList.toggle('active-level', level !== 'all' && h.dataset.level === level);
    });

    document.querySelectorAll('.mindmap-node').forEach((node) => {
      node.classList.toggle('highlight', level !== 'all' && node.dataset.level === level && !node.classList.contains('selected'));
    });

    document.querySelectorAll('.mindmap-svg path').forEach((path) => {
      const pl = path.dataset.level;
      const active = level === 'all' || pl === level || pl === 'bridge-' + level;
      path.classList.toggle('mm-active', active);
      path.classList.toggle('mm-dim', level !== 'all' && !active);
    });

    if (grid) {
      grid.classList.toggle('mode-filter', isMobile() && level !== 'all');
    }

    updateHint(level);
    updatePager();

    if (isMobile() && level !== 'all') {
      const idx = LEVEL_ORDER.indexOf(level) + 1;
      if (idx > 0) goToSlide(idx, false);
    }

    applyPathHighlight();

    if (typeof gsap !== 'undefined' && !prefersReducedMotion() && !isMobile()) {
      const target = level === 'all' ? '.mindmap-column' : '.mindmap-column.focused';
      gsap.fromTo(target, { scale: 0.98 }, { scale: level === 'all' ? 1 : 1.02, duration: 0.35, ease: 'power2.out' });
    }
  }

  function updateHint(level) {
    const hint = document.getElementById('mindmap-hint');
    if (!hint) return;
    if (level === 'all') {
      hint.innerHTML =
        'Tap a skill to preview · double-click or use <strong>Open skill</strong> to read it. ' +
        '<span class="desktop-hint">Use <kbd>←</kbd> <kbd>→</kbd> for levels, <kbd>↑</kbd> <kbd>↓</kbd> for skills.</span>';
    } else {
      const titles = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
      hint.innerHTML =
        'Focused on <strong>' + (titles[level] || level) + '</strong> — complete these skills, then move to the next level.';
    }
  }

  function selectNode(node, skill, step, lvl) {
    document.querySelectorAll('.mindmap-node').forEach((n) => n.classList.remove('selected', 'highlight'));
    node.classList.add('selected');
    selectedNode = node;

    const preview = document.getElementById('mindmap-preview');
    const color = lvl.color || LEVEL_COLORS[lvl.id];
    preview.className = 'mindmap-preview visible';
    preview.innerHTML =
      '<div class="mindmap-preview-level" style="color:' + esc(color) + '">' +
      esc(lvl.title) + ' · Step ' + esc(node.dataset.step) +
      '</div>' +
      '<div class="mindmap-preview-title">' + esc(skill.name) + '</div>' +
      '<div class="mindmap-preview-desc">' + esc(step.summary || skill.description || '') + '</div>' +
      '<div class="mindmap-preview-actions">' +
      '<a class="mindmap-preview-btn primary" href="skill.html?name=' + encodeURIComponent(step.skillId) + '">Open skill →</a>' +
      '<button type="button" class="mindmap-preview-btn" id="mm-clear-sel">Clear selection</button>' +
      '</div>';

    document.getElementById('mm-clear-sel').addEventListener('click', clearSelection);

    if (typeof gsap !== 'undefined' && !prefersReducedMotion()) {
      gsap.fromTo(preview, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 });
    }

    preview.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }

  function clearSelection() {
    selectedNode = null;
    document.querySelectorAll('.mindmap-node').forEach((n) => n.classList.remove('selected'));
    const preview = document.getElementById('mindmap-preview');
    if (preview) {
      preview.classList.remove('visible');
      preview.innerHTML = '';
    }
    if (activeLevel !== 'all') {
      document.querySelectorAll('.mindmap-node').forEach((node) => {
        node.classList.toggle('highlight', node.dataset.level === activeLevel);
      });
    }
  }

  function showTooltip(e, skill, step) {
    if (isMobile() || !tooltipEl) return;
    tooltipEl.innerHTML =
      '<div class="mindmap-tooltip-title">' + esc(skill.name) + '</div>' +
      '<div class="mindmap-tooltip-desc">' + esc(step.summary || skill.description || '') + '</div>' +
      '<div class="mindmap-tooltip-desc" style="margin-top:0.35rem;font-size:10px;">Click to preview · double-click to open</div>';
    tooltipEl.classList.add('visible');
    positionTooltip(e);
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
  }

  function positionTooltip(e) {
    if (!tooltipEl) return;
    const pad = 12;
    let x = (e.clientX || 0) + pad;
    let y = (e.clientY || 0) + pad;
    const rect = tooltipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - pad) x = window.innerWidth - rect.width - pad;
    if (y + rect.height > window.innerHeight - pad) y = (e.clientY || 0) - rect.height - pad;
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
  }

  function goToSlide(index, animate) {
    const max = LEVEL_ORDER.length;
    mobileSlide = Math.max(0, Math.min(max, index));
    updatePager();
    syncScrollToSlide(animate !== false);
  }

  function updatePager() {
    const labels = ['Start', 'Beginner', 'Intermediate', 'Advanced'];
    const label = document.getElementById('mm-pager-label');
    const prev = document.getElementById('mm-prev');
    const next = document.getElementById('mm-next');
    const pager = document.querySelector('.mindmap-pager');
    const dots = document.querySelector('.mindmap-dots');
    const hideNav = isMobile() && activeLevel !== 'all';

    if (label) label.textContent = labels[mobileSlide] || '';
    if (prev) prev.disabled = mobileSlide <= 0;
    if (next) next.disabled = mobileSlide >= LEVEL_ORDER.length;
    if (pager) pager.style.display = isMobile() && !hideNav ? 'flex' : 'none';
    if (dots) dots.style.display = isMobile() && !hideNav ? 'flex' : 'none';

    document.querySelectorAll('.mindmap-dot').forEach((dot) => {
      dot.classList.toggle('active', Number(dot.dataset.slide) === mobileSlide);
    });
  }

  function syncScrollToSlide(animate) {
    const scroll = document.getElementById('mindmap-scroll');
    const grid = document.getElementById('mindmap-grid');
    if (!scroll || !grid || !isMobile()) return;

    if (activeLevel !== 'all' && grid.classList.contains('mode-filter')) {
      return;
    }

    const items = [...grid.children];
    const target = items[mobileSlide];
    if (!target) return;

    const left = target.offsetLeft - scroll.offsetLeft - (scroll.clientWidth - target.offsetWidth) / 2;
    scroll.scrollTo({ left: Math.max(0, left), behavior: animate ? 'smooth' : 'auto' });
  }

  function setupSwipe(scrollEl) {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    scrollEl.addEventListener('touchstart', (e) => {
      if (!isMobile() || activeLevel !== 'all') return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    scrollEl.addEventListener('touchend', (e) => {
      if (!tracking || !isMobile() || activeLevel !== 'all') return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) goToSlide(mobileSlide + 1);
      else goToSlide(mobileSlide - 1);
    }, { passive: true });

    scrollEl.addEventListener('scroll', debounce(() => {
      if (!isMobile() || activeLevel !== 'all') return;
      const grid = document.getElementById('mindmap-grid');
      if (!grid) return;
      const scroll = scrollEl;
      const center = scroll.scrollLeft + scroll.clientWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      [...grid.children].forEach((child, i) => {
        const childCenter = child.offsetLeft + child.offsetWidth / 2;
        const dist = Math.abs(center - childCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      if (closest !== mobileSlide) {
        mobileSlide = closest;
        updatePager();
      }
    }, 80), { passive: true });
  }

  function setupKeyboard() {
    const section = document.getElementById('mindmap-section');
    if (!section) return;
    section.setAttribute('tabindex', '0');

    section.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea')) return;

      const levels = ['all', ...LEVEL_ORDER];
      const levelIdx = levels.indexOf(activeLevel);

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = levels[Math.min(levels.length - 1, levelIdx + 1)];
        setActiveLevel(next);
        if (isMobile() && next === 'all') goToSlide(0);
        else if (isMobile() && next !== 'all') goToSlide(LEVEL_ORDER.indexOf(next) + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = levels[Math.max(0, levelIdx - 1)];
        setActiveLevel(prev);
        if (isMobile() && prev === 'all') goToSlide(0);
        else if (isMobile() && prev !== 'all') goToSlide(LEVEL_ORDER.indexOf(prev) + 1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateNodes(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter' && selectedNode) {
        const id = selectedNode.dataset.skillId;
        if (id) window.location.href = 'skill.html?name=' + encodeURIComponent(id);
      } else if (e.key === 'Escape') {
        clearSelection();
        setActiveLevel('all');
      }
    });
  }

  function navigateNodes(dir) {
    const pool = activeLevel === 'all'
      ? [...document.querySelectorAll('.mindmap-node')]
      : [...document.querySelectorAll('.mindmap-node[data-level="' + activeLevel + '"]')];
    if (!pool.length) return;

    let idx = selectedNode ? pool.indexOf(selectedNode) : -1;
    idx = Math.max(0, Math.min(pool.length - 1, idx + dir));
    pool[idx].focus();
    pool[idx].click();
  }

  function getCenter(el, frame) {
    const er = el.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    return {
      x: er.left + er.width / 2 - fr.left,
      y: er.top + er.height / 2 - fr.top,
    };
  }

  function drawConnectors(animate) {
    const frame = document.getElementById('mindmap-frame');
    const svg = frame?.querySelector('.mindmap-svg');
    const hub = document.getElementById('mindmap-hub');
    if (!frame || !svg || !hub || isMobile()) {
      if (svg) svg.innerHTML = '';
      return;
    }

    svg.innerHTML = '';
    const cols = [...document.querySelectorAll('.mindmap-column')];
    const hubC = getCenter(hub, frame);

    cols.forEach((col, i) => {
      const head = col.querySelector('.mindmap-col-head');
      if (!head) return;
      const headC = getCenter(head, frame);
      const level = col.dataset.level;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midX = hubC.x + (headC.x - hubC.x) * 0.45;
      path.setAttribute('d',
        'M ' + hubC.x + ' ' + hubC.y +
        ' C ' + midX + ' ' + hubC.y + ', ' + midX + ' ' + headC.y + ', ' + headC.x + ' ' + headC.y);
      path.dataset.level = level;
      svg.appendChild(path);

      if (i > 0) {
        const prevHead = cols[i - 1].querySelector('.mindmap-col-head');
        if (prevHead) {
          const prevC = getCenter(prevHead, frame);
          const bridge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          bridge.setAttribute('d',
            'M ' + (prevC.x + 40) + ' ' + prevC.y +
            ' Q ' + ((prevC.x + headC.x) / 2) + ' ' + (prevC.y - 28) +
            ', ' + (headC.x - 40) + ' ' + headC.y);
          bridge.dataset.level = 'bridge-' + level;
          bridge.setAttribute('stroke-dasharray', '5 7');
          svg.appendChild(bridge);
        }
      }

      const nodeEls = col.querySelectorAll('.mindmap-node');
      nodeEls.forEach((node, ni) => {
        if (ni === 0) return;
        const p1 = getCenter(nodeEls[ni - 1], frame);
        const p2 = getCenter(node, frame);
        const vPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        vPath.setAttribute('d', 'M ' + p1.x + ' ' + (p1.y + 14) + ' L ' + p2.x + ' ' + (p2.y - 14));
        vPath.dataset.level = level;
        vPath.setAttribute('stroke-width', '1');
        svg.appendChild(vPath);
      });
    });

    applyPathHighlight();

    if (animate && typeof gsap !== 'undefined' && !prefersReducedMotion()) {
      gsap.fromTo(svg.querySelectorAll('path'),
        { strokeDashoffset: 1000, strokeDasharray: 1000 },
        { strokeDashoffset: 0, duration: 1, ease: 'power2.out', stagger: 0.06, onComplete: () => {
          svg.querySelectorAll('path').forEach((p) => p.classList.add('mm-drawn'));
        }},
      );
    } else {
      svg.querySelectorAll('path').forEach((p) => {
        p.classList.add('mm-drawn');
        p.style.strokeDashoffset = '0';
      });
    }
  }

  function applyPathHighlight() {
    document.querySelectorAll('.mindmap-svg path').forEach((path) => {
      const pl = path.dataset.level;
      const active = activeLevel === 'all' || pl === activeLevel || pl === 'bridge-' + activeLevel;
      path.classList.toggle('mm-active', active);
      path.classList.toggle('mm-dim', activeLevel !== 'all' && !active);
    });
  }

  function animateIn() {
    if (typeof gsap === 'undefined') return;
    gsap.timeline({ defaults: { ease: 'power2.out' } })
      .to('#mindmap-hub', { opacity: 1, scale: 1, duration: 0.5 })
      .to('.mindmap-col-head', { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 }, '-=0.25')
      .to('.mindmap-node', { opacity: 1, x: 0, duration: 0.3, stagger: 0.03 }, '-=0.2')
      .to('#mindmap-hint', { opacity: 1, duration: 0.35 }, '-=0.1');
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  async function init() {
    const mount = document.querySelector('.mindmap-mount');
    if (!mount) return;

    try {
      const res = await fetch('/skills.json');
      if (!res.ok) throw new Error('skills.json');
      const data = await res.json();
      skillsById = Object.fromEntries((data.skills || []).map((s) => [s.id, s]));
      const levels = data.skillLevels || [];
      if (!levels.length) {
        mount.innerHTML = '<p class="text-muted">Mind map unavailable.</p>';
        return;
      }
      buildMindMap(levels);
    } catch (err) {
      mount.innerHTML = '<p class="text-muted">Could not load skill journey map.</p>';
      console.error(err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

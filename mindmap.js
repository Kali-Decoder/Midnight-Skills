/**
 * Animated skill journey mind map — loads skillLevels from skills.json
 */
(function () {
  const LEVEL_COLORS = {
    beginner: '#7ec8e3',
    intermediate: '#ffd400',
    advanced: '#b8e986',
  };

  let activeLevel = 'all';
  let skillsById = {};

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

  function buildMindMap(levels) {
    const section = document.getElementById('mindmap-section');
    if (!section || !levels.length) return;

    const controls = document.createElement('div');
    controls.className = 'mindmap-controls';
    controls.setAttribute('role', 'tablist');
    controls.setAttribute('aria-label', 'Skill level');

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'mindmap-level-btn active';
    allBtn.dataset.level = 'all';
    allBtn.innerHTML = '<span class="level-dot" style="background:var(--accent)"></span> All levels';
    controls.appendChild(allBtn);

    levels.forEach((lvl) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mindmap-level-btn';
      btn.dataset.level = lvl.id;
      btn.style.setProperty('--level-color', lvl.color || LEVEL_COLORS[lvl.id]);
      btn.innerHTML =
        '<span class="level-dot"></span> ' + esc(lvl.title);
      controls.appendChild(btn);
    });

    const frame = document.createElement('div');
    frame.className = 'mindmap-frame';
    frame.id = 'mindmap-frame';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mindmap-svg');
    svg.setAttribute('aria-hidden', 'true');
    frame.appendChild(svg);

    const grid = document.createElement('div');
    grid.className = 'mindmap-grid';
    grid.id = 'mindmap-grid';

    const hub = document.createElement('div');
    hub.className = 'mindmap-hub';
    hub.id = 'mindmap-hub';
    hub.innerHTML =
      '<span class="mindmap-hub-label">You are here</span>' +
      '<span class="mindmap-hub-title">Start</span>';
    grid.appendChild(hub);

    levels.forEach((lvl) => {
      const col = document.createElement('div');
      col.className = 'mindmap-column';
      col.dataset.level = lvl.id;

      const head = document.createElement('div');
      head.className = 'mindmap-col-head';
      head.dataset.level = lvl.id;
      head.innerHTML =
        '<div class="mindmap-col-title">' + esc(lvl.title) + '</div>' +
        '<div class="mindmap-col-sub">' + esc(lvl.subtitle || '') + '</div>';
      col.appendChild(head);

      const nodes = document.createElement('div');
      nodes.className = 'mindmap-nodes';

      (lvl.skills || []).forEach((step) => {
        const skill = skillsById[step.skillId];
        if (!skill || skill.enabled === false) return;
        const a = document.createElement('a');
        a.className = 'mindmap-node';
        a.href = 'skill.html?name=' + encodeURIComponent(step.skillId);
        a.dataset.level = lvl.id;
        a.style.setProperty('--node-color', lvl.color || LEVEL_COLORS[lvl.id]);
        a.innerHTML =
          '<div class="mindmap-node-name">' + esc(skill.name) + '</div>' +
          '<div class="mindmap-node-desc">' +
          esc(step.summary || skill.description || '') +
          '</div>';
        nodes.appendChild(a);
      });

      col.appendChild(nodes);
      grid.appendChild(col);
    });

    frame.appendChild(grid);

    const hint = document.createElement('p');
    hint.className = 'mindmap-progress-hint';
    hint.id = 'mindmap-hint';
    hint.innerHTML =
      'Follow the path <strong>Beginner → Intermediate → Advanced</strong> — click any skill to open it.';

    const mount = section.querySelector('.mindmap-mount');
    if (mount) mount.innerHTML = '';
    mount.appendChild(controls);
    mount.appendChild(frame);
    mount.appendChild(hint);

    controls.querySelectorAll('.mindmap-level-btn').forEach((btn) => {
      btn.addEventListener('click', () => setActiveLevel(btn.dataset.level));
    });

    if (!prefersReducedMotion()) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          drawConnectors();
          animateIn();
        });
      });
    } else {
      document.querySelectorAll('.mindmap-hub, .mindmap-col-head, .mindmap-node, .mindmap-progress-hint').forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }

    window.addEventListener('resize', debounce(drawConnectors, 150));
  }

  function setActiveLevel(level) {
    activeLevel = level;
    document.querySelectorAll('.mindmap-level-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.level === level);
    });

    document.querySelectorAll('.mindmap-column').forEach((col) => {
      col.classList.toggle('dimmed', level !== 'all' && col.dataset.level !== level);
    });

    document.querySelectorAll('.mindmap-node').forEach((node) => {
      node.classList.toggle('highlight', level !== 'all' && node.dataset.level === level);
    });

    document.querySelectorAll('.mindmap-svg path').forEach((path) => {
      const pl = path.dataset.level;
      path.classList.toggle('mm-active', level === 'all' || pl === level || pl === 'bridge-' + level);
    });

    const hint = document.getElementById('mindmap-hint');
    if (!hint) return;
    if (level === 'all') {
      hint.innerHTML =
        'Follow the path <strong>Beginner → Intermediate → Advanced</strong> — click any skill to open it.';
    } else {
      const titles = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
      hint.innerHTML =
        'Showing <strong>' + (titles[level] || level) + '</strong> skills — complete these before moving to the next level.';
    }

    if (typeof gsap !== 'undefined' && !prefersReducedMotion()) {
      gsap.fromTo(hint, { opacity: 0.5, y: 4 }, { opacity: 1, y: 0, duration: 0.3 });
    }
  }

  function getCenter(el, frame) {
    const er = el.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    return {
      x: er.left + er.width / 2 - fr.left,
      y: er.top + er.height / 2 - fr.top,
    };
  }

  function drawConnectors() {
    const frame = document.getElementById('mindmap-frame');
    const svg = frame?.querySelector('.mindmap-svg');
    const hub = document.getElementById('mindmap-hub');
    if (!frame || !svg || !hub || window.innerWidth <= 820) {
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
      const d =
        'M ' + hubC.x + ' ' + hubC.y +
        ' C ' + midX + ' ' + hubC.y +
        ', ' + midX + ' ' + headC.y +
        ', ' + headC.x + ' ' + headC.y;
      path.setAttribute('d', d);
      path.dataset.level = level;
      svg.appendChild(path);

      if (i > 0) {
        const prevHead = cols[i - 1].querySelector('.mindmap-col-head');
        if (prevHead) {
          const prevC = getCenter(prevHead, frame);
          const bridge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const bridgeD =
            'M ' + (prevC.x + 40) + ' ' + prevC.y +
            ' Q ' + ((prevC.x + headC.x) / 2) + ' ' + (prevC.y - 28) +
            ', ' + (headC.x - 40) + ' ' + headC.y;
          bridge.setAttribute('d', bridgeD);
          bridge.dataset.level = 'bridge-' + level;
          bridge.setAttribute('stroke-dasharray', '4 6');
          svg.appendChild(bridge);
        }
      }

      const nodeEls = col.querySelectorAll('.mindmap-node');
      nodeEls.forEach((node, ni) => {
        if (ni === 0) return;
        const prev = nodeEls[ni - 1];
        const p1 = getCenter(prev, frame);
        const p2 = getCenter(node, frame);
        const vPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        vPath.setAttribute(
          'd',
          'M ' + p1.x + ' ' + (p1.y + 12) + ' L ' + p2.x + ' ' + (p2.y - 12),
        );
        vPath.dataset.level = level;
        vPath.setAttribute('stroke-width', '1');
        svg.appendChild(vPath);
      });
    });

    if (typeof gsap !== 'undefined' && !prefersReducedMotion()) {
      gsap.fromTo(
        svg.querySelectorAll('path'),
        { strokeDashoffset: 1000 },
        { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out', stagger: 0.08, delay: 0.4 },
      );
    }
  }

  function animateIn() {
    if (typeof gsap === 'undefined') return;

    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    tl.to('#mindmap-hub', { opacity: 1, scale: 1, duration: 0.5 })
      .to('.mindmap-col-head', { opacity: 1, y: 0, duration: 0.45, stagger: 0.12 }, '-=0.2')
      .to('.mindmap-node', { opacity: 1, x: 0, duration: 0.35, stagger: 0.04 }, '-=0.15')
      .to('#mindmap-hint', { opacity: 1, duration: 0.4 }, '-=0.1');
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
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

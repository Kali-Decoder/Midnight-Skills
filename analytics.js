(() => {
  const STORAGE_KEY = "ms_anon_id";
  const GH_KEY = "ms_github_username";

  function isValidGithubUsername(name) {
    if (typeof name !== "string") return false;
    const n = name.trim();
    if (!n) return false;
    if (n.length > 39) return false;
    // GitHub username rules: alnum or single hyphens, no leading/trailing hyphen, no consecutive hyphens.
    return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(n);
  }

  function getAnonId() {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      const id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
      return id;
    } catch {
      return null;
    }
  }

  function getGithubUsername() {
    try {
      const v = localStorage.getItem(GH_KEY);
      return isValidGithubUsername(v) ? v.trim() : null;
    } catch {
      return null;
    }
  }

  async function upsertUser(anonId, githubUsername) {
    try {
      if (!anonId || !githubUsername) return;
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anon_id: anonId,
          github_username: githubUsername,
          page_path: window.location.pathname,
          referrer: document.referrer || null,
        }),
        keepalive: true,
      });
    } catch {
      // no-op
    }
  }

  function postEvent(payload) {
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/track", blob);
        return;
      }
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // no-op
    }
  }

  function track(event, data = {}) {
    const anonId = getAnonId();
    const githubUsername = getGithubUsername();
    const payload = {
      event,
      anon_id: anonId,
      github_username: githubUsername,
      page_path: window.location.pathname,
      referrer: document.referrer || null,
      ...data,
    };
    postEvent(payload);
    return anonId;
  }

  function ensureGithubUsername({ force = false } = {}) {
    const existing = getGithubUsername();
    if (existing && !force) return Promise.resolve(existing);

    return new Promise((resolve) => {
      const prev = document.getElementById("ms-gh-modal");
      if (prev) prev.remove();

      const wrap = document.createElement("div");
      wrap.id = "ms-gh-modal";
      wrap.style.cssText = [
        "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;",
        "background:rgba(0,0,0,0.86);padding:24px;"
      ].join("");

      const box = document.createElement("div");
      box.style.cssText = [
        "width:min(520px,100%);border:1px solid #ffd400;border-radius:6px;",
        "background:#0b0b0b;color:#fff6bf;padding:18px 18px 14px;"
      ].join("");

      box.innerHTML = `
        <div style="color:#ffd400;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:12px;margin-bottom:10px;">
          Identify Yourself
        </div>
        <div style="color:#cbbf76;font-size:12px;line-height:1.5;margin-bottom:10px;">
          Enter your GitHub username to track skill usage by user. Stored in your browser and in our analytics DB.
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="ms-gh-input" placeholder="github-username" autocomplete="off"
            style="flex:1;background:transparent;border:1px solid #3a2f00;border-radius:4px;padding:10px;color:#fff6bf;font-family:inherit;font-size:13px;outline:none;">
          <button id="ms-gh-save"
            style="background:transparent;border:1px solid #3a2f00;border-radius:4px;padding:10px 12px;color:#ffd400;font-family:inherit;font-size:13px;cursor:pointer;">
            Save
          </button>
        </div>
        <div id="ms-gh-err" style="margin-top:8px;color:#ffd400;font-size:12px;min-height:16px;"></div>
      `;

      wrap.appendChild(box);
      document.body.appendChild(wrap);

      const input = document.getElementById("ms-gh-input");
      const save = document.getElementById("ms-gh-save");
      const err = document.getElementById("ms-gh-err");

      const finish = async (value) => {
        wrap.remove();
        if (!value) return resolve(null);
        try { localStorage.setItem(GH_KEY, value); } catch {}
        const anonId = getAnonId();
        upsertUser(anonId, value);
        try { track("user_identified", { github_username: value }); } catch {}
        resolve(value);
      };

      const validate = (value) => {
        if (isValidGithubUsername(value)) return value.trim();
        return null;
      };

      const onSave = () => {
        const v = validate(input.value);
        if (!v) {
          err.textContent = "Invalid GitHub username.";
          input.style.borderColor = "#ffd400";
          return;
        }
        finish(v);
      };

      save.addEventListener("click", onSave);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") onSave();
      });
      wrap.addEventListener("click", (e) => {
        // Require a username for interactions; don't allow backdrop click to dismiss.
        e.stopPropagation();
      });

      // Pre-fill if something exists but invalid (let user fix)
      try { input.value = (localStorage.getItem(GH_KEY) || "").trim(); } catch {}
      setTimeout(() => input.focus(), 0);
    });
  }

  window.MidnightAnalytics = {
    track,
    getAnonId,
    getGithubUsername,
    ensureGithubUsername,
  };
})();

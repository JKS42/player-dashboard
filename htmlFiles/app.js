/*
 * Player Dashboard - core renderer.
 *
 * Responsibilities: local login/sign-up gating, per-user state load/save,
 * XP/level math, the panel (tab) registry that feature modules plug into,
 * theme/layout application, and shared UI helpers (modal, toast, DOM builder).
 *
 * Feature modules (features/*.js) load after this file and call
 * App.registerPanel(...) to add their tab. Anything visual is intentionally
 * minimal here - the default layout/design is left to be styled separately.
 */
const App = (() => {
  const api = window.api;

  let state = null;
  let currentUser = null;
  let activePanelId = null;
  let saveTimer = null;
  let emitting = false;

  const panels = [];
  const listeners = {};
  const iconCache = {};

  // ---- tiny DOM helper -----------------------------------------------------
  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else node.setAttribute(k, v);
      }
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  // ---- misc helpers --------------------------------------------------------
  const uid = () => Math.random().toString(36).slice(2, 10);
  const today = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const fmtMoney = (n) =>
    `${(state && state.wallet && state.wallet.currency) || '$'}${Number(n || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}`;

  async function getIcon(name) {
    if (name in iconCache) return iconCache[name];
    try {
      const res = await fetch(`../assets/icons/${name}.svg`);
      iconCache[name] = res.ok ? await res.text() : '';
    } catch {
      iconCache[name] = '';
    }
    return iconCache[name];
  }

  // ---- events --------------------------------------------------------------
  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
  }
  function emit(evt) {
    const ls = listeners[evt] || [];
    if (evt === 'change') {
      if (emitting) return;
      emitting = true;
      try {
        ls.forEach((f) => f());
      } finally {
        emitting = false;
      }
    } else ls.forEach((f) => f());
  }

  // ---- default state -------------------------------------------------------
  function defaultState(username) {
    return {
      profile: { name: username || 'Player', title: 'Novice', level: 1, xp: 0 },
      settings: { theme: 'rpg', layout: 'grid' },
      stats: [
        { id: 'strength', label: 'Strength', level: 1, xp: 0 },
        { id: 'intellect', label: 'Intellect', level: 1, xp: 0 },
        { id: 'discipline', label: 'Discipline', level: 1, xp: 0 },
        { id: 'social', label: 'Social', level: 1, xp: 0 },
        { id: 'health', label: 'Health', level: 1, xp: 0 },
      ],
      quests: [],
      dailyGoals: [],
      longGoals: [],
      reminders: [
        { id: uid(), label: 'Daily check-in', time: '09:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true },
      ],
      wallet: {
        currency: '$',
        monthlySalary: 0,
        balance: 0,
        budget: 0,
        lastSalaryCredit: null,
        categories: ['Rent', 'Food', 'Fun', 'Savings'],
        transactions: [],
      },
      streak: { count: 0, lastCheckIn: null },
      achievements: [],
      log: [],
    };
  }

  function mergeState(loaded, username) {
    const d = defaultState(username);
    if (!loaded || typeof loaded !== 'object') return d;
    return {
      ...d,
      ...loaded,
      profile: { ...d.profile, ...(loaded.profile || {}) },
      settings: { ...d.settings, ...(loaded.settings || {}) },
      wallet: { ...d.wallet, ...(loaded.wallet || {}) },
      streak: { ...d.streak, ...(loaded.streak || {}) },
    };
  }

  // ---- XP / levels ---------------------------------------------------------
  const xpForLevel = (level) => Math.floor(100 * Math.pow(level, 1.5));

  function addXp(target, amount) {
    target.xp += amount;
    let leveled = false;
    while (target.xp >= xpForLevel(target.level)) {
      target.xp -= xpForLevel(target.level);
      target.level += 1;
      leveled = true;
    }
    return leveled;
  }

  function awardXp(statId, amount, reason) {
    if (!amount) return;
    if (statId) {
      const s = state.stats.find((x) => x.id === statId);
      if (s && addXp(s, amount)) {
        toast(`${s.label} reached level ${s.level}!`);
      }
    }
    if (addXp(state.profile, amount)) {
      toast(`Level up! You are now level ${state.profile.level}`);
      api.notify('Level Up!', `You reached level ${state.profile.level}`);
    }
    addLog(`${reason || 'XP gained'} (+${amount} XP)`);
  }

  function addLog(text) {
    state.log.unshift({ ts: Date.now(), text });
    state.log = state.log.slice(0, 150);
  }

  // ---- persistence ---------------------------------------------------------
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => api.saveState(state), 250);
  }
  function commit() {
    refresh();
    save();
  }

  // ---- appearance ----------------------------------------------------------
  function applyAppearance() {
    document.documentElement.dataset.theme = (state.settings && state.settings.theme) || 'rpg';
    document.documentElement.dataset.layout = (state.settings && state.settings.layout) || 'grid';
  }

  // Replace the whole state (used by data import) and re-render everything.
  function replaceState(newState) {
    state = mergeState(newState, currentUser && currentUser.username);
    applyAppearance();
    emit('boot');
    activePanelId = sortedPanels().length ? sortedPanels()[0].id : null;
    renderTopbar();
    renderTabs();
    renderActivePanel();
    api.setReminders(state.reminders || []);
    save();
  }

  // Reset to first-run defaults (used by the Reset button).
  function reseed() {
    replaceState(defaultState(currentUser && currentUser.username));
  }

  // ---- panel registry ------------------------------------------------------
  function registerPanel(panel) {
    // panel: { id, label, icon, order, render(container) }
    panels.push(panel);
  }
  function sortedPanels() {
    return [...panels].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function renderTabs() {
    const host = document.getElementById('tabs');
    host.innerHTML = '';
    sortedPanels().forEach((p) => {
      const iconSpan = el('span', { class: 'tab-icon' });
      const btn = el(
        'button',
        {
          class: 'tab' + (p.id === activePanelId ? ' active' : ''),
          'data-panel': p.id,
          onclick: () => showPanel(p.id),
        },
        iconSpan,
        el('span', { class: 'tab-label' }, p.label)
      );
      host.append(btn);
      getIcon(p.icon).then((svg) => {
        if (svg) iconSpan.innerHTML = svg;
      });
    });
  }

  function renderActivePanel() {
    const host = document.getElementById('panel-host');
    host.innerHTML = '';
    const p = sortedPanels().find((x) => x.id === activePanelId);
    if (!p) return;
    const wrap = el('section', { class: 'panel', 'data-panel': p.id });
    host.append(wrap);
    p.render(wrap);
  }

  function showPanel(id) {
    activePanelId = id;
    renderTabs();
    renderActivePanel();
  }

  // ---- top bar -------------------------------------------------------------
  function xpBar(cur, max) {
    const pct = Math.max(0, Math.min(100, (cur / max) * 100));
    return el('div', { class: 'xpbar' }, el('div', { class: 'xpbar-fill', style: `width:${pct}%` }));
  }

  function renderTopbar() {
    const host = document.getElementById('topbar');
    if (!host) return;
    host.innerHTML = '';
    const p = state.profile;
    const initials = (p.name || '?').trim().slice(0, 2).toUpperCase();
    host.append(
      el('div', { class: 'tb-avatar' }, initials),
      el(
        'div',
        { class: 'tb-identity' },
        el('div', { class: 'tb-name' }, p.name),
        el('div', { class: 'tb-title' }, p.title)
      ),
      el(
        'div',
        { class: 'tb-xp' },
        el('div', { class: 'tb-level' }, `Level ${p.level}`),
        xpBar(p.xp, xpForLevel(p.level)),
        el('div', { class: 'tb-xp-text' }, `${p.xp} / ${xpForLevel(p.level)} XP`)
      ),
      el('button', { class: 'btn ghost', onclick: logout }, 'Log out')
    );
  }

  function refresh() {
    if (!state) return;
    emit('change');
    renderTopbar();
    renderTabs();
    renderActivePanel();
  }

  // ---- modal ---------------------------------------------------------------
  function openModal(title, contentEl) {
    const host = document.getElementById('modal-host');
    host.innerHTML = '';
    const wrap = el(
      'div',
      { class: 'modal' },
      el(
        'div',
        { class: 'modal-head' },
        el('h3', null, title),
        el('button', { class: 'icon-btn', onclick: closeModal }, '\u2715')
      ),
      el('div', { class: 'modal-body' }, contentEl)
    );
    host.append(wrap);
    host.hidden = false;
    host.onclick = (e) => {
      if (e.target === host) closeModal();
    };
  }
  function closeModal() {
    const host = document.getElementById('modal-host');
    host.hidden = true;
    host.innerHTML = '';
  }

  // ---- toast ---------------------------------------------------------------
  function toast(msg) {
    const host = document.getElementById('toast-host');
    const t = el('div', { class: 'toast' }, msg);
    host.append(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 2600);
  }

  // ---- auth ----------------------------------------------------------------
  async function init() {
    const accounts = await api.listAccounts();
    setupAuthView(accounts.length === 0);
  }

  function setupAuthView(signupMode) {
    const view = document.getElementById('auth-view');
    const appView = document.getElementById('app-view');
    appView.hidden = true;
    view.hidden = false;

    const form = document.getElementById('auth-form');
    const subtitle = document.getElementById('auth-subtitle');
    const submit = document.getElementById('auth-submit');
    const toggle = document.getElementById('auth-toggle');
    const errEl = document.getElementById('auth-error');

    let mode = signupMode ? 'signup' : 'login';
    const apply = () => {
      subtitle.textContent = mode === 'signup' ? 'Create your local account' : 'Log in to continue';
      submit.textContent = mode === 'signup' ? 'Sign up' : 'Log in';
      toggle.textContent =
        mode === 'signup' ? 'Have an account? Log in' : 'Need an account? Sign up';
      errEl.hidden = true;
    };
    apply();

    toggle.onclick = () => {
      mode = mode === 'signup' ? 'login' : 'signup';
      apply();
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      errEl.hidden = true;
      const username = document.getElementById('auth-username').value.trim();
      const password = document.getElementById('auth-password').value;
      if (!username || !password) return;
      const res =
        mode === 'signup' ? await api.signup(username, password) : await api.login(username, password);
      if (!res.ok) {
        errEl.textContent = res.error || 'Something went wrong.';
        errEl.hidden = false;
        return;
      }
      form.reset();
      await startDashboard(res.user);
    };
  }

  async function startDashboard(user) {
    currentUser = user;
    const loaded = await api.loadState();
    state = mergeState(loaded, user.username);

    applyAppearance();
    emit('boot'); // feature modules run rollover/migrations (daily reset, salary, etc.)

    document.getElementById('auth-view').hidden = true;
    document.getElementById('app-view').hidden = false;

    if (!activePanelId && panels.length) activePanelId = sortedPanels()[0].id;

    renderTopbar();
    renderTabs();
    renderActivePanel();

    api.setReminders(state.reminders || []);
    save();
  }

  async function logout() {
    await api.logout();
    state = null;
    currentUser = null;
    activePanelId = null;
    setupAuthView(false);
  }

  // ---- public API ----------------------------------------------------------
  const App = {
    init,
    registerPanel,
    openModal,
    closeModal,
    refresh,
    commit,
    save,
    applyAppearance,
    replaceState,
    reseed,
    awardXp,
    addXp,
    xpForLevel,
    addLog,
    toast,
    notify: (t, b) => api.notify(t, b),
    setReminders: (r) => api.setReminders(r),
    exportData: () => api.exportData(state),
    importData: () => api.importData(),
    resetState: () => api.resetState(),
    on,
    emit,
    el,
    uid,
    today,
    monthKey,
    fmtMoney,
    xpBar,
    getIcon,
    showPanel,
    get state() {
      return state;
    },
    get user() {
      return currentUser;
    },
  };
  window.addEventListener('DOMContentLoaded', () => App.init());
  return App;
})();

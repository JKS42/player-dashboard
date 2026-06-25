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

  // ---- Class progression ---------------------------------------------------
  // Class is derived from level and cannot be edited; it upgrades automatically.
  const CLASS_TIERS = [
    { min: 1, name: 'Novice' },
    { min: 5, name: 'Apprentice' },
    { min: 10, name: 'Adept' },
    { min: 20, name: 'Expert' },
    { min: 30, name: 'Master' },
    { min: 50, name: 'Grandmaster' },
    { min: 75, name: 'Legend' },
  ];
  function classForLevel(level) {
    let name = CLASS_TIERS[0].name;
    for (const t of CLASS_TIERS) if (level >= t.min) name = t.name;
    return name;
  }
  function syncClass() {
    if (state && state.profile) state.profile.title = classForLevel(state.profile.level);
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
      const newClass = classForLevel(state.profile.level);
      const upgraded = state.profile.title !== newClass;
      state.profile.title = newClass;
      toast(`Level up! You are now level ${state.profile.level}`);
      if (upgraded) {
        toast(`Class upgraded to ${newClass}!`);
        addLog(`Class upgraded to ${newClass}`);
      }
      api.notify('Level Up!', `Level ${state.profile.level}${upgraded ? ' \u2013 ' + newClass : ''}`);
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
    syncClass();
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
    if (api.onPromptTomorrow) api.onPromptTomorrow(() => promptTomorrowGoals());
    await setupAuthView();
  }

  // Auth view has three modes:
  //   picker - choose an existing account or "Add another account"
  //   login  - enter the password for a chosen account
  //   signup - create a brand new account
  async function setupAuthView() {
    const view = document.getElementById('auth-view');
    const appView = document.getElementById('app-view');
    appView.hidden = true;
    view.hidden = false;

    const form = document.getElementById('auth-form');
    const subtitle = document.getElementById('auth-subtitle');
    const submit = document.getElementById('auth-submit');
    const toggle = document.getElementById('auth-toggle');
    const errEl = document.getElementById('auth-error');
    const accountsEl = document.getElementById('auth-accounts');
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');

    const accounts = await api.listAccounts();
    let mode = accounts.length ? 'picker' : 'signup';

    function renderAccounts() {
      accountsEl.innerHTML = '';
      accounts.forEach((a) => {
        accountsEl.append(
          el(
            'button',
            { type: 'button', class: 'account-chip', onclick: () => selectAccount(a) },
            el('span', { class: 'account-avatar' }, (a.username || '?').slice(0, 2).toUpperCase()),
            el('span', { class: 'account-name' }, a.username)
          )
        );
      });
      accountsEl.append(
        el(
          'button',
          { type: 'button', class: 'account-chip add', onclick: () => setMode('signup') },
          el('span', { class: 'account-avatar' }, '+'),
          el('span', { class: 'account-name' }, 'Add another account')
        )
      );
    }

    function selectAccount(a) {
      usernameInput.value = a.username;
      setMode('login', true);
      passwordInput.focus();
    }

    function setMode(next, lockUsername) {
      mode = next;
      errEl.hidden = true;
      const showPicker = mode === 'picker';
      accountsEl.hidden = !showPicker;
      form.hidden = showPicker;
      toggle.hidden = showPicker;

      if (showPicker) {
        subtitle.textContent = 'Choose an account';
        renderAccounts();
        return;
      }

      if (mode === 'login') {
        subtitle.textContent = 'Log in to continue';
        submit.textContent = 'Log in';
        usernameInput.readOnly = !!lockUsername;
        if (!lockUsername) usernameInput.value = '';
      } else {
        subtitle.textContent = 'Create your local account';
        submit.textContent = 'Sign up';
        usernameInput.readOnly = false;
        usernameInput.value = '';
      }
      passwordInput.value = '';
      toggle.textContent = accounts.length
        ? 'Back to accounts'
        : mode === 'signup'
        ? 'Have an account? Log in'
        : 'Need an account? Sign up';
    }

    toggle.onclick = () => {
      if (accounts.length) setMode('picker');
      else setMode(mode === 'signup' ? 'login' : 'signup');
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      errEl.hidden = true;
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) return;
      const isSignup = mode === 'signup';
      const res = isSignup ? await api.signup(username, password) : await api.login(username, password);
      if (!res.ok) {
        errEl.textContent = res.error || 'Something went wrong.';
        errEl.hidden = false;
        return;
      }
      form.reset();
      usernameInput.readOnly = false;
      await startDashboard(res.user, isSignup);
    };

    setMode(mode);
  }

  async function startDashboard(user, isNewAccount) {
    currentUser = user;
    const loaded = await api.loadState();
    state = mergeState(loaded, user.username);
    syncClass();

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

    if (isNewAccount) showOnboarding();
  }

  // ---- onboarding (new accounts) -------------------------------------------
  // Asks a new player for their long-term goals and any reminders they want.
  function showOnboarding() {
    const goals = el('textarea', {
      rows: '4',
      placeholder: 'One goal per line, e.g.\nRun a marathon\nLearn the guitar',
    });

    const remWrap = el('div', {});
    function addReminderRow(label = '', time = '09:00') {
      const labelInput = el('input', { type: 'text', placeholder: 'Reminder (e.g. Drink water)', value: label });
      const timeInput = el('input', { type: 'time', value: time });
      const row = el('div', { class: 'row', style: 'gap:.4rem; margin-bottom:.4rem; align-items:center' }, labelInput, timeInput);
      remWrap.append(row);
    }
    addReminderRow();

    const addBtn = el('button', { type: 'button', class: 'btn', onclick: () => addReminderRow() }, '+ Add reminder');
    const skip = el('button', { type: 'button', class: 'btn ghost', onclick: () => closeModal() }, 'Skip for now');
    const finish = el('button', { type: 'submit', class: 'btn primary' }, 'Finish setup');

    const form = el(
      'form',
      {
        onsubmit: (e) => {
          e.preventDefault();
          goals.value
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((title) => {
              state.longGoals.push({ id: uid(), title, targetDate: null, xp: 500, progress: 0, milestones: [] });
            });
          remWrap.querySelectorAll('.row').forEach((row) => {
            const inputs = row.querySelectorAll('input');
            const label = inputs[0].value.trim();
            const time = inputs[1].value || '09:00';
            if (label) {
              state.reminders.push({ id: uid(), label, time, days: [0, 1, 2, 3, 4, 5, 6], enabled: true });
            }
          });
          closeModal();
          api.setReminders(state.reminders);
          commit();
        },
      },
      el('p', { class: 'muted' }, "Welcome! Let's set up what you're working toward."),
      el('label', { class: 'field' }, el('span', {}, 'Long-term goals (one per line)'), goals),
      el('div', { class: 'field' }, el('span', {}, 'Reminders'), remWrap, addBtn),
      el('div', { class: 'row', style: 'gap:.5rem; justify-content:flex-end; margin-top:.6rem' }, skip, finish)
    );

    openModal('Welcome aboard', form);
  }

  // ---- on-close prompt: plan tomorrow's goals ------------------------------
  function promptTomorrowGoals() {
    if (!state || !currentUser) {
      api.closeNow();
      return;
    }
    const goals = el('textarea', { rows: '4', placeholder: 'One goal per line for tomorrow' });
    const saveBtn = el('button', { type: 'submit', class: 'btn primary' }, 'Save & close');
    const justClose = el(
      'button',
      {
        type: 'button',
        class: 'btn ghost',
        onclick: async () => {
          await api.saveState(state);
          api.closeNow();
        },
      },
      'Just close'
    );

    const form = el(
      'form',
      {
        onsubmit: async (e) => {
          e.preventDefault();
          goals.value
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((title) => {
              state.dailyGoals.push({ id: uid(), title, xp: 30, done: false, lastReset: today() });
            });
          await api.saveState(state);
          api.closeNow();
        },
      },
      el('p', { class: 'muted' }, 'Any goals you want to tackle tomorrow?'),
      el('label', { class: 'field' }, el('span', {}, "Tomorrow's goals (one per line)"), goals),
      el('div', { class: 'row', style: 'gap:.5rem; justify-content:flex-end; margin-top:.6rem' }, justClose, saveBtn)
    );

    openModal('Plan tomorrow', form);
  }

  async function logout() {
    await api.logout();
    state = null;
    currentUser = null;
    activePanelId = null;
    setupAuthView();
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

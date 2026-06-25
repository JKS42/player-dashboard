/* Profile + customization tab: identity, theme/layout, and data management. */
(() => {
  const THEMES = ['rpg', 'modern', 'cyberpunk', 'minimal'];
  const LAYOUTS = ['grid', 'compact', 'sidebar', 'single'];

  function setTheme(value) {
    App.state.settings.theme = value;
    document.documentElement.dataset.theme = value;
    App.save();
  }
  function setLayout(value) {
    App.state.settings.layout = value;
    document.documentElement.dataset.layout = value;
    App.save();
  }

  function picker(label, options, current, onChange) {
    const sel = App.el(
      'select',
      { onchange: (e) => onChange(e.target.value) },
      ...options.map((o) =>
        App.el('option', current === o ? { value: o, selected: 'true' } : { value: o }, o)
      )
    );
    return App.el('label', { class: 'field' }, App.el('span', null, label), sel);
  }

  async function exportData() {
    const res = await App.exportData();
    App.toast(res && res.ok ? 'Data exported.' : 'Export cancelled.');
  }

  async function importData() {
    const res = await App.importData();
    if (res && res.ok && res.state) {
      App.replaceState(res.state);
      App.toast('Data imported.');
    } else if (res && res.error) {
      App.toast(res.error);
    }
  }

  async function resetData() {
    if (!confirm('Reset all progress to defaults? This cannot be undone.')) return;
    await App.resetState();
    App.reseed();
    App.toast('Progress reset.');
  }

  App.registerPanel({
    id: 'profile',
    label: 'Profile',
    icon: 'tab-profile',
    order: 100,
    render(root) {
      const p = App.state.profile;

      // Identity (class is derived from level and cannot be edited)
      const name = App.el('input', { type: 'text', value: p.name });
      const identity = App.el(
        'form',
        {
          onsubmit: (e) => {
            e.preventDefault();
            p.name = name.value.trim() || 'Player';
            App.commit();
            App.toast('Profile updated.');
          },
        },
        App.el('h3', null, 'Identity'),
        App.el('label', { class: 'field' }, App.el('span', null, 'Name'), name),
        App.el(
          'div',
          { class: 'field' },
          App.el('span', null, 'Class'),
          App.el('div', { class: 'row', style: 'gap:.5rem; align-items:baseline' },
            App.el('strong', null, p.title),
            App.el('span', { class: 'muted', style: 'font-size:.75rem' }, `Level ${p.level}`)
          ),
          App.el('p', { class: 'muted', style: 'font-size:.7rem; margin:.2rem 0 0' }, 'Your class upgrades automatically as you level up.')
        ),
        App.el('button', { class: 'btn primary', type: 'submit' }, 'Save profile')
      );

      // Appearance
      const appearance = App.el(
        'div',
        { class: 'card' },
        App.el('h3', null, 'Appearance'),
        picker('Theme', THEMES, App.state.settings.theme, setTheme),
        picker('Layout', LAYOUTS, App.state.settings.layout, setLayout)
      );

      // Data management
      const data = App.el(
        'div',
        { class: 'card' },
        App.el('h3', null, 'Data'),
        App.el(
          'div',
          { class: 'row', style: 'flex-wrap:wrap;gap:.5rem' },
          App.el('button', { class: 'btn', onclick: exportData }, 'Export'),
          App.el('button', { class: 'btn', onclick: importData }, 'Import'),
          App.el('button', { class: 'btn danger', onclick: resetData }, 'Reset')
        ),
        App.el('p', { class: 'muted', style: 'font-size:.75rem' }, 'Export/import a JSON backup, or reset to defaults.')
      );

      root.append(App.el('div', { class: 'card' }, identity), appearance, data);
    },
  });
})();

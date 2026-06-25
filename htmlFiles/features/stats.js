/* Stats panel - RPG attributes, each with its own level + XP bar. */
(() => {
  const slug = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'stat';

  function addStatModal() {
    const name = App.el('input', { type: 'text', required: 'true', placeholder: 'e.g. Creativity' });
    const form = App.el(
      'form',
      {
        onsubmit: (e) => {
          e.preventDefault();
          const label = name.value.trim();
          if (!label) return;
          let id = slug(label);
          while (App.state.stats.some((s) => s.id === id)) id += '-x';
          App.state.stats.push({ id, label, level: 1, xp: 0 });
          App.closeModal();
          App.commit();
        },
      },
      App.el('label', { class: 'field' }, App.el('span', null, 'Stat name'), name),
      App.el('button', { class: 'btn primary', type: 'submit' }, 'Add stat')
    );
    App.openModal('Add Stat', form);
  }

  App.registerPanel({
    id: 'stats',
    label: 'Stats',
    icon: 'tab-stats',
    order: 10,
    render(root) {
      const head = App.el(
        'div',
        { class: 'row spread' },
        App.el('h2', null, 'Attributes'),
        App.el('button', { class: 'btn', onclick: addStatModal }, '+ Add stat')
      );

      const grid = App.el('div', { class: 'stat-grid' });
      App.state.stats.forEach((s) => {
        grid.append(
          App.el(
            'div',
            { class: 'card stat-card' },
            App.el(
              'div',
              { class: 'row spread' },
              App.el('strong', null, s.label),
              App.el('span', { class: 'muted' }, `Lv ${s.level}`)
            ),
            App.xpBar(s.xp, App.xpForLevel(s.level)),
            App.el('div', { class: 'muted', style: 'font-size:.75rem;margin-top:4px' }, `${s.xp} / ${App.xpForLevel(s.level)} XP`)
          )
        );
      });

      root.append(App.el('div', { class: 'card' }, head), grid);
    },
  });
})();

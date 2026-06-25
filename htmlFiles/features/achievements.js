/* Achievements + Activity log. Achievements are evaluated on every change. */
(() => {
  const DEFS = [
    { id: 'first_quest', label: 'First Quest', desc: 'Complete your first quest.', test: (s) => s.log.some((l) => /Completed quest/.test(l.text)) },
    { id: 'level_5', label: 'Rising Star', desc: 'Reach level 5.', test: (s) => s.profile.level >= 5 },
    { id: 'level_10', label: 'Veteran', desc: 'Reach level 10.', test: (s) => s.profile.level >= 10 },
    { id: 'streak_7', label: 'Consistent', desc: 'Reach a 7-day streak.', test: (s) => s.streak.count >= 7 },
    { id: 'first_paycheck', label: 'First Paycheck', desc: 'Receive your first salary.', test: (s) => s.wallet.transactions.some((t) => t.category === 'Salary') },
    { id: 'saver', label: 'Saver', desc: 'Reach a balance of 1000.', test: (s) => s.wallet.balance >= 1000 },
    { id: 'goal_done', label: 'Finisher', desc: 'Complete a long-term goal.', test: (s) => s.log.some((l) => /Goal complete/.test(l.text)) },
  ];

  function unlockedIds() {
    return new Set((App.state.achievements || []).map((a) => a.id));
  }

  function evaluate() {
    const have = unlockedIds();
    DEFS.forEach((def) => {
      if (!have.has(def.id) && def.test(App.state)) {
        App.state.achievements.push({ id: def.id, label: def.label, ts: Date.now() });
        App.awardXp(null, 25, `Achievement: ${def.label}`);
        App.toast(`Achievement unlocked: ${def.label}`);
        App.notify('Achievement unlocked!', def.label);
      }
    });
  }
  App.on('change', evaluate);

  App.registerPanel({
    id: 'achievements',
    label: 'Achievements',
    icon: 'tab-achievements',
    order: 80,
    render(root) {
      const have = unlockedIds();
      const grid = App.el('div', { class: 'badge-grid' });
      DEFS.forEach((def) => {
        const got = have.has(def.id);
        grid.append(
          App.el(
            'div',
            { class: 'card badge' + (got ? ' unlocked' : ' locked'), style: got ? '' : 'opacity:.5' },
            App.el('strong', null, def.label),
            App.el('div', { class: 'muted', style: 'font-size:.75rem' }, def.desc),
            App.el('div', { style: `font-size:.7rem;color:${got ? 'var(--good)' : 'var(--muted)'}` }, got ? 'Unlocked' : 'Locked')
          )
        );
      });
      root.append(App.el('div', { class: 'card' }, App.el('h2', null, 'Achievements')), grid);
    },
  });

  App.registerPanel({
    id: 'activity',
    label: 'Activity',
    icon: 'tab-activity',
    order: 90,
    render(root) {
      const card = App.el('div', { class: 'card' }, App.el('h2', null, 'Activity Log'));
      if (!App.state.log.length) {
        card.append(App.el('p', { class: 'muted' }, 'No activity yet.'));
      } else {
        App.state.log.forEach((entry) => {
          card.append(
            App.el(
              'div',
              { class: 'row spread log-row', style: 'padding:.25rem 0;border-bottom:1px solid var(--border)' },
              App.el('span', null, entry.text),
              App.el('span', { class: 'muted', style: 'font-size:.7rem' }, new Date(entry.ts).toLocaleString())
            )
          );
        });
      }
      root.append(card);
    },
  });
})();

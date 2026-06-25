/* Daily goals - reset every day at midnight; finishing them all gives a bonus. */
(() => {
  // Midnight rollover: runs on boot (and whenever the panel renders on a new day).
  function rollover() {
    const t = App.today();
    let changed = false;
    App.state.dailyGoals.forEach((g) => {
      if (g.lastReset !== t) {
        g.done = false;
        g.lastReset = t;
        changed = true;
      }
    });
    if (changed) App.save();
  }
  App.on('boot', rollover);

  function allDone() {
    return App.state.dailyGoals.length > 0 && App.state.dailyGoals.every((g) => g.done);
  }

  function toggle(g) {
    const wasAllDone = allDone();
    g.done = !g.done;
    if (g.done) {
      App.awardXp(null, g.xp, `Daily goal: ${g.title}`);
      App.notify('Daily goal done', `${g.title} (+${g.xp} XP)`);
    }
    if (!wasAllDone && allDone()) {
      App.awardXp(null, 50, 'Daily Complete bonus');
      App.toast('Daily Complete! Bonus XP awarded.');
      App.notify('Daily Complete!', 'All daily goals done \u2013 bonus XP awarded.');
      if (App.checkIn && !App.hasCheckedInToday()) App.checkIn();
    }
    App.commit();
  }

  function remove(id) {
    App.state.dailyGoals = App.state.dailyGoals.filter((g) => g.id !== id);
    App.commit();
  }

  function addModal() {
    const title = App.el('input', { type: 'text', required: 'true', placeholder: 'e.g. Read 20 pages' });
    const xp = App.el('input', { type: 'number', min: '1', value: '30' });
    const form = App.el(
      'form',
      {
        onsubmit: (e) => {
          e.preventDefault();
          if (!title.value.trim()) return;
          App.state.dailyGoals.push({
            id: App.uid(),
            title: title.value.trim(),
            xp: Math.max(1, parseInt(xp.value, 10) || 1),
            done: false,
            lastReset: App.today(),
          });
          App.closeModal();
          App.commit();
        },
      },
      App.el('label', { class: 'field' }, App.el('span', null, 'Goal'), title),
      App.el('label', { class: 'field' }, App.el('span', null, 'XP reward'), xp),
      App.el('button', { class: 'btn primary', type: 'submit' }, 'Add daily goal')
    );
    App.openModal('Add Daily Goal', form);
  }

  App.registerPanel({
    id: 'daily-goals',
    label: 'Daily Goals',
    icon: 'tab-goals',
    order: 40,
    render(root) {
      rollover();
      const head = App.el(
        'div',
        { class: 'row spread' },
        App.el('h2', null, 'Daily Goals'),
        App.el('button', { class: 'btn', onclick: addModal }, '+ Add daily goal')
      );
      const list = App.el('div', { class: 'daily-goal-list' });
      if (!App.state.dailyGoals.length) {
        list.append(App.el('p', { class: 'muted' }, 'No daily goals yet.'));
      } else {
        App.state.dailyGoals.forEach((g) => {
          const cb = App.el('input', { type: 'checkbox', onchange: () => toggle(g) });
          if (g.done) cb.checked = true;
          list.append(
            App.el(
              'label',
              { class: 'row spread daily-goal-row' },
              App.el('span', { class: 'row' }, cb, App.el('span', null, ` ${g.title} (+${g.xp} XP)`)),
              App.el('button', { class: 'icon-btn', onclick: (e) => { e.preventDefault(); remove(g.id); } }, '\u2715')
            )
          );
        });
      }
      const status = allDone()
        ? App.el('p', { class: 'good', style: 'color:var(--good)' }, 'All daily goals complete!')
        : null;
      root.append(App.el('div', { class: 'card' }, head, list, status));
    },
  });
})();

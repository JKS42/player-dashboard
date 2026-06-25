/* Long-term goals - milestones, target date, and a progress bar. */
(() => {
  function progressOf(g) {
    if (!g.milestones || !g.milestones.length) return g.progress || 0;
    const done = g.milestones.filter((m) => m.done).length;
    return done / g.milestones.length;
  }

  function toggleMilestone(g, m) {
    const wasComplete = progressOf(g) >= 1;
    m.done = !m.done;
    if (m.done) {
      App.awardXp(null, Math.round(g.xp / Math.max(1, g.milestones.length)), `Milestone: ${m.label}`);
      App.notify('Milestone reached', `${g.title}: ${m.label}`);
    }
    if (!wasComplete && progressOf(g) >= 1) {
      App.awardXp(null, Math.round(g.xp / 2), `Goal complete: ${g.title}`);
      App.notify('Goal complete!', g.title);
    }
    App.commit();
  }

  function remove(id) {
    App.state.longGoals = App.state.longGoals.filter((g) => g.id !== id);
    App.commit();
  }

  function addModal() {
    const title = App.el('input', { type: 'text', required: 'true', placeholder: 'e.g. Run a half-marathon' });
    const date = App.el('input', { type: 'date' });
    const xp = App.el('input', { type: 'number', min: '1', value: '500' });
    const milestones = App.el('input', { type: 'text', placeholder: 'Run 5k, Run 10k, Run 15k' });
    const form = App.el(
      'form',
      {
        onsubmit: (e) => {
          e.preventDefault();
          if (!title.value.trim()) return;
          const ms = milestones.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((label) => ({ label, done: false }));
          App.state.longGoals.push({
            id: App.uid(),
            title: title.value.trim(),
            targetDate: date.value || null,
            xp: Math.max(1, parseInt(xp.value, 10) || 1),
            progress: 0,
            milestones: ms,
          });
          App.closeModal();
          App.commit();
        },
      },
      App.el('label', { class: 'field' }, App.el('span', null, 'Goal'), title),
      App.el('label', { class: 'field' }, App.el('span', null, 'Target date'), date),
      App.el('label', { class: 'field' }, App.el('span', null, 'XP reward'), xp),
      App.el('label', { class: 'field' }, App.el('span', null, 'Milestones (comma separated)'), milestones),
      App.el('button', { class: 'btn primary', type: 'submit' }, 'Add goal')
    );
    App.openModal('Add Long-term Goal', form);
  }

  function goalCard(g) {
    const pct = Math.round(progressOf(g) * 100);
    const msList = App.el('div', { class: 'milestones' });
    (g.milestones || []).forEach((m) => {
      const cb = App.el('input', { type: 'checkbox', onchange: () => toggleMilestone(g, m) });
      if (m.done) cb.checked = true;
      msList.append(App.el('label', { class: 'row' }, cb, App.el('span', null, ` ${m.label}`)));
    });
    return App.el(
      'div',
      { class: 'card' },
      App.el(
        'div',
        { class: 'row spread' },
        App.el('strong', null, g.title),
        App.el('button', { class: 'icon-btn', onclick: () => remove(g.id) }, '\u2715')
      ),
      g.targetDate ? App.el('div', { class: 'muted', style: 'font-size:.75rem' }, `Target: ${g.targetDate}`) : null,
      App.xpBar(pct, 100),
      App.el('div', { class: 'muted', style: 'font-size:.75rem;margin:4px 0' }, `${pct}% complete`),
      msList
    );
  }

  App.registerPanel({
    id: 'long-goals',
    label: 'Long-term Goals',
    icon: 'tab-goals',
    order: 50,
    render(root) {
      const head = App.el(
        'div',
        { class: 'row spread' },
        App.el('h2', null, 'Long-term Goals'),
        App.el('button', { class: 'btn', onclick: addModal }, '+ Add goal')
      );
      root.append(App.el('div', { class: 'card' }, head));
      if (!App.state.longGoals.length) {
        root.append(App.el('p', { class: 'muted' }, 'No long-term goals yet.'));
      } else {
        App.state.longGoals.forEach((g) => root.append(goalCard(g)));
      }
    },
  });
})();

/* Quests panel - actionable tasks that grant XP to a stat + the global level. */
(() => {
  const daysSince = (dateStr) => {
    if (!dateStr) return Infinity;
    const ms = Date.now() - new Date(dateStr + 'T00:00:00').getTime();
    return Math.floor(ms / 86400000);
  };

  function canComplete(q) {
    if (q.cadence === 'once') return !q.lastCompleted;
    if (q.cadence === 'weekly') return daysSince(q.lastCompleted) >= 7;
    return q.lastCompleted !== App.today(); // daily
  }

  function completeQuest(q) {
    if (!canComplete(q)) return;
    q.lastCompleted = App.today();
    App.awardXp(q.stat, q.xp, `Completed quest: ${q.title}`);
    if (q.cadence === 'once') {
      App.state.quests = App.state.quests.filter((x) => x.id !== q.id);
    }
    App.commit();
  }

  function deleteQuest(id) {
    App.state.quests = App.state.quests.filter((q) => q.id !== id);
    App.commit();
  }

  function addQuestModal() {
    const title = App.el('input', { type: 'text', required: 'true', placeholder: 'e.g. Workout 30 min' });
    const xp = App.el('input', { type: 'number', min: '1', value: '50' });
    const stat = App.el(
      'select',
      null,
      ...App.state.stats.map((s) => App.el('option', { value: s.id }, s.label))
    );
    const cadence = App.el(
      'select',
      null,
      App.el('option', { value: 'daily' }, 'Daily'),
      App.el('option', { value: 'weekly' }, 'Weekly'),
      App.el('option', { value: 'once' }, 'One-off')
    );
    const form = App.el(
      'form',
      {
        onsubmit: (e) => {
          e.preventDefault();
          if (!title.value.trim()) return;
          App.state.quests.push({
            id: App.uid(),
            title: title.value.trim(),
            stat: stat.value,
            xp: Math.max(1, parseInt(xp.value, 10) || 1),
            cadence: cadence.value,
            lastCompleted: null,
          });
          App.closeModal();
          App.commit();
        },
      },
      App.el('label', { class: 'field' }, App.el('span', null, 'Quest'), title),
      App.el('label', { class: 'field' }, App.el('span', null, 'Reward stat'), stat),
      App.el('label', { class: 'field' }, App.el('span', null, 'XP reward'), xp),
      App.el('label', { class: 'field' }, App.el('span', null, 'Cadence'), cadence),
      App.el('button', { class: 'btn primary', type: 'submit' }, 'Add quest')
    );
    App.openModal('Add Quest', form);
  }

  function questRow(q) {
    const statLabel = (App.state.stats.find((s) => s.id === q.stat) || {}).label || q.stat;
    const done = !canComplete(q);
    return App.el(
      'div',
      { class: 'row spread quest-row' },
      App.el(
        'div',
        null,
        App.el('div', null, q.title),
        App.el('div', { class: 'muted', style: 'font-size:.75rem' }, `+${q.xp} XP -> ${statLabel} - ${q.cadence}`)
      ),
      App.el(
        'div',
        { class: 'row' },
        App.el(
          'button',
          { class: 'btn primary', disabled: done ? 'true' : null, onclick: () => completeQuest(q) },
          done ? 'Done' : 'Complete'
        ),
        App.el('button', { class: 'icon-btn', title: 'Delete', onclick: () => deleteQuest(q.id) }, '\u2715')
      )
    );
  }

  App.registerPanel({
    id: 'quests',
    label: 'Quests',
    icon: 'tab-quests',
    order: 20,
    render(root) {
      const head = App.el(
        'div',
        { class: 'row spread' },
        App.el('h2', null, 'Quests'),
        App.el('button', { class: 'btn', onclick: addQuestModal }, '+ Add quest')
      );
      const list = App.el('div', { class: 'quest-list' });
      if (!App.state.quests.length) {
        list.append(App.el('p', { class: 'muted' }, 'No quests yet. Add one to start earning XP.'));
      } else {
        App.state.quests.forEach((q) => list.append(questRow(q)));
      }
      root.append(App.el('div', { class: 'card' }, head, list));
    },
  });
})();

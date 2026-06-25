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

  // ---- Generate quests/adventures from the player's goals ------------------
  // Maps goal text to the most fitting stat so rewards feel thematic.
  const STAT_KEYWORDS = [
    ['health', ['run', 'gym', 'workout', 'exercise', 'health', 'sleep', 'water', 'diet', 'walk', 'steps', 'yoga', 'cardio']],
    ['strength', ['lift', 'strength', 'push', 'pull', 'muscle', 'weights', 'press', 'squat']],
    ['intellect', ['read', 'study', 'learn', 'book', 'course', 'code', 'write', 'language', 'math', 'practice']],
    ['social', ['friend', 'call', 'family', 'social', 'meet', 'network', 'date', 'volunteer']],
    ['discipline', ['meditate', 'clean', 'budget', 'save', 'habit', 'wake', 'plan', 'focus', 'journal']],
  ];

  function guessStat(text) {
    const t = String(text || '').toLowerCase();
    for (const [stat, kws] of STAT_KEYWORDS) {
      if (kws.some((k) => t.includes(k)) && App.state.stats.some((s) => s.id === stat)) return stat;
    }
    const fallback = App.state.stats.find((s) => s.id === 'discipline') || App.state.stats[0];
    return (fallback || { id: 'discipline' }).id;
  }

  function existingSources() {
    return new Set(
      App.state.quests.filter((q) => q.source).map((q) => `${q.source.type}:${q.source.id}`)
    );
  }

  // Creates quests for any goal/milestone not already represented; returns count.
  function generateFromGoals() {
    const have = existingSources();
    let created = 0;
    const add = (quest) => {
      App.state.quests.push(quest);
      created++;
    };

    (App.state.dailyGoals || []).forEach((g) => {
      const key = `dailyGoal:${g.id}`;
      if (have.has(key)) return;
      add({
        id: App.uid(),
        title: g.title,
        stat: guessStat(g.title),
        xp: Math.max(1, g.xp || 30),
        cadence: 'daily',
        lastCompleted: null,
        source: { type: 'dailyGoal', id: g.id },
      });
      have.add(key);
    });

    (App.state.longGoals || []).forEach((g) => {
      const milestoneCount = (g.milestones || []).length;
      const adventureKey = `longGoal:${g.id}`;
      if (!have.has(adventureKey)) {
        add({
          id: App.uid(),
          title: `Adventure: ${g.title}`,
          stat: guessStat(g.title),
          xp: Math.min(150, Math.max(20, Math.round((g.xp || 500) / 5))),
          cadence: 'weekly',
          lastCompleted: null,
          source: { type: 'longGoal', id: g.id },
        });
        have.add(adventureKey);
      }
      (g.milestones || []).forEach((m) => {
        if (m.done) return;
        const mid = `${g.id}:${m.label}`;
        const mkey = `milestone:${mid}`;
        if (have.has(mkey)) return;
        add({
          id: App.uid(),
          title: `Milestone: ${m.label}`,
          stat: guessStat(m.label),
          xp: Math.max(10, Math.round((g.xp || 500) / Math.max(1, milestoneCount))),
          cadence: 'once',
          lastCompleted: null,
          source: { type: 'milestone', id: mid },
        });
        have.add(mkey);
      });
    });

    return created;
  }

  function generateAction() {
    const n = generateFromGoals();
    if (n > 0) {
      App.toast(`Generated ${n} quest${n === 1 ? '' : 's'} from your goals.`);
      App.notify('New quests!', `${n} quest${n === 1 ? '' : 's'} added from your goals.`);
      App.commit();
    } else {
      App.toast('No new quests - your goals are already covered.');
    }
  }

  // Exposed so other features (onboarding, etc.) can trigger generation.
  App.generateQuestsFromGoals = generateFromGoals;

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
    const origin = q.source ? ' \u00b7 from goal' : '';
    return App.el(
      'div',
      { class: 'row spread quest-row' },
      App.el(
        'div',
        null,
        App.el('div', null, q.title),
        App.el('div', { class: 'muted', style: 'font-size:.75rem' }, `+${q.xp} XP -> ${statLabel} - ${q.cadence}${origin}`)
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
        App.el(
          'div',
          { class: 'row', style: 'gap:.5rem' },
          App.el('button', { class: 'btn', onclick: generateAction, title: 'Create quests from your daily and long-term goals' }, 'Generate from goals'),
          App.el('button', { class: 'btn primary', onclick: addQuestModal }, '+ Add quest')
        )
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

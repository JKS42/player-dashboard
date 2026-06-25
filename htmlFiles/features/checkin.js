/* Daily check-in + streak. */
(() => {
  const yesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return App.today(d);
  };

  function alreadyCheckedToday() {
    return App.state.streak.lastCheckIn === App.today();
  }

  function checkIn() {
    const s = App.state.streak;
    if (s.lastCheckIn === App.today()) {
      App.toast('Already checked in today.');
      return;
    }
    if (s.lastCheckIn === yesterday()) s.count += 1;
    else s.count = 1;
    s.lastCheckIn = App.today();
    const bonus = 20 + Math.min(s.count, 7) * 5;
    App.awardXp(null, bonus, `Daily check-in (streak ${s.count})`);
    App.notify('Checked in!', `Streak: ${s.count} day(s)`);
    App.commit();
  }

  // Exposed so other features (e.g. daily goals) can satisfy the check-in.
  App.checkIn = checkIn;
  App.hasCheckedInToday = alreadyCheckedToday;

  App.registerPanel({
    id: 'checkin',
    label: 'Check-in',
    icon: 'tab-checkin',
    order: 30,
    render(root) {
      const s = App.state.streak;
      const done = alreadyCheckedToday();
      root.append(
        App.el(
          'div',
          { class: 'card' },
          App.el('h2', null, 'Daily Check-in'),
          App.el('p', { class: 'streak-count' }, `Current streak: ${s.count} day(s)`),
          App.el(
            'p',
            { class: 'muted', style: 'font-size:.8rem' },
            done ? 'You have checked in today. Come back tomorrow!' : 'Check in to keep your streak alive.'
          ),
          App.el(
            'button',
            { class: 'btn primary', disabled: done ? 'true' : null, onclick: checkIn },
            done ? 'Checked in' : 'Check in'
          )
        )
      );
    },
  });
})();

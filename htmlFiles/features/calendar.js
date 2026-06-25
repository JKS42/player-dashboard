/*
 * Activity Calendar - a GitHub-style contribution heatmap.
 *
 * Each cell is one day; its intensity reflects how much activity the player
 * logged that day (entries in state.log). Renders ~53 weeks ending today.
 */
(() => {
  const WEEKS = 53;
  const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const COL_PX = 15; // 12px cell + 3px gap, used to size month labels

  const dateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Count activity-log entries per calendar day.
  function buildCounts() {
    const counts = {};
    (App.state.log || []).forEach((entry) => {
      if (!entry || !entry.ts) return;
      const k = dateKey(new Date(entry.ts));
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }

  // Map a daily count to one of five intensity buckets (0..4).
  function levelFor(n) {
    if (!n) return 0;
    if (n <= 2) return 1;
    if (n <= 5) return 2;
    if (n <= 9) return 3;
    return 4;
  }

  function legendCell(level) {
    return App.el('div', { class: 'cal-cell', 'data-level': String(level) });
  }

  App.registerPanel({
    id: 'calendar',
    label: 'Calendar',
    icon: 'tab-calendar',
    order: 15,
    render(root) {
      const counts = buildCounts();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Start on the Sunday of the column WEEKS-1 weeks ago so the grid aligns.
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);

      // First date of each week-column.
      const cols = [];
      for (let w = 0; w < WEEKS; w++) {
        const cd = new Date(start);
        cd.setDate(start.getDate() + w * 7);
        cols.push(cd);
      }

      // Month label groups (consecutive columns sharing a month).
      const monthsRow = App.el('div', { class: 'cal-months' });
      const groups = [];
      cols.forEach((cd) => {
        const m = cd.getMonth();
        const last = groups[groups.length - 1];
        if (last && last.m === m) last.n++;
        else groups.push({ m, n: 1 });
      });
      groups.forEach((g) =>
        monthsRow.append(
          App.el('span', { class: 'cal-month', style: `width:${g.n * COL_PX}px` }, g.n >= 2 ? MONTHS[g.m] : '')
        )
      );

      // Weekday labels (show Mon / Wed / Fri like GitHub).
      const weekdays = App.el('div', { class: 'cal-weekdays' });
      ['', 'Mon', '', 'Wed', '', 'Fri', ''].forEach((t) =>
        weekdays.append(App.el('span', { class: 'cal-wd' }, t))
      );

      // The grid of day cells, plus rolling stats.
      const grid = App.el('div', { class: 'cal-grid' });
      let total = 0;
      let activeDays = 0;
      let best = 0;
      let bestDay = null;

      cols.forEach((colStart) => {
        const col = App.el('div', { class: 'cal-col' });
        for (let d = 0; d < 7; d++) {
          const cur = new Date(colStart);
          cur.setDate(colStart.getDate() + d);
          if (cur > today) {
            col.append(App.el('div', { class: 'cal-cell empty' }));
            continue;
          }
          const n = counts[dateKey(cur)] || 0;
          total += n;
          if (n > 0) activeDays++;
          if (n > best) {
            best = n;
            bestDay = new Date(cur);
          }
          col.append(
            App.el('div', {
              class: 'cal-cell',
              'data-level': String(levelFor(n)),
              title: `${n} ${n === 1 ? 'activity' : 'activities'} on ${cur.toDateString()}`,
            })
          );
        }
        grid.append(col);
      });

      const graph = App.el(
        'div',
        { class: 'cal-graph' },
        weekdays,
        App.el('div', { class: 'cal-body' }, monthsRow, grid)
      );

      const legend = App.el(
        'div',
        { class: 'cal-legend' },
        App.el('span', null, 'Less'),
        legendCell(0),
        legendCell(1),
        legendCell(2),
        legendCell(3),
        legendCell(4),
        App.el('span', null, 'More')
      );

      const streak = (App.state.streak && App.state.streak.count) || 0;
      const stats = App.el(
        'div',
        { class: 'cal-stats' },
        App.el('div', { class: 'cal-stat' }, App.el('strong', null, String(total)), App.el('span', { class: 'muted' }, 'activities')),
        App.el('div', { class: 'cal-stat' }, App.el('strong', null, String(activeDays)), App.el('span', { class: 'muted' }, 'active days')),
        App.el('div', { class: 'cal-stat' }, App.el('strong', null, String(best)), App.el('span', { class: 'muted' }, 'best day')),
        App.el('div', { class: 'cal-stat' }, App.el('strong', null, String(streak)), App.el('span', { class: 'muted' }, 'day streak'))
      );

      const card = App.el(
        'div',
        { class: 'card' },
        App.el('h2', null, 'Activity Calendar'),
        App.el(
          'p',
          { class: 'muted', style: 'font-size:.8rem; margin-top:-.4rem' },
          best
            ? `Your busiest day was ${bestDay.toDateString()} with ${best} ${best === 1 ? 'activity' : 'activities'}.`
            : 'Complete quests, goals, and check-ins to fill in your year.'
        ),
        stats,
        graph,
        legend
      );

      root.append(card);
    },
  });
})();

/*
 * Notification nudges - state-aware daily push notifications.
 *
 * Completion/confirmation notifications are emitted inline by each feature
 * (check-in, daily goals, long-term goals). This module adds the *reminding*
 * side: at set times each day it checks your state and nudges you only if
 * there's something outstanding.
 *
 *   - Check-in nudge: fires if you haven't checked in today.
 *   - Daily-goals nudge: fires if you still have unfinished daily goals.
 *
 * Times can be overridden via state.settings.notifications
 * ({ checkinTime, goalsTime }). Timers run while the app is open and
 * reschedule themselves every 24h; boot (login) restarts them.
 */
(() => {
  const DEFAULTS = { checkinTime: '09:00', goalsTime: '20:00' };
  let timers = [];

  function clearTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  function msUntil(timeStr) {
    const [h, m] = String(timeStr).split(':').map((n) => parseInt(n, 10));
    const now = new Date();
    const next = new Date();
    next.setHours(Number.isNaN(h) ? 9 : h, Number.isNaN(m) ? 0 : m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  function schedule(timeStr, fn) {
    const run = () => {
      try {
        fn();
      } finally {
        timers.push(setTimeout(run, 24 * 60 * 60 * 1000));
      }
    };
    timers.push(setTimeout(run, Math.max(1000, msUntil(timeStr))));
  }

  function checkinNudge() {
    if (!App.state) return;
    if (App.hasCheckedInToday && App.hasCheckedInToday()) return;
    App.notify('Daily check-in', "Don't forget to check in to keep your streak alive!");
  }

  function goalsNudge() {
    if (!App.state) return;
    const left = (App.state.dailyGoals || []).filter((g) => !g.done).length;
    if (left > 0) {
      App.notify('Daily goals', `You still have ${left} daily goal${left === 1 ? '' : 's'} to finish today.`);
    }
  }

  function start() {
    clearTimers();
    const s = (App.state && App.state.settings && App.state.settings.notifications) || {};
    schedule(s.checkinTime || DEFAULTS.checkinTime, checkinNudge);
    schedule(s.goalsTime || DEFAULTS.goalsTime, goalsNudge);
  }

  App.on('boot', start);
})();

/*
 * Daily Budget widget - a small fixed card pinned to the bottom-right.
 *
 * Shows how much you can still spend today: a daily allowance derived from the
 * wallet's monthly budget (or salary if no budget is set) divided across the
 * days in the current month, minus today's expenses. Click it to open Wallet.
 *
 * It lives inside #app-view so it hides automatically on the login screen.
 */
(() => {
  let node = null;

  const daysInMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  function ensure() {
    if (node && document.body.contains(node)) return node;
    const host = document.getElementById('app-view');
    if (!host) return null;
    node = App.el('button', {
      class: 'daily-budget',
      type: 'button',
      title: 'Open Wallet',
      onclick: () => App.showPanel('wallet'),
    });
    host.append(node);
    return node;
  }

  function render() {
    const widget = ensure();
    if (!widget || !App.state) return;

    const w = App.state.wallet || {};
    const basis = w.budget && w.budget > 0 ? w.budget : w.monthlySalary || 0;
    const allowance = basis > 0 ? basis / daysInMonth() : 0;

    const tkey = App.today();
    let spentToday = 0;
    (w.transactions || []).forEach((t) => {
      if (t && t.type === 'expense' && App.today(new Date(t.ts)) === tkey) {
        spentToday += t.amount || 0;
      }
    });

    const remaining = allowance - spentToday;
    widget.dataset.state = allowance <= 0 ? 'empty' : remaining < 0 ? 'over' : 'ok';

    widget.innerHTML = '';
    widget.append(
      App.el('span', { class: 'db-label' }, 'Daily Budget'),
      App.el('span', { class: 'db-amount' }, App.fmtMoney(remaining)),
      App.el(
        'span',
        { class: 'db-sub' },
        allowance > 0
          ? `${App.fmtMoney(spentToday)} spent of ${App.fmtMoney(allowance)}`
          : 'Set a budget in Wallet'
      )
    );
  }

  App.on('boot', render);
  App.on('change', render);
})();

/* Wallet - salary budget tracker that feeds XP. */
(() => {
  const monthOf = (dateStr) => (dateStr ? dateStr.slice(0, 7) : null);

  function addTx(type, amount, category, note, ts) {
    App.state.wallet.transactions.unshift({
      id: App.uid(),
      type,
      amount,
      category: category || (type === 'income' ? 'Income' : 'Other'),
      note: note || '',
      ts: ts || Date.now(),
    });
    App.state.wallet.balance += type === 'income' ? amount : -amount;
  }

  // Auto-credit salary for each whole month elapsed since the last credit.
  function creditSalaryIfDue() {
    const w = App.state.wallet;
    if (!w.monthlySalary || w.monthlySalary <= 0) return;
    const now = new Date();
    const curMonth = App.monthKey(now);
    if (!w.lastSalaryCredit) {
      addTx('income', w.monthlySalary, 'Salary', 'Monthly salary');
      w.lastSalaryCredit = curMonth;
      App.save();
      return;
    }
    let [y, m] = w.lastSalaryCredit.split('-').map((n) => parseInt(n, 10));
    let credited = false;
    while (`${y}-${String(m).padStart(2, '0')}` < curMonth) {
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      addTx('income', w.monthlySalary, 'Salary', 'Monthly salary');
      evaluateMonthXp();
      credited = true;
    }
    if (credited) {
      w.lastSalaryCredit = curMonth;
      App.save();
    }
  }
  App.on('boot', creditSalaryIfDue);

  function monthSummary(key) {
    const w = App.state.wallet;
    const txs = w.transactions.filter((t) => monthOf(App.today(new Date(t.ts))) === key);
    let income = 0;
    let expense = 0;
    const byCat = {};
    txs.forEach((t) => {
      if (t.type === 'income') income += t.amount;
      else {
        expense += t.amount;
        byCat[t.category] = (byCat[t.category] || 0) + t.amount;
      }
    });
    return { income, expense, savings: income - expense, byCat };
  }

  function evaluateMonthXp() {
    const w = App.state.wallet;
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const key = App.monthKey(prev);
    const s = monthSummary(key);
    if (w.budget > 0 && s.expense <= w.budget) App.awardXp(null, 60, 'Stayed under budget');
    if (s.savings > 0) App.awardXp(null, Math.min(100, Math.round(s.savings / 10)), 'Monthly savings');
  }

  function addTxModal() {
    const w = App.state.wallet;
    const type = App.el(
      'select',
      null,
      App.el('option', { value: 'expense' }, 'Expense'),
      App.el('option', { value: 'income' }, 'Income')
    );
    const amount = App.el('input', { type: 'number', min: '0', step: '0.01', value: '0' });
    const category = App.el('select', null, ...w.categories.map((c) => App.el('option', { value: c }, c)));
    const note = App.el('input', { type: 'text', placeholder: 'Optional note' });
    const form = App.el(
      'form',
      {
        onsubmit: (e) => {
          e.preventDefault();
          const amt = parseFloat(amount.value);
          if (!amt || amt <= 0) return;
          const firstTx = w.transactions.length === 0;
          addTx(type.value, amt, category.value, note.value);
          if (firstTx) App.awardXp(null, 20, 'Logged first transaction');
          App.closeModal();
          App.commit();
        },
      },
      App.el('label', { class: 'field' }, App.el('span', null, 'Type'), type),
      App.el('label', { class: 'field' }, App.el('span', null, 'Amount'), amount),
      App.el('label', { class: 'field' }, App.el('span', null, 'Category'), category),
      App.el('label', { class: 'field' }, App.el('span', null, 'Note'), note),
      App.el('button', { class: 'btn primary', type: 'submit' }, 'Add transaction')
    );
    App.openModal('Add Transaction', form);
  }

  function settingsModal() {
    const w = App.state.wallet;
    const currency = App.el('input', { type: 'text', value: w.currency, maxlength: '3' });
    const salary = App.el('input', { type: 'number', min: '0', step: '0.01', value: String(w.monthlySalary) });
    const budget = App.el('input', { type: 'number', min: '0', step: '0.01', value: String(w.budget) });
    const cats = App.el('input', { type: 'text', value: w.categories.join(', ') });
    const form = App.el(
      'form',
      {
        onsubmit: (e) => {
          e.preventDefault();
          w.currency = currency.value.trim() || '$';
          w.monthlySalary = Math.max(0, parseFloat(salary.value) || 0);
          w.budget = Math.max(0, parseFloat(budget.value) || 0);
          w.categories = cats.value.split(',').map((c) => c.trim()).filter(Boolean);
          if (!w.categories.length) w.categories = ['Other'];
          App.closeModal();
          creditSalaryIfDue();
          App.commit();
        },
      },
      App.el('label', { class: 'field' }, App.el('span', null, 'Currency symbol'), currency),
      App.el('label', { class: 'field' }, App.el('span', null, 'Monthly salary'), salary),
      App.el('label', { class: 'field' }, App.el('span', null, 'Monthly budget (0 = none)'), budget),
      App.el('label', { class: 'field' }, App.el('span', null, 'Categories (comma separated)'), cats),
      App.el('button', { class: 'btn primary', type: 'submit' }, 'Save')
    );
    App.openModal('Wallet Settings', form);
  }

  App.registerPanel({
    id: 'wallet',
    label: 'Wallet',
    icon: 'tab-wallet',
    order: 55,
    render(root) {
      const w = App.state.wallet;
      const s = monthSummary(App.monthKey());

      const head = App.el(
        'div',
        { class: 'row spread' },
        App.el('h2', null, 'Wallet'),
        App.el(
          'div',
          { class: 'row' },
          App.el('button', { class: 'btn', onclick: settingsModal }, 'Settings'),
          App.el('button', { class: 'btn primary', onclick: addTxModal }, '+ Transaction')
        )
      );

      const overview = App.el(
        'div',
        { class: 'card' },
        head,
        App.el('div', { style: 'font-size:1.6rem;font-weight:700;margin:.5rem 0' }, App.fmtMoney(w.balance)),
        App.el('div', { class: 'muted', style: 'font-size:.8rem' }, `Salary ${App.fmtMoney(w.monthlySalary)}/mo - Budget ${w.budget ? App.fmtMoney(w.budget) : 'none'}`)
      );

      const budgetBar = w.budget
        ? App.el(
            'div',
            null,
            App.xpBar(Math.min(s.expense, w.budget), w.budget),
            App.el('div', { class: 'muted', style: 'font-size:.75rem;margin-top:4px' }, `${App.fmtMoney(s.expense)} / ${App.fmtMoney(w.budget)} spent this month`)
          )
        : null;

      const summary = App.el(
        'div',
        { class: 'card' },
        App.el('h3', null, 'This month'),
        App.el('div', { class: 'row spread' }, App.el('span', null, 'Income'), App.el('strong', null, App.fmtMoney(s.income))),
        App.el('div', { class: 'row spread' }, App.el('span', null, 'Expenses'), App.el('strong', null, App.fmtMoney(s.expense))),
        App.el('div', { class: 'row spread' }, App.el('span', null, 'Savings'), App.el('strong', { style: `color:${s.savings >= 0 ? 'var(--good)' : 'var(--danger)'}` }, App.fmtMoney(s.savings))),
        budgetBar
      );

      const txCard = App.el('div', { class: 'card' }, App.el('h3', null, 'Transactions'));
      if (!w.transactions.length) {
        txCard.append(App.el('p', { class: 'muted' }, 'No transactions yet.'));
      } else {
        w.transactions.slice(0, 30).forEach((t) => {
          txCard.append(
            App.el(
              'div',
              { class: 'row spread tx-row' },
              App.el(
                'div',
                null,
                App.el('div', null, `${t.category}${t.note ? ' - ' + t.note : ''}`),
                App.el('div', { class: 'muted', style: 'font-size:.7rem' }, new Date(t.ts).toLocaleDateString())
              ),
              App.el(
                'strong',
                { style: `color:${t.type === 'income' ? 'var(--good)' : 'var(--danger)'}` },
                `${t.type === 'income' ? '+' : '-'}${App.fmtMoney(t.amount)}`
              )
            )
          );
        });
      }

      root.append(overview, summary, txCard);
    },
  });
})();

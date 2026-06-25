/* Reminders - configurable desktop-notification reminders. */
(() => {
  const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  function sync() {
    App.setReminders(App.state.reminders || []);
  }

  function toggleEnabled(r) {
    r.enabled = !r.enabled;
    sync();
    App.commit();
  }

  function remove(id) {
    App.state.reminders = App.state.reminders.filter((r) => r.id !== id);
    sync();
    App.commit();
  }

  function addModal() {
    const label = App.el('input', { type: 'text', required: 'true', placeholder: 'e.g. Drink water' });
    const time = App.el('input', { type: 'time', value: '09:00' });
    const dayBoxes = DAY_LABELS.map((lbl, i) => {
      const cb = App.el('input', { type: 'checkbox', value: String(i) });
      cb.checked = true;
      return App.el('label', { class: 'day-check' }, cb, App.el('span', null, lbl));
    });
    const form = App.el(
      'form',
      {
        onsubmit: (e) => {
          e.preventDefault();
          if (!label.value.trim()) return;
          const days = dayBoxes
            .map((box, i) => (box.querySelector('input').checked ? i : null))
            .filter((d) => d !== null);
          App.state.reminders.push({
            id: App.uid(),
            label: label.value.trim(),
            time: time.value || '09:00',
            days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
            enabled: true,
          });
          App.closeModal();
          sync();
          App.commit();
        },
      },
      App.el('label', { class: 'field' }, App.el('span', null, 'Label'), label),
      App.el('label', { class: 'field' }, App.el('span', null, 'Time'), time),
      App.el('div', { class: 'field' }, App.el('span', null, 'Days'), App.el('div', { class: 'row', style: 'flex-wrap:wrap;gap:.4rem' }, ...dayBoxes)),
      App.el('button', { class: 'btn primary', type: 'submit' }, 'Add reminder')
    );
    App.openModal('Add Reminder', form);
  }

  function reminderRow(r) {
    const daysText =
      r.days && r.days.length < 7 ? r.days.map((d) => DAY_LABELS[d]).join(' ') : 'Every day';
    const toggle = App.el('input', { type: 'checkbox', onchange: () => toggleEnabled(r) });
    if (r.enabled) toggle.checked = true;
    return App.el(
      'div',
      { class: 'row spread reminder-row' },
      App.el(
        'div',
        null,
        App.el('div', null, `${r.time} - ${r.label}`),
        App.el('div', { class: 'muted', style: 'font-size:.75rem' }, daysText)
      ),
      App.el(
        'div',
        { class: 'row' },
        App.el('label', { class: 'row' }, toggle, App.el('span', { class: 'muted', style: 'font-size:.75rem' }, 'on')),
        App.el('button', { class: 'icon-btn', onclick: () => remove(r.id) }, '\u2715')
      )
    );
  }

  App.registerPanel({
    id: 'reminders',
    label: 'Reminders',
    icon: 'tab-reminders',
    order: 60,
    render(root) {
      const head = App.el(
        'div',
        { class: 'row spread' },
        App.el('h2', null, 'Reminders'),
        App.el('button', { class: 'btn', onclick: addModal }, '+ Add reminder')
      );
      const list = App.el('div', { class: 'reminder-list' });
      if (!App.state.reminders.length) {
        list.append(App.el('p', { class: 'muted' }, 'No reminders set.'));
      } else {
        App.state.reminders.forEach((r) => list.append(reminderRow(r)));
      }
      root.append(
        App.el('div', { class: 'card' }, head, list),
        App.el('p', { class: 'muted', style: 'font-size:.75rem' }, 'Reminders fire as desktop notifications while the app is running.')
      );
    },
  });
})();

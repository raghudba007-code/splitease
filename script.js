// ============================================================
// SplitEase – script.js
// Expense sharing & budget tracking – no backend, localStorage only
// ============================================================

// ────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'food',          name: 'Food & Drinks',  icon: '🍔', color: '#f59e0b' },
  { id: 'home',          name: 'Home',            icon: '🏠', color: '#6366f1' },
  { id: 'transport',     name: 'Transport',       icon: '🚗', color: '#10b981' },
  { id: 'entertainment', name: 'Entertainment',   icon: '🎮', color: '#ec4899' },
  { id: 'travel',        name: 'Travel',          icon: '✈️', color: '#3b82f6' },
  { id: 'healthcare',    name: 'Healthcare',      icon: '💊', color: '#ef4444' },
  { id: 'utilities',     name: 'Utilities',       icon: '⚡', color: '#8b5cf6' },
  { id: 'other',         name: 'Other',           icon: '📦', color: '#64748b' },
];

const MEMBER_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899',
  '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6',
  '#f97316', '#84cc16',
];

const CURRENCY_SYMBOL = '$';
const STORAGE = { MEMBERS: 'se_members', EXPENSES: 'se_expenses' };

// ────────────────────────────────────────────────────────────
// APP STATE
// ────────────────────────────────────────────────────────────

const state = {
  members:  [],
  expenses: [],
  filters:  { search: '', category: '', startDate: '', endDate: '' },
  splitType: 'equal',         // 'equal' | 'custom'
  editingExpenseId: null,
  pendingDeleteId: null,
  pendingDeleteType: null,    // 'expense' | 'member'
  charts: { category: null, monthly: null },
};

// ────────────────────────────────────────────────────────────
// STORAGE ABSTRACTION LAYER
// ────────────────────────────────────────────────────────────

const Store = {
  get(key)       { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch { showToast('Storage error', 'error'); } },
};

function loadData() {
  const savedMembers  = Store.get(STORAGE.MEMBERS);
  const savedExpenses = Store.get(STORAGE.EXPENSES);

  // Load saved data or seed with sample data on first run
  state.members  = savedMembers  || getSampleMembers();
  state.expenses = savedExpenses || getSampleExpenses();

  if (!savedMembers)  Store.set(STORAGE.MEMBERS,  state.members);
  if (!savedExpenses) Store.set(STORAGE.EXPENSES, state.expenses);
}

function saveMembers()  { Store.set(STORAGE.MEMBERS,  state.members); }
function saveExpenses() { Store.set(STORAGE.EXPENSES, state.expenses); }

// ────────────────────────────────────────────────────────────
// SAMPLE DATA  (demonstrates all features on first load)
// ────────────────────────────────────────────────────────────

function getSampleMembers() {
  return [
    { id: 'alex',   name: 'Alex',   color: '#6366f1', initials: 'AL' },
    { id: 'jordan', name: 'Jordan', color: '#10b981', initials: 'JO' },
    { id: 'sam',    name: 'Sam',    color: '#f59e0b', initials: 'SA' },
    { id: 'casey',  name: 'Casey',  color: '#ec4899', initials: 'CA' },
  ];
}

function getSampleExpenses() {
  const all = ['alex', 'jordan', 'sam', 'casey'];
  const y   = new Date().getFullYear();
  const m   = String(new Date().getMonth() + 1).padStart(2, '0');
  const d   = (n) => `${y}-${m}-${String(n).padStart(2, '0')}`;

  return [
    {
      id: 'exp1', title: 'Grocery Shopping', amount: 85.50,
      paidBy: 'alex', date: d(15), category: 'food', notes: 'Weekly groceries',
      splitType: 'equal',
      splits: all.map(id => ({ memberId: id, amount: +(85.50 / 4).toFixed(2) })),
    },
    {
      id: 'exp2', title: 'Netflix Subscription', amount: 15.99,
      paidBy: 'jordan', date: d(1), category: 'entertainment', notes: '',
      splitType: 'equal',
      splits: all.map(id => ({ memberId: id, amount: +(15.99 / 4).toFixed(2) })),
    },
    {
      id: 'exp3', title: 'Electricity Bill', amount: 120.00,
      paidBy: 'sam', date: d(10), category: 'utilities', notes: 'Monthly bill',
      splitType: 'equal',
      splits: all.map(id => ({ memberId: id, amount: 30.00 })),
    },
    {
      id: 'exp4', title: 'Uber to Airport', amount: 45.00,
      paidBy: 'casey', date: d(12), category: 'transport', notes: '',
      splitType: 'equal',
      splits: [{ memberId: 'alex', amount: 22.50 }, { memberId: 'casey', amount: 22.50 }],
    },
    {
      id: 'exp5', title: 'Restaurant Dinner', amount: 180.00,
      paidBy: 'alex', date: d(20), category: 'food', notes: 'Birthday celebration',
      splitType: 'custom',
      splits: [
        { memberId: 'alex',   amount: 60.00 },
        { memberId: 'jordan', amount: 60.00 },
        { memberId: 'sam',    amount: 30.00 },
        { memberId: 'casey',  amount: 30.00 },
      ],
    },
    {
      id: 'exp6', title: 'Internet Bill', amount: 79.99,
      paidBy: 'jordan', date: d(5), category: 'utilities', notes: '',
      splitType: 'equal',
      splits: all.map(id => ({ memberId: id, amount: +(79.99 / 4).toFixed(2) })),
    },
    {
      id: 'exp7', title: 'Cleaning Supplies', amount: 65.00,
      paidBy: 'sam', date: d(8), category: 'home', notes: '',
      splitType: 'equal',
      splits: all.map(id => ({ memberId: id, amount: +(65.00 / 4).toFixed(2) })),
    },
    {
      id: 'exp8', title: 'Movie Tickets', amount: 48.00,
      paidBy: 'alex', date: d(25), category: 'entertainment', notes: 'Action night',
      splitType: 'equal',
      splits: [{ memberId: 'alex', amount: 24.00 }, { memberId: 'jordan', amount: 24.00 }],
    },
  ];
}

// ────────────────────────────────────────────────────────────
// UTILITIES
// ────────────────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmt(amount) {
  return CURRENCY_SYMBOL + Number(amount).toFixed(2);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  // Parse as local date (avoid off-by-one from UTC)
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

function getMember(id) {
  return state.members.find(m => m.id === id) || { name: 'Unknown', color: '#94a3b8', initials: '??' };
}

function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// Safely escape text before inserting into HTML
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast toast-${type} show`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ────────────────────────────────────────────────────────────
// NAVIGATION
// ────────────────────────────────────────────────────────────

function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach(sec =>
    sec.classList.toggle('active', sec.id === `tab-${tabId}`));

  // Render the newly active tab
  const render = { dashboard: renderDashboard, expenses: renderExpenses, members: renderMembers, balances: renderBalances };
  if (render[tabId]) render[tabId]();
}

// ────────────────────────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────────────────────────

function renderDashboard() {
  renderStats();
  renderCategoryChart();
  renderMonthlyChart();
  renderRecentTransactions();
}

function renderStats() {
  const total = state.expenses.reduce((s, e) => s + e.amount, 0);

  const now   = new Date();
  const month = state.expenses
    .filter(e => {
      const [y, m] = e.date.split('-').map(Number);
      return y === now.getFullYear() && m === now.getMonth() + 1;
    })
    .reduce((s, e) => s + e.amount, 0);

  document.getElementById('stat-total').textContent   = fmt(total);
  document.getElementById('stat-month').textContent   = fmt(month);
  document.getElementById('stat-count').textContent   = state.expenses.length;
  document.getElementById('stat-members').textContent = state.members.length;
}

function renderCategoryChart() {
  const canvas = document.getElementById('category-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  // Aggregate spending per category
  const totals = {};
  state.expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });

  const entries  = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const labels   = entries.map(([id]) => getCategory(id).name);
  const data     = entries.map(([, v]) => v);
  const colors   = entries.map(([id]) => getCategory(id).color);

  // Destroy existing chart before recreating
  if (state.charts.category) { state.charts.category.destroy(); state.charts.category = null; }

  if (data.length === 0) {
    document.getElementById('category-legend').innerHTML = '<p class="empty-text">No expenses yet.</p>';
    return;
  }

  state.charts.category = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } },
      },
    },
  });

  // Custom legend below the chart
  document.getElementById('category-legend').innerHTML = labels.map((label, i) =>
    `<div class="legend-item">
       <span class="legend-dot" style="background:${colors[i]}"></span>
       <span class="legend-label">${label}</span>
       <span class="legend-value">${fmt(data[i])}</span>
     </div>`
  ).join('');
}

function renderMonthlyChart() {
  const canvas = document.getElementById('monthly-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const now    = new Date();
  const labels = [];
  const data   = [];

  // Build totals for last 6 months
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr  = d.getFullYear();
    const mo  = d.getMonth() + 1;
    labels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
    data.push(
      state.expenses
        .filter(e => { const [ey, em] = e.date.split('-').map(Number); return ey === yr && em === mo; })
        .reduce((s, e) => s + e.amount, 0)
    );
  }

  if (state.charts.monthly) { state.charts.monthly.destroy(); state.charts.monthly = null; }

  state.charts.monthly = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Spent',
        data,
        backgroundColor: '#6366f1',
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => CURRENCY_SYMBOL + v },
          grid: { color: '#f1f5f9' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderRecentTransactions() {
  const container = document.getElementById('recent-transactions');
  const recent    = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-text">No expenses yet – add your first one!</p>';
    return;
  }
  container.innerHTML = recent.map(e => expenseItemHTML(e, false)).join('');
}

// ────────────────────────────────────────────────────────────
// EXPENSES
// ────────────────────────────────────────────────────────────

function getFiltered() {
  const { search, category, startDate, endDate } = state.filters;
  return state.expenses
    .filter(e => {
      if (search    && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (category  && e.category !== category) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate   && e.date > endDate)   return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderExpenses() {
  populateCategoryFilter();
  const list     = document.getElementById('expense-list');
  const filtered = getFiltered();
  const label    = document.getElementById('expense-count-label');
  label.textContent = `${filtered.length} expense${filtered.length !== 1 ? 's' : ''} • Total: ${fmt(filtered.reduce((s, e) => s + e.amount, 0))}`;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💸</div>
      <p>${state.expenses.length === 0 ? 'No expenses yet!' : 'No matching expenses.'}</p>
      <p class="empty-sub">${state.expenses.length === 0 ? 'Click "+ Add Expense" to get started.' : 'Try adjusting your filters.'}</p>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(e =>
    `<div class="card expense-card" data-id="${e.id}">${expenseItemHTML(e, true)}</div>`
  ).join('');
}

// Build the inner HTML for one expense row (reused in dashboard + expense list)
function expenseItemHTML(expense, showActions) {
  const cat          = getCategory(expense.category);
  const payer        = getMember(expense.paidBy);
  const participants = expense.splits.map(s => getMember(s.memberId));

  const avatars = participants.slice(0, 5).map(m =>
    `<span class="mini-avatar" style="background:${m.color}" title="${esc(m.name)}">${esc(m.initials)}</span>`
  ).join('') + (participants.length > 5
    ? `<span class="mini-avatar more">+${participants.length - 5}</span>` : '');

  const actions = showActions ? `
    <div class="expense-actions">
      <button class="btn-action edit"   onclick="openEditExpenseModal('${expense.id}')" title="Edit">✏️</button>
      <button class="btn-action delete" onclick="confirmDelete('expense','${expense.id}')" title="Delete">🗑️</button>
    </div>` : '';

  return `
    <div class="expense-item">
      <div class="expense-cat-dot" style="background:${cat.color}"></div>
      <div class="expense-info">
        <div class="expense-title">${esc(expense.title)}</div>
        <div class="expense-meta">
          <span class="expense-date">${fmtDate(expense.date)}</span>
          <span class="cat-badge" style="background:${cat.color}20;color:${cat.color}">${cat.icon} ${cat.name}</span>
          <span class="payer-info">Paid by <strong>${esc(payer.name)}</strong></span>
        </div>
        <div class="expense-participants">${avatars}</div>
      </div>
      <div class="expense-amount">
        <div class="amount-value">${fmt(expense.amount)}</div>
        ${expense.notes ? `<div class="expense-note">${esc(expense.notes)}</div>` : ''}
      </div>
      ${actions}
    </div>`;
}

function populateCategoryFilter() {
  const sel     = document.getElementById('filter-category');
  const current = sel.value;
  sel.innerHTML = '<option value="">All Categories</option>' +
    CATEGORIES.map(c => `<option value="${c.id}" ${current === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');
}

// ────────────────────────────────────────────────────────────
// EXPENSE MODAL – open / populate / save
// ────────────────────────────────────────────────────────────

function openAddExpenseModal() {
  if (state.members.length === 0) {
    return showToast('Add at least one member first.', 'error');
  }
  state.editingExpenseId = null;
  state.splitType        = 'equal';
  document.getElementById('expense-modal-title').textContent = 'Add Expense';
  document.getElementById('expense-form').reset();
  document.getElementById('exp-date').value = todayISO();
  syncSplitTypeUI();
  populateExpenseSelects('', 'food');
  renderSplitMembers(null);
  openModal('expense-modal');
}

function openEditExpenseModal(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (!exp) return;

  state.editingExpenseId = id;
  state.splitType        = exp.splitType || 'equal';

  document.getElementById('expense-modal-title').textContent = 'Edit Expense';
  document.getElementById('exp-title').value  = exp.title;
  document.getElementById('exp-amount').value = exp.amount;
  document.getElementById('exp-date').value   = exp.date;
  document.getElementById('exp-notes').value  = exp.notes || '';

  syncSplitTypeUI();
  populateExpenseSelects(exp.paidBy, exp.category);
  renderSplitMembers(exp.splits);
  openModal('expense-modal');
}

function populateExpenseSelects(paidBy, category) {
  document.getElementById('exp-paid-by').innerHTML =
    '<option value="">Select member…</option>' +
    state.members.map(m => `<option value="${m.id}" ${m.id === paidBy ? 'selected' : ''}>${esc(m.name)}</option>`).join('');

  document.getElementById('exp-category').innerHTML =
    CATEGORIES.map(c => `<option value="${c.id}" ${c.id === category ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');
}

function syncSplitTypeUI() {
  document.querySelectorAll('.split-type-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.type === state.splitType));
  document.getElementById('split-total-row').style.display = state.splitType === 'custom' ? 'flex' : 'none';
}

// Render the split member checkboxes inside the modal
function renderSplitMembers(existingSplits) {
  const container  = document.getElementById('split-members-list');
  const amount     = parseFloat(document.getElementById('exp-amount').value) || 0;
  const selectedIds = existingSplits ? existingSplits.map(s => s.memberId) : state.members.map(m => m.id);
  const perPerson  = selectedIds.length > 0 ? amount / selectedIds.length : 0;

  container.innerHTML = state.members.map(m => {
    const checked = selectedIds.includes(m.id);
    const split   = existingSplits ? existingSplits.find(s => s.memberId === m.id) : null;

    if (state.splitType === 'equal') {
      return `
        <div class="split-member-item">
          <label class="split-member-label">
            <input type="checkbox" class="split-chk" value="${m.id}" ${checked ? 'checked' : ''}>
            <span class="member-avatar-sm" style="background:${m.color}">${esc(m.initials)}</span>
            <span>${esc(m.name)}</span>
          </label>
          <span class="split-share equal-share">${checked ? fmt(perPerson) : fmt(0)}</span>
        </div>`;
    } else {
      const val = split ? split.amount.toFixed(2) : checked ? perPerson.toFixed(2) : '0.00';
      return `
        <div class="split-member-item">
          <label class="split-member-label">
            <input type="checkbox" class="split-chk" value="${m.id}" ${checked ? 'checked' : ''}>
            <span class="member-avatar-sm" style="background:${m.color}">${esc(m.initials)}</span>
            <span>${esc(m.name)}</span>
          </label>
          <input type="number" class="custom-split-input" data-member="${m.id}"
                 value="${val}" step="0.01" min="0" ${!checked ? 'disabled' : ''}>
        </div>`;
    }
  }).join('');

  if (state.splitType === 'custom') refreshCustomTotal();
}

function refreshEqualShares() {
  const amount  = parseFloat(document.getElementById('exp-amount').value) || 0;
  const checked = [...document.querySelectorAll('.split-chk:checked')];
  const per     = checked.length > 0 ? amount / checked.length : 0;
  document.querySelectorAll('.split-member-item').forEach(row => {
    const cb   = row.querySelector('.split-chk');
    const span = row.querySelector('.equal-share');
    if (span) span.textContent = cb.checked ? fmt(per) : fmt(0);
  });
}

function refreshCustomTotal() {
  const amount   = parseFloat(document.getElementById('exp-amount').value) || 0;
  let splitTotal = 0;
  document.querySelectorAll('.custom-split-input:not(:disabled)').forEach(i => {
    splitTotal += parseFloat(i.value) || 0;
  });
  splitTotal = Math.round(splitTotal * 100) / 100;
  const expected = Math.round(amount * 100) / 100;
  const diff     = Math.round((expected - splitTotal) * 100) / 100;

  document.getElementById('split-total-display').textContent = fmt(splitTotal);
  const status = document.getElementById('split-status');
  if (Math.abs(diff) < 0.01) {
    status.textContent = '✓ Matches total';
    status.className   = 'split-status ok';
  } else if (diff > 0) {
    status.textContent = `${fmt(diff)} remaining`;
    status.className   = 'split-status under';
  } else {
    status.textContent = `${fmt(-diff)} over`;
    status.className   = 'split-status over';
  }
}

function saveExpense() {
  const title    = document.getElementById('exp-title').value.trim();
  const amount   = parseFloat(document.getElementById('exp-amount').value);
  const paidBy   = document.getElementById('exp-paid-by').value;
  const date     = document.getElementById('exp-date').value;
  const category = document.getElementById('exp-category').value;
  const notes    = document.getElementById('exp-notes').value.trim();

  // Basic validation
  if (!title)             return showToast('Please enter a title.', 'error');
  if (!amount || amount <= 0) return showToast('Please enter a valid amount.', 'error');
  if (!paidBy)            return showToast('Please select who paid.', 'error');
  if (!date)              return showToast('Please select a date.', 'error');

  const checked = [...document.querySelectorAll('.split-chk:checked')];
  if (checked.length === 0) return showToast('Select at least one person for the split.', 'error');

  // Build splits array
  let splits = [];
  if (state.splitType === 'equal') {
    const per = amount / checked.length;
    splits    = checked.map((cb, i) => {
      // Assign rounding remainder to last person so totals match exactly
      const share = i === checked.length - 1
        ? Math.round((amount - per * (checked.length - 1)) * 100) / 100
        : Math.round(per * 100) / 100;
      return { memberId: cb.value, amount: share };
    });
  } else {
    let total = 0;
    splits = checked.map(cb => {
      const inp = document.querySelector(`.custom-split-input[data-member="${cb.value}"]`);
      const amt = Math.round((parseFloat(inp ? inp.value : 0) || 0) * 100) / 100;
      total += amt;
      return { memberId: cb.value, amount: amt };
    });
    if (Math.abs(Math.round(total * 100) / 100 - Math.round(amount * 100) / 100) > 0.01) {
      return showToast('Custom amounts must sum to the total.', 'error');
    }
  }

  const expense = {
    id:        state.editingExpenseId || generateId(),
    title, amount, paidBy, date, category, notes,
    splitType: state.splitType,
    splits,
  };

  if (state.editingExpenseId) {
    const idx = state.expenses.findIndex(e => e.id === state.editingExpenseId);
    if (idx !== -1) state.expenses[idx] = expense;
    showToast('Expense updated! ✓');
  } else {
    state.expenses.push(expense);
    showToast('Expense added! ✓');
  }

  saveExpenses();
  closeModal('expense-modal');
  renderExpenses();
}

// ────────────────────────────────────────────────────────────
// MEMBERS
// ────────────────────────────────────────────────────────────

function renderMembers() {
  const grid = document.getElementById('members-grid');

  if (state.members.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">👥</div>
      <p>No members yet.</p>
      <p class="empty-sub">Click "+ Add Member" to get started.</p>
    </div>`;
    return;
  }

  grid.innerHTML = state.members.map(m => {
    const paid = state.expenses
      .filter(e => e.paidBy === m.id)
      .reduce((s, e) => s + e.amount, 0);
    const owes = state.expenses
      .reduce((s, e) => s + (e.splits.find(sp => sp.memberId === m.id)?.amount || 0), 0);
    const net  = paid - owes;

    const badgeClass = net > 0.005 ? 'positive' : net < -0.005 ? 'negative' : 'settled';
    const badgeText  = net > 0.005
      ? `Gets back ${fmt(net)}`
      : net < -0.005 ? `Owes ${fmt(-net)}` : 'Settled up ✓';

    return `
      <div class="card member-card">
        <div class="member-card-top">
          <button class="btn-icon-sm danger" onclick="confirmDelete('member','${m.id}')" title="Remove">✕</button>
        </div>
        <div class="member-avatar-lg" style="background:${m.color}">${esc(m.initials)}</div>
        <div class="member-name">${esc(m.name)}</div>
        <div class="member-stats">
          <div class="member-stat">
            <div class="ms-label">Paid</div>
            <div class="ms-value">${fmt(paid)}</div>
          </div>
          <div class="member-stat">
            <div class="ms-label">Share</div>
            <div class="ms-value">${fmt(owes)}</div>
          </div>
          <div class="member-stat">
            <div class="ms-label">Net</div>
            <div class="ms-value ${net >= 0 ? 'positive' : 'negative'}">${fmt(Math.abs(net))}</div>
          </div>
        </div>
        <div class="member-net-badge ${badgeClass}">${badgeText}</div>
      </div>`;
  }).join('');
}

function openAddMemberModal() {
  document.getElementById('member-name').value = '';
  renderColorPicker();
  openModal('member-modal');
}

function renderColorPicker() {
  const used   = new Set(state.members.map(m => m.color));
  const picker = document.getElementById('color-picker');
  picker.innerHTML = MEMBER_COLORS.map((color, i) =>
    `<div class="color-swatch ${i === 0 ? 'selected' : ''}"
          style="background:${color}"
          data-color="${color}"
          title="${color}"
          onclick="selectSwatch(this)"></div>`
  ).join('');

  // Pre-select first unused color
  const firstUnused = MEMBER_COLORS.find(c => !used.has(c));
  if (firstUnused) {
    picker.querySelectorAll('.color-swatch').forEach(sw => {
      sw.classList.toggle('selected', sw.dataset.color === firstUnused);
    });
  }
}

function selectSwatch(el) {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

function saveMember() {
  const name = document.getElementById('member-name').value.trim();
  if (!name) return showToast('Please enter a name.', 'error');
  if (name.length > 40) return showToast('Name is too long (max 40 chars).', 'error');
  if (state.members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
    return showToast('A member with that name already exists.', 'error');
  }

  const swatchEl = document.querySelector('.color-swatch.selected');
  const color    = swatchEl ? swatchEl.dataset.color : MEMBER_COLORS[state.members.length % MEMBER_COLORS.length];

  state.members.push({ id: generateId(), name, color, initials: initials(name) });
  saveMembers();
  renderMembers();
  closeModal('member-modal');
  showToast(`${name} added! ✓`);
}

// ────────────────────────────────────────────────────────────
// BALANCES
// ────────────────────────────────────────────────────────────

function calcNetBalances() {
  return state.members.map(m => {
    const paid = state.expenses
      .filter(e => e.paidBy === m.id)
      .reduce((s, e) => s + e.amount, 0);
    const owes = state.expenses
      .reduce((s, e) => s + (e.splits.find(sp => sp.memberId === m.id)?.amount || 0), 0);
    return { ...m, paid, owes, net: Math.round((paid - owes) * 100) / 100 };
  });
}

// Greedy debt-minimization: returns minimum list of payments
function calcSettlements(netBalances) {
  const debtors   = netBalances.filter(b => b.net < -0.005).map(b => ({ ...b })).sort((a, b) => a.net - b.net);
  const creditors = netBalances.filter(b => b.net >  0.005).map(b => ({ ...b })).sort((a, b) => b.net - a.net);

  const result = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(Math.abs(debtors[i].net), creditors[j].net);
    if (amount < 0.005) { i++; continue; }

    result.push({
      fromId: debtors[i].id, fromName: debtors[i].name,
      fromColor: debtors[i].color, fromInitials: debtors[i].initials,
      toId: creditors[j].id, toName: creditors[j].name,
      toColor: creditors[j].color, toInitials: creditors[j].initials,
      amount: Math.round(amount * 100) / 100,
    });

    debtors[i].net   += amount;
    creditors[j].net -= amount;
    if (Math.abs(debtors[i].net)   < 0.005) i++;
    if (Math.abs(creditors[j].net) < 0.005) j++;
  }
  return result;
}

function renderBalances() {
  const balances    = calcNetBalances();
  const settlements = calcSettlements(balances);

  // Balance summary cards
  document.getElementById('balance-summary').innerHTML = balances.map(b => {
    const cls = b.net > 0.005 ? 'positive' : b.net < -0.005 ? 'negative' : 'settled';
    const amtCls = b.net > 0.005 ? 'positive' : b.net < -0.005 ? 'negative' : 'zero';
    const status  = b.net > 0.005 ? 'gets back' : b.net < -0.005 ? 'owes' : 'settled ✓';
    return `
      <div class="card balance-card ${cls}">
        <div class="balance-avatar" style="background:${b.color}">${esc(b.initials)}</div>
        <div class="balance-info">
          <div class="balance-name">${esc(b.name)}</div>
          <div class="balance-detail">
            <span>Paid: ${fmt(b.paid)}</span>
            <span>Share: ${fmt(b.owes)}</span>
          </div>
        </div>
        <div class="balance-net">
          <div class="balance-amount ${amtCls}">${b.net >= 0 ? '+' : ''}${fmt(b.net)}</div>
          <div class="balance-status">${status}</div>
        </div>
      </div>`;
  }).join('');

  // Suggested settlements
  const list = document.getElementById('settlements-list');
  if (settlements.length === 0) {
    list.innerHTML = '<p class="settled-message">🎉 Everyone is settled up!</p>';
  } else {
    list.innerHTML = settlements.map(s => `
      <div class="settlement-item">
        <div class="settlement-from">
          <span class="mini-avatar" style="background:${s.fromColor}">${esc(s.fromInitials)}</span>
          <strong>${esc(s.fromName)}</strong>
        </div>
        <div class="settlement-mid">
          <span class="settlement-amount">${fmt(s.amount)}</span>
          <span class="settlement-arrow">→</span>
        </div>
        <div class="settlement-to">
          <strong>${esc(s.toName)}</strong>
          <span class="mini-avatar" style="background:${s.toColor}">${esc(s.toInitials)}</span>
        </div>
      </div>`).join('');
  }
}

// ────────────────────────────────────────────────────────────
// IMPORT / EXPORT
// ────────────────────────────────────────────────────────────

function exportData() {
  const payload = {
    version:    '1.0',
    exportedAt: new Date().toISOString(),
    members:    state.members,
    expenses:   state.expenses,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `splitease-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported! 📤');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.members) || !Array.isArray(data.expenses)) throw new Error();
      state.members  = data.members;
      state.expenses = data.expenses;
      saveMembers();
      saveExpenses();
      renderDashboard();
      showToast('Data imported! 📥');
    } catch {
      showToast('Invalid file – please use a SplitEase JSON export.', 'error');
    }
  };
  reader.readAsText(file);
}

// ────────────────────────────────────────────────────────────
// MODAL / CONFIRM HELPERS
// ────────────────────────────────────────────────────────────

function openModal(id)  {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}

function confirmDelete(type, id) {
  state.pendingDeleteId   = id;
  state.pendingDeleteType = type;

  if (type === 'member') {
    const m   = state.members.find(m => m.id === id);
    const ref = state.expenses.some(e => e.paidBy === id || e.splits.some(s => s.memberId === id));
    if (ref) return showToast(`Cannot remove ${m?.name || 'member'} – they appear in expenses.`, 'error');
    document.getElementById('confirm-message').textContent = `Remove "${m?.name || 'this member'}"? This cannot be undone.`;
  } else {
    const exp = state.expenses.find(e => e.id === id);
    document.getElementById('confirm-message').textContent = `Delete "${exp?.title || 'this expense'}"? This cannot be undone.`;
  }

  document.getElementById('confirm-ok-btn').textContent = type === 'member' ? 'Remove' : 'Delete';
  openModal('confirm-modal');
}

function executeDelete() {
  if (state.pendingDeleteType === 'expense') {
    state.expenses = state.expenses.filter(e => e.id !== state.pendingDeleteId);
    saveExpenses();
    renderExpenses();
    showToast('Expense deleted.', 'info');
  } else if (state.pendingDeleteType === 'member') {
    state.members = state.members.filter(m => m.id !== state.pendingDeleteId);
    saveMembers();
    renderMembers();
    showToast('Member removed.', 'info');
  }
  state.pendingDeleteId   = null;
  state.pendingDeleteType = null;
  closeModal('confirm-modal');
}

// ────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ────────────────────────────────────────────────────────────

function initEvents() {
  // ── Tab navigation ──
  document.querySelectorAll('.nav-tab').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // ── Expense modal ──
  document.getElementById('add-expense-btn').addEventListener('click', openAddExpenseModal);
  document.getElementById('close-expense-modal').addEventListener('click', () => closeModal('expense-modal'));
  document.getElementById('cancel-expense-btn').addEventListener('click', () => closeModal('expense-modal'));
  document.getElementById('save-expense-btn').addEventListener('click', saveExpense);

  // Split type toggle buttons
  document.querySelectorAll('.split-type-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      state.splitType = btn.dataset.type;
      syncSplitTypeUI();
      renderSplitMembers(null);  // rebuild with current form values
    }));

  // Amount changes → update split display
  document.getElementById('exp-amount').addEventListener('input', () => {
    if (state.splitType === 'equal') refreshEqualShares();
    else refreshCustomTotal();
  });

  // Split member checkbox / custom amount changes (event delegation)
  document.getElementById('split-members-list').addEventListener('change', e => {
    if (e.target.classList.contains('split-chk')) {
      if (state.splitType === 'equal') {
        refreshEqualShares();
      } else {
        // Enable/disable the amount input for the toggled member
        const row   = e.target.closest('.split-member-item');
        const input = row?.querySelector('.custom-split-input');
        if (input) {
          input.disabled = !e.target.checked;
          if (!e.target.checked) input.value = '0.00';
        }
        refreshCustomTotal();
      }
    }
  });
  document.getElementById('split-members-list').addEventListener('input', e => {
    if (e.target.classList.contains('custom-split-input')) refreshCustomTotal();
  });

  // ── Member modal ──
  document.getElementById('add-member-btn').addEventListener('click', openAddMemberModal);
  document.getElementById('close-member-modal').addEventListener('click', () => closeModal('member-modal'));
  document.getElementById('cancel-member-btn').addEventListener('click', () => closeModal('member-modal'));
  document.getElementById('save-member-btn').addEventListener('click', saveMember);
  document.getElementById('member-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveMember();
  });

  // ── Confirm modal ──
  document.getElementById('close-confirm-modal').addEventListener('click', () => closeModal('confirm-modal'));
  document.getElementById('cancel-confirm-btn').addEventListener('click', () => closeModal('confirm-modal'));
  document.getElementById('confirm-ok-btn').addEventListener('click', executeDelete);

  // ── Import / Export ──
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () =>
    document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', e => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';  // reset so same file can be re-selected
  });

  // ── Filters ──
  const fSearch = document.getElementById('filter-search');
  const fCat    = document.getElementById('filter-category');
  const fStart  = document.getElementById('filter-start');
  const fEnd    = document.getElementById('filter-end');

  fSearch.addEventListener('input',  () => { state.filters.search    = fSearch.value;  renderExpenses(); });
  fCat.addEventListener('change',    () => { state.filters.category  = fCat.value;     renderExpenses(); });
  fStart.addEventListener('change',  () => { state.filters.startDate = fStart.value;   renderExpenses(); });
  fEnd.addEventListener('change',    () => { state.filters.endDate   = fEnd.value;     renderExpenses(); });

  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    state.filters = { search: '', category: '', startDate: '', endDate: '' };
    fSearch.value = ''; fCat.value = ''; fStart.value = ''; fEnd.value = '';
    renderExpenses();
  });

  // ── Close modals on backdrop click or Escape ──
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
  });
}

// ────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────

function init() {
  loadData();
  initEvents();
  renderDashboard();
}

document.addEventListener('DOMContentLoaded', init);

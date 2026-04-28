// ============================================================
// SplitEase – script.js
// ============================================================

// ────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────

const CATEGORIES = [
  // ── Food & Home ──
  { id: 'food',          name: 'Food & Drinks',    icon: '🍔', color: '#f59e0b' },
  { id: 'groceries',     name: 'Groceries',         icon: '🛒', color: '#22c55e' },
  { id: 'home',          name: 'Home / Household',  icon: '🏠', color: '#6366f1' },
  { id: 'rent',          name: 'Rent',              icon: '🏘️', color: '#a855f7' },
  // ── Bills ──
  { id: 'electricity',   name: 'Electricity Bill',  icon: '💡', color: '#eab308' },
  { id: 'gas',           name: 'Gas Bill',          icon: '🔥', color: '#f97316' },
  { id: 'mobile',        name: 'Mobile / Phone',    icon: '📱', color: '#06b6d4' },
  { id: 'utilities',     name: 'Water / Utilities', icon: '⚡', color: '#8b5cf6' },
  { id: 'credit_card',   name: 'Credit Card Bill',  icon: '💳', color: '#f43f5e' },
  // ── Transport ──
  { id: 'transport',     name: 'Transport',         icon: '🚗', color: '#10b981' },
  { id: 'car_emi',       name: 'Car EMI / Loan',    icon: '🚙', color: '#475569' },
  // ── Insurance ──
  { id: 'insurance',     name: 'Insurance',         icon: '🛡️', color: '#0ea5e9' },
  // ── Lifestyle ──
  { id: 'entertainment', name: 'Entertainment',     icon: '🎮', color: '#ec4899' },
  { id: 'subscriptions', name: 'Subscriptions',     icon: '📺', color: '#d946ef' },
  { id: 'shopping',      name: 'Shopping',          icon: '🛍️', color: '#14b8a6' },
  { id: 'travel',        name: 'Travel',            icon: '✈️', color: '#3b82f6' },
  // ── Health ──
  { id: 'healthcare',    name: 'Healthcare',        icon: '💊', color: '#ef4444' },
  // ── Other ──
  { id: 'other',         name: 'Other',             icon: '📦', color: '#64748b' },
];

const MEMBER_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899',
  '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6',
  '#f97316', '#84cc16',
];

const CURRENCY = '$';
const STORAGE = { MEMBERS: 'se_members', EXPENSES: 'se_expenses', GROUPS: 'se_groups' };

// ────────────────────────────────────────────────────────────
// APP STATE
// ────────────────────────────────────────────────────────────

const state = {
  members:  [],
  expenses: [],
  groups:   [],
  filters:  { search: '', category: '', startDate: '', endDate: '', groupId: '' },
  splitType: 'equal',
  chartPeriod: 'monthly',      // 'daily' | 'monthly' | 'yearly'
  chartFilter: { type: 'all', groupId: '', memberIds: [] },
  editingExpenseId: null,
  editingGroupId:   null,      // null = create mode, string = edit mode
  pendingDeleteId:   null,
  pendingDeleteType: null,
  charts: { category: null, spending: null },
};

// ────────────────────────────────────────────────────────────
// STORAGE
// ────────────────────────────────────────────────────────────

const Store = {
  get(key)       { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch { showToast('Storage full – export your data to free space.', 'error'); } },
};

// ────────────────────────────────────────────────────────────
// IMAGE COMPRESSION
// ────────────────────────────────────────────────────────────

// Pending receipt for the currently open expense modal
let pendingReceipt = null; // base64 JPEG string | null

function compressImage(file, maxW = 1200, maxH = 1600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = evt => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), w, h });
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function fmtBytes(b) {
  if (b < 1024)       return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

async function handleReceiptFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please select an image file.', 'error');
    return;
  }
  const status = document.getElementById('receipt-compress-status');
  status.style.display = 'block';
  document.getElementById('receipt-empty').style.display = 'none';
  document.getElementById('receipt-preview-wrap').style.display = 'none';

  try {
    const origSize = file.size;
    const { dataUrl, w, h } = await compressImage(file);
    // base64 string length ≈ 4/3 * bytes
    const compSize = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
    const saved    = Math.round((1 - compSize / origSize) * 100);

    pendingReceipt = dataUrl;
    status.style.display = 'none';

    document.getElementById('receipt-preview-img').src = dataUrl;
    document.getElementById('receipt-size-label').textContent =
      `${w}×${h}px · ${fmtBytes(compSize)} (${saved}% smaller than original)`;
    document.getElementById('receipt-preview-wrap').style.display = 'flex';
  } catch {
    status.style.display = 'none';
    document.getElementById('receipt-empty').style.display = 'flex';
    showToast('Could not compress image.', 'error');
  }
}

function initReceiptUI(existingDataUrl) {
  pendingReceipt = existingDataUrl || null;
  document.getElementById('receipt-compress-status').style.display = 'none';
  document.getElementById('receipt-input').value = '';

  if (existingDataUrl) {
    document.getElementById('receipt-preview-img').src = existingDataUrl;
    document.getElementById('receipt-size-label').textContent = 'Saved photo';
    document.getElementById('receipt-empty').style.display = 'none';
    document.getElementById('receipt-preview-wrap').style.display = 'flex';
  } else {
    document.getElementById('receipt-empty').style.display = 'flex';
    document.getElementById('receipt-preview-wrap').style.display = 'none';
  }
}

function viewReceipt(expId) {
  const exp = state.expenses.find(e => e.id === expId);
  if (!exp || !exp.receipt) return;
  document.getElementById('receipt-view-img').src = exp.receipt;
  openModal('receipt-modal');
}

function loadData() {
  const sm = Store.get(STORAGE.MEMBERS);
  const se = Store.get(STORAGE.EXPENSES);
  const sg = Store.get(STORAGE.GROUPS);
  state.members  = sm || getSampleMembers();
  state.expenses = se || getSampleExpenses();
  state.groups   = sg || getSampleGroups();
  if (!sm) Store.set(STORAGE.MEMBERS,  state.members);
  if (!se) Store.set(STORAGE.EXPENSES, state.expenses);
  if (!sg) Store.set(STORAGE.GROUPS,   state.groups);
}

function saveMembers()  { Store.set(STORAGE.MEMBERS,  state.members);  writeDataToFile(); }
function saveExpenses() { Store.set(STORAGE.EXPENSES, state.expenses); writeDataToFile(); }
function saveGroups()   { Store.set(STORAGE.GROUPS,   state.groups);   writeDataToFile(); }

// ────────────────────────────────────────────────────────────
// SAMPLE DATA
// ────────────────────────────────────────────────────────────

function getSampleMembers() {
  return [
    { id: 'alex',   name: 'Alex',   color: '#6366f1', initials: 'AL' },
    { id: 'jordan', name: 'Jordan', color: '#10b981', initials: 'JO' },
    { id: 'sam',    name: 'Sam',    color: '#f59e0b', initials: 'SA' },
    { id: 'casey',  name: 'Casey',  color: '#ec4899', initials: 'CA' },
  ];
}

function getSampleGroups() {
  return [
    // Only alex, jordan, sam in Home & Bills – NOT casey (demonstrates selective membership)
    { id: 'grp-home', name: 'Home & Bills', color: '#6366f1',
      memberIds: ['alex', 'jordan', 'sam'],
      description: 'Monthly household expenses' },
    // Only alex and jordan in Entertainment
    { id: 'grp-fun', name: 'Entertainment', color: '#ec4899',
      memberIds: ['alex', 'jordan'],
      description: 'Movies, dining, and fun' },
  ];
}

function getSampleExpenses() {
  const all = ['alex', 'jordan', 'sam', 'casey'];
  const y   = new Date().getFullYear();
  const m   = String(new Date().getMonth() + 1).padStart(2, '0');
  const d   = n => `${y}-${m}-${String(n).padStart(2, '0')}`;
  // Previous month for comparison data
  const pm  = String(new Date().getMonth()).padStart(2, '0') || '12';
  const py  = new Date().getMonth() === 0 ? y - 1 : y;
  const pd  = n => `${py}-${pm}-${String(n).padStart(2, '0')}`;

  return [
    { id: 'exp1', title: 'Grocery Shopping', amount: 85.50, paidBy: 'alex',
      date: d(15), category: 'groceries', store: 'Walmart', groupId: 'grp-home', notes: 'Weekly groceries',
      splitType: 'equal', splits: ['alex','jordan','sam'].map(id => ({ memberId: id, amount: +(85.50/3).toFixed(2) })) },

    { id: 'exp2', title: 'Netflix Subscription', amount: 15.99, paidBy: 'jordan',
      date: d(1), category: 'subscriptions', store: 'Netflix', groupId: 'grp-fun', notes: '',
      splitType: 'equal', splits: ['alex','jordan'].map(id => ({ memberId: id, amount: +(15.99/2).toFixed(2) })) },

    { id: 'exp3', title: 'Electricity Bill', amount: 120.00, paidBy: 'sam',
      date: d(10), category: 'electricity', store: 'Duke Energy', groupId: 'grp-home', notes: 'Monthly bill',
      splitType: 'equal', splits: ['alex','jordan','sam'].map(id => ({ memberId: id, amount: 40.00 })) },

    { id: 'exp4', title: 'Uber to Airport', amount: 45.00, paidBy: 'casey',
      date: d(12), category: 'transport', store: '', groupId: '', notes: '',
      splitType: 'equal', splits: [{ memberId: 'alex', amount: 22.50 }, { memberId: 'casey', amount: 22.50 }] },

    { id: 'exp5', title: 'Restaurant Dinner', amount: 180.00, paidBy: 'alex',
      date: d(20), category: 'food', store: 'Chipotle', groupId: 'grp-fun', notes: 'Birthday celebration',
      splitType: 'custom', splits: [
        { memberId: 'alex', amount: 90 }, { memberId: 'jordan', amount: 90 }] },

    { id: 'exp6', title: 'Internet Bill', amount: 79.99, paidBy: 'jordan',
      date: d(5), category: 'utilities', store: 'Spectrum', groupId: 'grp-home', notes: '',
      splitType: 'equal', splits: ['alex','jordan','sam'].map(id => ({ memberId: id, amount: +(79.99/3).toFixed(2) })) },

    { id: 'exp7', title: 'Mobile Phone Bills', amount: 65.00, paidBy: 'sam',
      date: d(8), category: 'mobile', store: 'T-Mobile', groupId: 'grp-home', notes: '',
      splitType: 'equal', splits: ['alex','jordan','sam'].map(id => ({ memberId: id, amount: +(65/3).toFixed(2) })) },

    { id: 'exp8', title: 'Movie Tickets', amount: 48.00, paidBy: 'alex',
      date: d(25), category: 'entertainment', store: '', groupId: 'grp-fun', notes: 'Action night',
      splitType: 'equal', splits: [{ memberId: 'alex', amount: 24 }, { memberId: 'jordan', amount: 24 }] },

    // Previous month data so insights comparison works
    { id: 'exp9', title: 'Last Month Groceries', amount: 72.00, paidBy: 'alex',
      date: pd(14), category: 'groceries', store: 'Walmart', groupId: 'grp-home', notes: '',
      splitType: 'equal', splits: ['alex','jordan','sam'].map(id => ({ memberId: id, amount: 24.00 })) },
    { id: 'exp10', title: 'Last Month Electricity', amount: 95.00, paidBy: 'sam',
      date: pd(8), category: 'electricity', store: 'Duke Energy', groupId: 'grp-home', notes: '',
      splitType: 'equal', splits: ['alex','jordan','sam'].map(id => ({ memberId: id, amount: +(95/3).toFixed(2) })) },
    { id: 'exp11', title: 'Last Month Dining', amount: 120.00, paidBy: 'jordan',
      date: pd(20), category: 'food', store: 'Panera Bread', groupId: 'grp-fun', notes: '',
      splitType: 'equal', splits: ['alex','jordan'].map(id => ({ memberId: id, amount: 60 })) },
  ];
}

// ────────────────────────────────────────────────────────────
// UTILITIES
// ────────────────────────────────────────────────────────────

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmt(v)       { return CURRENCY + Number(v).toFixed(2); }
function fmtDate(s)   { if (!s) return ''; const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function getCategory(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length-1]; }
function getMember(id)   { return state.members.find(m => m.id === id) || { name:'Unknown', color:'#94a3b8', initials:'??' }; }
function getGroup(id)    { return state.groups.find(g => g.id === id) || null; }
function makeInitials(n) { return n.trim().split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function todayISO() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

// ────────────────────────────────────────────────────────────
// NAVIGATION
// ────────────────────────────────────────────────────────────

function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id === `tab-${tabId}`));
  ({ dashboard: renderDashboard, expenses: renderExpenses, groups: renderGroups,
     members: renderMembers, balances: renderBalances })[tabId]?.();
}

// ────────────────────────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────────────────────────

function renderDashboard() {
  renderStats();
  renderInsights();
  renderChartFilterUI();
  renderCategoryChart();
  renderSpendingChart(state.chartPeriod);
  renderRecentTransactions();
}

function renderStats() {
  const total = state.expenses.reduce((s, e) => s + e.amount, 0);
  const now   = new Date();
  const month = state.expenses
    .filter(e => { const [y,m] = e.date.split('-').map(Number); return y===now.getFullYear() && m===now.getMonth()+1; })
    .reduce((s, e) => s + e.amount, 0);
  document.getElementById('stat-total').textContent  = fmt(total);
  document.getElementById('stat-month').textContent  = fmt(month);
  document.getElementById('stat-count').textContent  = state.expenses.length;
  document.getElementById('stat-groups').textContent = state.groups.length;
}

// ── Spending Insights ──────────────────────────────────────

function renderInsights() {
  const el = document.getElementById('insights-section');
  if (!el) return;

  const now         = new Date();
  const curYear     = now.getFullYear();
  const curMon      = now.getMonth() + 1;
  const daysInMonth = new Date(curYear, curMon, 0).getDate();
  const dayOfMonth  = now.getDate();

  // This month vs last month
  const expThis = state.expenses.filter(e => {
    const [y, m] = e.date.split('-').map(Number);
    return y === curYear && m === curMon;
  });
  const totalThis = expThis.reduce((s, e) => s + e.amount, 0);

  const lastDate  = new Date(curYear, curMon - 2, 1);
  const expLast   = state.expenses.filter(e => {
    const [y, m] = e.date.split('-').map(Number);
    return y === lastDate.getFullYear() && m === lastDate.getMonth() + 1;
  });
  const totalLast = expLast.reduce((s, e) => s + e.amount, 0);

  // 3-month rolling average (months before this one)
  const avg3 = [1, 2, 3].map(i => {
    const d = new Date(curYear, curMon - 1 - i, 1);
    return state.expenses
      .filter(e => { const [y,m] = e.date.split('-').map(Number); return y===d.getFullYear() && m===d.getMonth()+1; })
      .reduce((s, e) => s + e.amount, 0);
  });
  const avg3Total = avg3.reduce((s, v) => s + v, 0) / 3;

  // Top category this month
  const catMap = {};
  expThis.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
  const topEntry = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  const topCat   = topEntry ? getCategory(topEntry[0]) : null;
  const topPct   = topEntry && totalThis > 0 ? ((topEntry[1] / totalThis) * 100).toFixed(0) : 0;

  const dailyAvg    = dayOfMonth > 0 ? totalThis / dayOfMonth : 0;
  const projected   = dayOfMonth > 0 ? (totalThis / dayOfMonth) * daysInMonth : 0;

  const insights = [];

  // ① Month vs last month
  if (totalLast > 0) {
    const pct  = ((totalThis - totalLast) / totalLast) * 100;
    const up   = pct > 0;
    const type = pct > 25 ? 'danger' : pct > 8 ? 'warning' : pct < -8 ? 'success' : 'neutral';
    const msg  = pct > 25 ? '⚠️ Significantly above last month'
               : pct > 8  ? 'Slightly above last month'
               : pct < -8 ? '✓ Below last month — great!'
               : 'Similar to last month';
    insights.push({
      icon: pct > 15 ? '⚠️' : pct < -5 ? '✅' : '📊',
      title: 'vs Last Month',
      value: `${up ? '↑' : '↓'}${Math.abs(pct).toFixed(0)}%`,
      detail: `${fmt(totalThis)} vs ${fmt(totalLast)}`,
      type, msg,
    });
  }

  // ② Month projection
  if (dayOfMonth < daysInMonth && totalThis > 0) {
    const projType = projected > totalLast * 1.25 ? 'danger'
                   : projected > totalLast * 1.08  ? 'warning' : 'success';
    insights.push({
      icon: '🔮',
      title: 'Month Projection',
      value: fmt(projected),
      detail: `${dayOfMonth} of ${daysInMonth} days elapsed`,
      type: projType,
      msg: `Pace: ${fmt(dailyAvg)} / day`,
    });
  }

  // ③ vs 3-month average (only if we have data)
  if (avg3Total > 0 && dayOfMonth >= 10) {
    const pct  = ((totalThis - avg3Total) / avg3Total) * 100;
    const type = pct > 25 ? 'danger' : pct > 8 ? 'warning' : pct < -8 ? 'success' : 'neutral';
    insights.push({
      icon: '📈',
      title: 'vs 3-Mo Avg',
      value: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`,
      detail: `Avg: ${fmt(avg3Total)}`,
      type,
      msg: pct > 15 ? 'Well above your average' : pct < -15 ? 'Well below average' : 'Near your average',
    });
  }

  // ④ Top category
  if (topCat) {
    const type = parseInt(topPct) > 55 ? 'warning' : 'neutral';
    insights.push({
      icon: topCat.icon,
      title: 'Top Category',
      value: topCat.name,
      detail: `${topPct}% of this month`,
      type,
      msg: fmt(topEntry[1]) + ' spent',
    });
  }

  // ⑤ This month summary
  insights.push({
    icon: '🧾',
    title: 'This Month',
    value: `${expThis.length} expenses`,
    detail: fmt(totalThis) + ' total',
    type: 'info',
    msg: `Daily avg ${fmt(dailyAvg)}`,
  });

  if (insights.length === 0) {
    el.innerHTML = '<p class="empty-text">Add expenses to see insights.</p>';
    return;
  }

  el.innerHTML = insights.map(ins => `
    <div class="insight-card insight-${ins.type}">
      <div class="insight-icon">${ins.icon}</div>
      <div class="insight-title">${ins.title}</div>
      <div class="insight-value">${ins.value}</div>
      <div class="insight-detail">${ins.detail}</div>
      <div class="insight-msg">${ins.msg}</div>
    </div>`).join('');
}

// ── Chart filter helpers ────────────────────────────────────

function getChartExpenses() {
  const { type, groupId, memberIds } = state.chartFilter;
  if (type === 'group') {
    return groupId ? state.expenses.filter(e => e.groupId === groupId) : state.expenses;
  }
  if (type === 'members' && memberIds.length > 0) {
    return state.expenses.filter(e => e.splits.some(s => memberIds.includes(s.memberId)));
  }
  return state.expenses;
}

function renderChartFilterUI() {
  const { type, groupId, memberIds } = state.chartFilter;
  const body = document.getElementById('chart-filter-body');
  if (!body) return;

  // Sync active tab button
  document.querySelectorAll('.chart-filter-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === type));

  if (type === 'all') {
    body.innerHTML = '';
    return;
  }

  if (type === 'group') {
    body.innerHTML = `
      <div class="chart-filter-selector">
        <label class="filter-label">Select a group to filter charts:</label>
        <select id="chart-group-sel" class="input" style="max-width:320px;margin-top:6px">
          <option value="">— Show all groups —</option>
          ${state.groups.map(g =>
            `<option value="${g.id}" ${g.id===groupId?'selected':''}>${esc(g.name)}</option>`
          ).join('')}
        </select>
      </div>`;
    document.getElementById('chart-group-sel').addEventListener('change', e => {
      state.chartFilter.groupId = e.target.value;
      renderCategoryChart();
      renderSpendingChart(state.chartPeriod);
    });
    return;
  }

  if (type === 'members') {
    body.innerHTML = `
      <div class="chart-filter-selector">
        <label class="filter-label">Select one or more members to filter charts:</label>
        <div class="chart-member-picker">
          ${state.members.map(m => `
            <label class="chart-member-label">
              <input type="checkbox" class="chart-member-chk" value="${m.id}"
                     ${memberIds.includes(m.id)?'checked':''}>
              <span class="member-avatar-sm" style="background:${m.color}">${esc(m.initials)}</span>
              <span>${esc(m.name)}</span>
            </label>`).join('')}
        </div>
      </div>`;
    body.querySelectorAll('.chart-member-chk').forEach(cb => {
      cb.addEventListener('change', () => {
        state.chartFilter.memberIds = [...body.querySelectorAll('.chart-member-chk:checked')].map(c => c.value);
        renderCategoryChart();
        renderSpendingChart(state.chartPeriod);
      });
    });
  }
}

// ── Category chart ──────────────────────────────────────────

function renderCategoryChart() {
  const canvas = document.getElementById('category-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const totals  = {};
  getChartExpenses().forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  if (state.charts.category) { state.charts.category.destroy(); state.charts.category = null; }

  if (!entries.length) {
    document.getElementById('category-legend').innerHTML = '<p class="empty-text">No expenses yet.</p>';
    return;
  }

  const labels = entries.map(([id]) => getCategory(id).name);
  const data   = entries.map(([, v]) => v);
  const colors = entries.map(([id]) => getCategory(id).color);

  state.charts.category = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: true, cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } },
      },
    },
  });

  document.getElementById('category-legend').innerHTML = labels.map((label, i) =>
    `<div class="legend-item">
       <span class="legend-dot" style="background:${colors[i]}"></span>
       <span class="legend-label">${label}</span>
       <span class="legend-value">${fmt(data[i])}</span>
     </div>`
  ).join('');
}

// ── Spending chart with period selector ────────────────────

function renderSpendingChart(period) {
  const canvas = document.getElementById('spending-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const titleEl = document.getElementById('spending-chart-title');
  let labels = [], data = [], barColor = '#6366f1';

  const chartExp = getChartExpenses();

  if (period === 'daily') {
    // Last 30 days
    if (titleEl) titleEl.textContent = 'Daily Spending (Last 30 Days)';
    for (let i = 29; i >= 0; i--) {
      const d    = new Date(); d.setDate(d.getDate() - i);
      const iso  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      labels.push(d.toLocaleDateString('en-US', { month:'short', day:'numeric' }));
      data.push(chartExp.filter(e => e.date === iso).reduce((s, e) => s + e.amount, 0));
    }

  } else if (period === 'monthly') {
    // Last 12 months
    if (titleEl) titleEl.textContent = 'Monthly Spending (Last 12 Months)';
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear(), mo = d.getMonth() + 1;
      labels.push(d.toLocaleDateString('en-US', { month:'short', year:'2-digit' }));
      data.push(chartExp
        .filter(e => { const [ey,em] = e.date.split('-').map(Number); return ey===yr && em===mo; })
        .reduce((s, e) => s + e.amount, 0));
    }

  } else { // yearly
    if (titleEl) titleEl.textContent = 'Yearly Spending';
    const years = [...new Set(chartExp.map(e => e.date.slice(0,4)))].sort();
    if (!years.length) years.push(String(new Date().getFullYear()));
    labels = years;
    data   = years.map(yr => chartExp.filter(e => e.date.startsWith(yr)).reduce((s, e) => s + e.amount, 0));
  }

  if (state.charts.spending) { state.charts.spending.destroy(); state.charts.spending = null; }

  state.charts.spending = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Spent', data, backgroundColor: barColor, borderRadius: 6, borderSkipped: false }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } },
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => CURRENCY + v }, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false }, ticks: { maxRotation: period === 'daily' ? 45 : 0 } },
      },
    },
  });
}

function renderRecentTransactions() {
  const el     = document.getElementById('recent-transactions');
  const recent = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  el.innerHTML = recent.length
    ? recent.map(e => expenseItemHTML(e, false)).join('')
    : '<p class="empty-text">No expenses yet – add your first one!</p>';
}

// ────────────────────────────────────────────────────────────
// EXPENSES
// ────────────────────────────────────────────────────────────

function getFiltered() {
  const { search, category, startDate, endDate, groupId } = state.filters;
  return state.expenses
    .filter(e => {
      if (search    && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (category  && e.category !== category) return false;
      if (groupId === '__none__') { if (e.groupId && e.groupId !== '') return false; }
      else if (groupId) { if ((e.groupId || '') !== groupId) return false; }
      if (startDate && e.date < startDate) return false;
      if (endDate   && e.date > endDate)   return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderExpenses() {
  populateCategoryFilter();
  populateGroupFilter();
  const list     = document.getElementById('expense-list');
  const filtered = getFiltered();
  const label    = document.getElementById('expense-count-label');
  label.textContent = `${filtered.length} expense${filtered.length !== 1 ? 's' : ''} • ${fmt(filtered.reduce((s,e)=>s+e.amount,0))} total`;

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💸</div>
      <p>${state.expenses.length === 0 ? 'No expenses yet!' : 'No matching expenses.'}</p>
      <p class="empty-sub">${state.expenses.length === 0 ? 'Click "+ Add Expense" to get started.' : 'Try adjusting filters.'}</p>
    </div>`;
    return;
  }
  list.innerHTML = filtered.map(e => `<div class="card expense-card">${expenseItemHTML(e, true)}</div>`).join('');
}

function expenseItemHTML(expense, showActions) {
  const cat          = getCategory(expense.category);
  const payer        = getMember(expense.paidBy);
  const participants = expense.splits.map(s => getMember(s.memberId));
  const group        = expense.groupId ? getGroup(expense.groupId) : null;

  const avatars = participants.slice(0, 5).map(m =>
    `<span class="mini-avatar" style="background:${m.color}" title="${esc(m.name)}">${esc(m.initials)}</span>`
  ).join('') + (participants.length > 5 ? `<span class="mini-avatar more">+${participants.length-5}</span>` : '');

  const storeBadge   = expense.store   ? `<span class="store-badge">🏪 ${esc(expense.store)}</span>` : '';
  const groupBadge   = group           ? `<span class="group-badge" style="background:${group.color}20;color:${group.color}">🏠 ${esc(group.name)}</span>` : '';
  const receiptBadge = expense.receipt ? `<span class="receipt-badge">📷 receipt</span>` : '';

  const receiptThumb = expense.receipt && showActions
    ? `<div class="receipt-thumb-wrap" onclick="viewReceipt('${expense.id}')" title="View bill photo">
         <img src="${expense.receipt}" class="receipt-thumb" alt="Receipt">
       </div>` : '';

  const actions = showActions ? `
    <div class="expense-actions">
      ${expense.receipt ? `<button class="btn-action receipt-view" onclick="viewReceipt('${expense.id}')" title="View receipt">📷</button>` : ''}
      <button class="btn-action edit"   onclick="openEditExpenseModal('${expense.id}')" title="Edit">✏️</button>
      <button class="btn-action delete" onclick="confirmDelete('expense','${expense.id}')" title="Delete">🗑️</button>
    </div>` : '';

  return `
    <div class="expense-item">
      <div class="expense-cat-dot" style="background:${cat.color}"></div>
      ${receiptThumb}
      <div class="expense-info">
        <div class="expense-title">${esc(expense.title)}</div>
        <div class="expense-meta">
          <span class="expense-date">${fmtDate(expense.date)}</span>
          <span class="cat-badge" style="background:${cat.color}20;color:${cat.color}">${cat.icon} ${cat.name}</span>
          <span class="payer-info">Paid by <strong>${esc(payer.name)}</strong></span>
          ${storeBadge}${groupBadge}${receiptBadge}
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
  const sel = document.getElementById('filter-category');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Categories</option>' +
    CATEGORIES.map(c => `<option value="${c.id}" ${cur===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('');
}

function populateGroupFilter() {
  const sel = document.getElementById('filter-group');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Groups</option><option value="__none__">Ungrouped</option>' +
    state.groups.map(g => `<option value="${g.id}" ${cur===g.id?'selected':''}>${esc(g.name)}</option>`).join('');
}

// ────────────────────────────────────────────────────────────
// EXPENSE MODAL
// ────────────────────────────────────────────────────────────

function openAddExpenseModal() {
  if (!state.members.length) return showToast('Add at least one member first.', 'error');
  state.editingExpenseId = null;
  state.splitType        = 'equal';
  document.getElementById('expense-modal-title').textContent = 'Add Expense';
  document.getElementById('expense-form').reset();
  document.getElementById('exp-date').value = todayISO();
  syncSplitTypeUI();
  populateExpenseFormSelects('', 'food', '', '');
  renderSplitMembers(null);
  document.getElementById('group-hint').style.display = 'none';
  initReceiptUI(null);
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
  document.getElementById('exp-store').value  = exp.store || '';
  syncSplitTypeUI();
  populateExpenseFormSelects(exp.paidBy, exp.category, exp.groupId || '', exp.store || '');
  renderSplitMembers(exp.splits);
  updateGroupHint(exp.groupId || '');
  initReceiptUI(exp.receipt || null);
  openModal('expense-modal');
}

function populateExpenseFormSelects(paidBy, category, groupId) {
  document.getElementById('exp-paid-by').innerHTML =
    '<option value="">Select member…</option>' +
    state.members.map(m => `<option value="${m.id}" ${m.id===paidBy?'selected':''}>${esc(m.name)}</option>`).join('');

  document.getElementById('exp-category').innerHTML =
    CATEGORIES.map(c => `<option value="${c.id}" ${c.id===category?'selected':''}>${c.icon} ${c.name}</option>`).join('');

  document.getElementById('exp-group').innerHTML =
    '<option value="">No group</option>' +
    state.groups.map(g => `<option value="${g.id}" ${g.id===groupId?'selected':''}>${esc(g.name)}</option>`).join('');
}

function syncSplitTypeUI() {
  document.querySelectorAll('.split-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === state.splitType));
  document.getElementById('split-total-row').style.display = state.splitType === 'custom' ? 'flex' : 'none';
}

function updateGroupHint(groupId) {
  const hint = document.getElementById('group-hint');
  const text = document.getElementById('group-hint-text');
  if (!groupId) { hint.style.display = 'none'; return; }
  const g = getGroup(groupId);
  if (!g) { hint.style.display = 'none'; return; }
  const names = g.memberIds.map(id => getMember(id).name).join(', ');
  text.textContent = `Split applies to: ${names}`;
  hint.style.display = 'flex';
}

function applyGroupMembers() {
  const groupId = document.getElementById('exp-group').value;
  const g = getGroup(groupId);
  if (!g) return;
  renderSplitMembers(g.memberIds.map(id => ({ memberId: id, amount: 0 })));
  showToast(`Applied ${g.name} members.`, 'info');
}

// ────────────────────────────────────────────────────────────
// SPLIT RENDERING
// ────────────────────────────────────────────────────────────

function renderSplitMembers(existingSplits) {
  const container   = document.getElementById('split-members-list');
  const amount      = parseFloat(document.getElementById('exp-amount').value) || 0;
  const selectedIds = existingSplits ? existingSplits.map(s => s.memberId) : state.members.map(m => m.id);
  const perPerson   = selectedIds.length > 0 ? amount / selectedIds.length : 0;

  container.innerHTML = state.members.map(m => {
    const checked = selectedIds.includes(m.id);
    const split   = existingSplits?.find(s => s.memberId === m.id);

    if (state.splitType === 'equal') {
      return `
        <div class="split-member-item">
          <label class="split-member-label">
            <input type="checkbox" class="split-chk" value="${m.id}" ${checked?'checked':''}>
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
            <input type="checkbox" class="split-chk" value="${m.id}" ${checked?'checked':''}>
            <span class="member-avatar-sm" style="background:${m.color}">${esc(m.initials)}</span>
            <span>${esc(m.name)}</span>
          </label>
          <input type="number" class="custom-split-input" data-member="${m.id}"
                 value="${val}" step="0.01" min="0" ${!checked?'disabled':''}>
        </div>`;
    }
  }).join('');

  if (state.splitType === 'custom') refreshCustomTotal();
}

function refreshEqualShares() {
  const amount  = parseFloat(document.getElementById('exp-amount').value) || 0;
  const checked = [...document.querySelectorAll('.split-chk:checked')];
  const per     = checked.length ? amount / checked.length : 0;
  document.querySelectorAll('.split-member-item').forEach(row => {
    const cb   = row.querySelector('.split-chk');
    const span = row.querySelector('.equal-share');
    if (span) span.textContent = cb.checked ? fmt(per) : fmt(0);
  });
}

function refreshCustomTotal() {
  const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
  let total = 0;
  document.querySelectorAll('.custom-split-input:not(:disabled)').forEach(i => total += parseFloat(i.value) || 0);
  total = Math.round(total * 100) / 100;
  const diff = Math.round((amount - total) * 100) / 100;
  document.getElementById('split-total-display').textContent = fmt(total);
  const s = document.getElementById('split-status');
  if (Math.abs(diff) < 0.01) { s.textContent = '✓ Matches'; s.className = 'split-status ok'; }
  else if (diff > 0)         { s.textContent = `${fmt(diff)} remaining`; s.className = 'split-status under'; }
  else                       { s.textContent = `${fmt(-diff)} over`;     s.className = 'split-status over'; }
}

function saveExpense() {
  const title    = document.getElementById('exp-title').value.trim();
  const amount   = parseFloat(document.getElementById('exp-amount').value);
  const paidBy   = document.getElementById('exp-paid-by').value;
  const date     = document.getElementById('exp-date').value;
  const category = document.getElementById('exp-category').value;
  const store    = document.getElementById('exp-store').value.trim();
  const groupId  = document.getElementById('exp-group').value;
  const notes    = document.getElementById('exp-notes').value.trim();

  if (!title)           return showToast('Please enter a title.', 'error');
  if (!amount||amount<=0) return showToast('Please enter a valid amount.', 'error');
  if (!paidBy)          return showToast('Please select who paid.', 'error');
  if (!date)            return showToast('Please select a date.', 'error');

  const checked = [...document.querySelectorAll('.split-chk:checked')];
  if (!checked.length)  return showToast('Select at least one person for the split.', 'error');

  let splits = [];
  if (state.splitType === 'equal') {
    const per = amount / checked.length;
    splits = checked.map((cb, i) => ({
      memberId: cb.value,
      amount: i === checked.length - 1
        ? Math.round((amount - per * (checked.length - 1)) * 100) / 100
        : Math.round(per * 100) / 100,
    }));
  } else {
    let total = 0;
    splits = checked.map(cb => {
      const inp = document.querySelector(`.custom-split-input[data-member="${cb.value}"]`);
      const amt = Math.round((parseFloat(inp?.value || 0) || 0) * 100) / 100;
      total += amt; return { memberId: cb.value, amount: amt };
    });
    if (Math.abs(Math.round(total*100)/100 - Math.round(amount*100)/100) > 0.01)
      return showToast('Custom amounts must sum to the total.', 'error');
  }

  const expense = { id: state.editingExpenseId || generateId(), title, amount, paidBy, date, category, store, groupId, notes, splitType: state.splitType, splits, receipt: pendingReceipt || null };

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
// GROUPS  (create + edit — like Splitwise group management)
// ────────────────────────────────────────────────────────────

function renderGroups() {
  const grid = document.getElementById('groups-grid');
  if (!state.groups.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🏠</div><p>No groups yet.</p>
      <p class="empty-sub">Create a group and pick exactly which members share those expenses.</p>
    </div>`;
    return;
  }

  grid.innerHTML = state.groups.map(g => {
    const members  = g.memberIds.map(id => getMember(id));
    const expenses = state.expenses.filter(e => e.groupId === g.id);
    const total    = expenses.reduce((s, e) => s + e.amount, 0);

    const memberPills = members.map(m =>
      `<span class="group-member-pill">
        <span class="group-pill-dot" style="background:${m.color}"></span>
        ${esc(m.name)}
      </span>`
    ).join('');

    return `
      <div class="group-card card">
        <div class="group-card-header" style="background:${g.color}">
          <span class="group-card-name">${esc(g.name)}</span>
          <div style="display:flex;gap:6px">
            <button class="group-delete-btn" onclick="openEditGroupModal('${g.id}')" title="Edit group">✏️</button>
            <button class="group-delete-btn" onclick="confirmDelete('group','${g.id}')" title="Delete group">✕</button>
          </div>
        </div>
        <div class="group-card-body">
          ${g.description ? `<p class="group-desc">${esc(g.description)}</p>` : ''}
          <div class="group-members-label">Members (${members.length})</div>
          <div class="group-member-pills">${memberPills}</div>
          <div class="group-stats-row">
            <span>${expenses.length} expense${expenses.length!==1?'s':''}</span>
            <span>•</span><span class="group-total">${fmt(total)}</span>
          </div>
          <button class="btn btn-ghost group-view-btn" onclick="filterByGroup('${g.id}')">View Expenses →</button>
        </div>
      </div>`;
  }).join('');
}

function filterByGroup(groupId) {
  state.filters.groupId = groupId;
  switchTab('expenses');
  setTimeout(() => { const s = document.getElementById('filter-group'); if (s) s.value = groupId; }, 0);
}

// ── Create Group ──

function openAddGroupModal() {
  if (!state.members.length) return showToast('Add members first.', 'error');
  state.editingGroupId = null;
  document.getElementById('group-modal-title').textContent = 'Create Group';
  document.getElementById('save-group-btn').textContent    = 'Create Group';
  document.getElementById('group-name').value = '';
  document.getElementById('group-desc').value = '';
  renderGroupColorPicker(null);
  // Pass empty array → NO members pre-checked (user picks explicitly)
  renderGroupMemberPicker([]);
  openModal('group-modal');
}

// ── Edit Group ──

function openEditGroupModal(id) {
  const g = getGroup(id);
  if (!g) return;
  state.editingGroupId = id;
  document.getElementById('group-modal-title').textContent = 'Edit Group';
  document.getElementById('save-group-btn').textContent    = 'Save Changes';
  document.getElementById('group-name').value = g.name;
  document.getElementById('group-desc').value = g.description || '';
  renderGroupColorPicker(g.color);
  // Pass existing memberIds → those members are pre-checked
  renderGroupMemberPicker(g.memberIds);
  openModal('group-modal');
}

function renderGroupColorPicker(selectedColor) {
  const picker = document.getElementById('group-color-picker');
  picker.innerHTML = MEMBER_COLORS.map(color =>
    `<div class="color-swatch ${color===selectedColor?'selected':''}"
          style="background:${color}" data-color="${color}"
          onclick="selectSwatch(this)"></div>`
  ).join('');
  // If nothing selected, default to first unused
  if (!selectedColor) {
    const used   = new Set(state.groups.map(g => g.color));
    const first  = MEMBER_COLORS.find(c => !used.has(c)) || MEMBER_COLORS[0];
    picker.querySelector(`[data-color="${first}"]`)?.classList.add('selected');
  }
}

function renderGroupMemberPicker(selectedIds) {
  // selectedIds: string[] — members to pre-check
  // Empty array [] = none pre-checked (create mode)
  const container = document.getElementById('group-member-picker');
  container.innerHTML = state.members.map(m => {
    const checked = selectedIds.includes(m.id);
    return `
      <div class="split-member-item">
        <label class="split-member-label">
          <input type="checkbox" class="group-member-chk" value="${m.id}" ${checked?'checked':''}>
          <span class="member-avatar-sm" style="background:${m.color}">${esc(m.initials)}</span>
          <span>${esc(m.name)}</span>
        </label>
      </div>`;
  }).join('');
}

function saveGroup() {
  const name      = document.getElementById('group-name').value.trim();
  const desc      = document.getElementById('group-desc').value.trim();
  const memberIds = [...document.querySelectorAll('.group-member-chk:checked')].map(cb => cb.value);

  if (!name)           return showToast('Please enter a group name.', 'error');
  if (!memberIds.length) return showToast('Select at least one member.', 'error');

  // Duplicate check (exclude self when editing)
  const dup = state.groups.find(g => g.name.toLowerCase() === name.toLowerCase() && g.id !== state.editingGroupId);
  if (dup)             return showToast('A group with that name already exists.', 'error');

  const swatchEl = document.querySelector('#group-color-picker .color-swatch.selected');
  const color    = swatchEl ? swatchEl.dataset.color : MEMBER_COLORS[0];

  if (state.editingGroupId) {
    // Edit existing group
    const idx = state.groups.findIndex(g => g.id === state.editingGroupId);
    if (idx !== -1) state.groups[idx] = { ...state.groups[idx], name, description: desc, color, memberIds };
    showToast(`"${name}" updated! ✓`);
  } else {
    // Create new group
    state.groups.push({ id: generateId(), name, color, memberIds, description: desc });
    showToast(`"${name}" created! ✓`);
  }

  saveGroups();
  renderGroups();
  closeModal('group-modal');
}

// ────────────────────────────────────────────────────────────
// MEMBERS
// ────────────────────────────────────────────────────────────

function renderMembers() {
  const grid = document.getElementById('members-grid');
  if (!state.members.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">👥</div><p>No members yet.</p>
      <p class="empty-sub">Click "+ Add Member" to get started.</p>
    </div>`;
    return;
  }
  grid.innerHTML = state.members.map(m => {
    const paid = state.expenses.filter(e => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0);
    const owes = state.expenses.reduce((s, e) => s + (e.splits.find(sp => sp.memberId === m.id)?.amount || 0), 0);
    const net  = paid - owes;
    const cls  = net > 0.005 ? 'positive' : net < -0.005 ? 'negative' : 'settled';
    const txt  = net > 0.005 ? `Gets back ${fmt(net)}` : net < -0.005 ? `Owes ${fmt(-net)}` : 'Settled up ✓';
    return `
      <div class="card member-card">
        <div class="member-card-top">
          <button class="btn-icon-sm danger" onclick="confirmDelete('member','${m.id}')" title="Remove">✕</button>
        </div>
        <div class="member-avatar-lg" style="background:${m.color}">${esc(m.initials)}</div>
        <div class="member-name">${esc(m.name)}</div>
        <div class="member-stats">
          <div class="member-stat"><div class="ms-label">Paid</div><div class="ms-value">${fmt(paid)}</div></div>
          <div class="member-stat"><div class="ms-label">Share</div><div class="ms-value">${fmt(owes)}</div></div>
          <div class="member-stat"><div class="ms-label">Net</div><div class="ms-value ${net>=0?'positive':'negative'}">${fmt(Math.abs(net))}</div></div>
        </div>
        <div class="member-net-badge ${cls}">${txt}</div>
      </div>`;
  }).join('');
}

function openAddMemberModal() {
  document.getElementById('member-name').value = '';
  renderMemberColorPicker();
  openModal('member-modal');
}

function renderMemberColorPicker() {
  const used   = new Set(state.members.map(m => m.color));
  const picker = document.getElementById('color-picker');
  picker.innerHTML = MEMBER_COLORS.map(color =>
    `<div class="color-swatch" style="background:${color}" data-color="${color}" onclick="selectSwatch(this)"></div>`
  ).join('');
  const first = MEMBER_COLORS.find(c => !used.has(c)) || MEMBER_COLORS[0];
  picker.querySelector(`[data-color="${first}"]`)?.classList.add('selected');
}

function selectSwatch(el) {
  el.closest('.color-picker').querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

function saveMember() {
  const name = document.getElementById('member-name').value.trim();
  if (!name)          return showToast('Please enter a name.', 'error');
  if (name.length>40) return showToast('Name too long (max 40 chars).', 'error');
  if (state.members.some(m => m.name.toLowerCase() === name.toLowerCase()))
    return showToast('A member with that name already exists.', 'error');
  const swatch = document.querySelector('#color-picker .color-swatch.selected');
  const color  = swatch?.dataset.color || MEMBER_COLORS[state.members.length % MEMBER_COLORS.length];
  state.members.push({ id: generateId(), name, color, initials: makeInitials(name) });
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
    const paid = state.expenses.filter(e => e.paidBy === m.id).reduce((s, e) => s + e.amount, 0);
    const owes = state.expenses.reduce((s, e) => s + (e.splits.find(sp => sp.memberId === m.id)?.amount || 0), 0);
    return { ...m, paid, owes, net: Math.round((paid - owes) * 100) / 100 };
  });
}

function calcSettlements(balances) {
  const debtors   = balances.filter(b => b.net < -0.005).map(b => ({...b})).sort((a,b) => a.net - b.net);
  const creditors = balances.filter(b => b.net >  0.005).map(b => ({...b})).sort((a,b) => b.net - a.net);
  const result    = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(Math.abs(debtors[i].net), creditors[j].net);
    if (amt < 0.005) { i++; continue; }
    result.push({ fromName: debtors[i].name, fromColor: debtors[i].color, fromInitials: debtors[i].initials,
                  toName: creditors[j].name, toColor: creditors[j].color, toInitials: creditors[j].initials,
                  amount: Math.round(amt * 100) / 100 });
    debtors[i].net += amt; creditors[j].net -= amt;
    if (Math.abs(debtors[i].net)   < 0.005) i++;
    if (Math.abs(creditors[j].net) < 0.005) j++;
  }
  return result;
}

function renderBalances() {
  const balances    = calcNetBalances();
  const settlements = calcSettlements(balances);

  document.getElementById('balance-summary').innerHTML = balances.map(b => {
    const cls    = b.net > 0.005 ? 'positive' : b.net < -0.005 ? 'negative' : 'settled';
    const amtCls = b.net > 0.005 ? 'positive' : b.net < -0.005 ? 'negative' : 'zero';
    const status = b.net > 0.005 ? 'gets back' : b.net < -0.005 ? 'owes' : 'settled ✓';
    return `
      <div class="card balance-card ${cls}">
        <div class="balance-avatar" style="background:${b.color}">${esc(b.initials)}</div>
        <div class="balance-info">
          <div class="balance-name">${esc(b.name)}</div>
          <div class="balance-detail"><span>Paid: ${fmt(b.paid)}</span><span>Share: ${fmt(b.owes)}</span></div>
        </div>
        <div class="balance-net">
          <div class="balance-amount ${amtCls}">${b.net>=0?'+':''}${fmt(b.net)}</div>
          <div class="balance-status">${status}</div>
        </div>
      </div>`;
  }).join('');

  const list = document.getElementById('settlements-list');
  list.innerHTML = settlements.length
    ? settlements.map(s => `
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
        </div>`).join('')
    : '<p class="settled-message">🎉 Everyone is settled up!</p>';
}

// ────────────────────────────────────────────────────────────
// IMPORT / EXPORT / CLEAR
// ────────────────────────────────────────────────────────────

function exportData() {
  const blob = new Blob([JSON.stringify({ version:'1.0', exportedAt: new Date().toISOString(),
    members: state.members, expenses: state.expenses, groups: state.groups }, null, 2)], { type:'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `splitease-${todayISO()}.json` });
  a.click(); URL.revokeObjectURL(a.href);
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
      state.groups   = data.groups || [];
      saveMembers(); saveExpenses(); saveGroups();
      renderDashboard();
      showToast('Data imported! 📥');
    } catch { showToast('Invalid file format.', 'error'); }
  };
  reader.readAsText(file);
}

function promptClearData() {
  state.pendingDeleteType = 'all';
  state.pendingDeleteId   = null;
  document.getElementById('confirm-title').textContent   = 'Clear All Data';
  document.getElementById('confirm-message').textContent = 'Permanently delete all members, groups, and expenses? This cannot be undone.';
  document.getElementById('confirm-ok-btn').textContent  = 'Clear Everything';
  openModal('confirm-modal');
}

function clearAllData() {
  state.members = []; state.expenses = []; state.groups = [];
  state.filters = { search:'', category:'', startDate:'', endDate:'', groupId:'' };
  saveMembers(); saveExpenses(); saveGroups();
  renderDashboard();
  showToast('All data cleared.', 'info');
}

// ────────────────────────────────────────────────────────────
// CONFIRM / DELETE
// ────────────────────────────────────────────────────────────

function confirmDelete(type, id) {
  state.pendingDeleteId   = id;
  state.pendingDeleteType = type;
  const title = document.getElementById('confirm-title');
  const msg   = document.getElementById('confirm-message');
  const ok    = document.getElementById('confirm-ok-btn');

  if (type === 'expense') {
    const exp = state.expenses.find(e => e.id === id);
    title.textContent = 'Delete Expense';
    msg.textContent   = `Delete "${exp?.title || 'this expense'}"? This cannot be undone.`;
    ok.textContent    = 'Delete';
  } else if (type === 'member') {
    const m   = state.members.find(m => m.id === id);
    const ref = state.expenses.some(e => e.paidBy === id || e.splits.some(s => s.memberId === id));
    if (ref) return showToast(`Cannot remove ${m?.name} – they appear in expenses.`, 'error');
    title.textContent = 'Remove Member';
    msg.textContent   = `Remove "${m?.name}"? This cannot be undone.`;
    ok.textContent    = 'Remove';
  } else if (type === 'group') {
    const g = getGroup(id);
    title.textContent = 'Delete Group';
    msg.textContent   = `Delete group "${g?.name}"? Expenses will become ungrouped.`;
    ok.textContent    = 'Delete';
  }
  openModal('confirm-modal');
}

function executeConfirmAction() {
  const { pendingDeleteType: type, pendingDeleteId: id } = state;
  if (type === 'all') {
    clearAllData();
  } else if (type === 'expense') {
    state.expenses = state.expenses.filter(e => e.id !== id);
    saveExpenses(); renderExpenses(); showToast('Expense deleted.', 'info');
  } else if (type === 'member') {
    state.members = state.members.filter(m => m.id !== id);
    saveMembers(); renderMembers(); showToast('Member removed.', 'info');
  } else if (type === 'group') {
    state.expenses.forEach(e => { if (e.groupId === id) e.groupId = ''; });
    state.groups = state.groups.filter(g => g.id !== id);
    saveGroups(); saveExpenses(); renderGroups(); showToast('Group deleted.', 'info');
  }
  state.pendingDeleteId = null; state.pendingDeleteType = null;
  closeModal('confirm-modal');
}

// ────────────────────────────────────────────────────────────
// MODAL HELPERS
// ────────────────────────────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.add('active'); document.body.style.overflow='hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('active'); document.body.style.overflow=''; }

// ────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ────────────────────────────────────────────────────────────

function initEvents() {
  // Tabs
  document.querySelectorAll('.nav-tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // ── Chart filter tabs (group / member / all) ──
  document.querySelectorAll('.chart-filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.chartFilter = { type: btn.dataset.filter, groupId: '', memberIds: [] };
      renderChartFilterUI();
      renderCategoryChart();
      renderSpendingChart(state.chartPeriod);
    });
  });

  // ── Chart period toggle ──
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.chartPeriod = btn.dataset.period;
      renderSpendingChart(state.chartPeriod);
    });
  });

  // ── Expense modal ──
  document.getElementById('add-expense-btn').addEventListener('click', openAddExpenseModal);
  document.getElementById('close-expense-modal').addEventListener('click', () => closeModal('expense-modal'));
  document.getElementById('cancel-expense-btn').addEventListener('click', () => closeModal('expense-modal'));
  document.getElementById('save-expense-btn').addEventListener('click', saveExpense);

  document.querySelectorAll('.split-type-btn').forEach(b => b.addEventListener('click', () => {
    state.splitType = b.dataset.type; syncSplitTypeUI(); renderSplitMembers(null);
  }));

  document.getElementById('exp-amount').addEventListener('input', () => {
    if (state.splitType === 'equal') refreshEqualShares(); else refreshCustomTotal();
  });
  document.getElementById('exp-group').addEventListener('change', e => {
    updateGroupHint(e.target.value);
    if (!state.editingExpenseId) {
      // In add mode: auto-apply group members so only that group's members appear
      if (e.target.value) applyGroupMembers();
      else renderSplitMembers(null);   // no group → show all members
    }
  });
  document.getElementById('apply-group-members-btn').addEventListener('click', applyGroupMembers);

  // Split list delegation
  document.getElementById('split-members-list').addEventListener('change', e => {
    if (e.target.classList.contains('split-chk')) {
      if (state.splitType === 'equal') {
        refreshEqualShares();
      } else {
        const row = e.target.closest('.split-member-item');
        const inp = row?.querySelector('.custom-split-input');
        if (inp) { inp.disabled = !e.target.checked; if (!e.target.checked) inp.value = '0.00'; }
        refreshCustomTotal();
      }
    }
  });
  document.getElementById('split-members-list').addEventListener('input', e => {
    if (e.target.classList.contains('custom-split-input')) refreshCustomTotal();
  });

  // ── Receipt upload ──
  const receiptInput = document.getElementById('receipt-input');
  receiptInput.addEventListener('change', e => { if (e.target.files[0]) handleReceiptFile(e.target.files[0]); e.target.value = ''; });
  document.getElementById('receipt-empty').addEventListener('click', () => receiptInput.click());
  document.getElementById('receipt-change-btn').addEventListener('click', () => receiptInput.click());
  document.getElementById('receipt-remove-btn').addEventListener('click', () => {
    pendingReceipt = null;
    document.getElementById('receipt-preview-wrap').style.display = 'none';
    document.getElementById('receipt-empty').style.display = 'flex';
  });
  // Receipt viewer modal
  document.getElementById('close-receipt-modal').addEventListener('click', () => closeModal('receipt-modal'));

  // ── Group modal ──
  document.getElementById('add-group-btn').addEventListener('click', openAddGroupModal);
  document.getElementById('close-group-modal').addEventListener('click', () => closeModal('group-modal'));
  document.getElementById('cancel-group-btn').addEventListener('click', () => closeModal('group-modal'));
  document.getElementById('save-group-btn').addEventListener('click', saveGroup);
  document.getElementById('group-name').addEventListener('keydown', e => { if (e.key==='Enter') saveGroup(); });

  // ── Member modal ──
  document.getElementById('add-member-btn').addEventListener('click', openAddMemberModal);
  document.getElementById('close-member-modal').addEventListener('click', () => closeModal('member-modal'));
  document.getElementById('cancel-member-btn').addEventListener('click', () => closeModal('member-modal'));
  document.getElementById('save-member-btn').addEventListener('click', saveMember);
  document.getElementById('member-name').addEventListener('keydown', e => { if (e.key==='Enter') saveMember(); });

  // ── Confirm modal ──
  document.getElementById('close-confirm-modal').addEventListener('click', () => closeModal('confirm-modal'));
  document.getElementById('cancel-confirm-btn').addEventListener('click', () => closeModal('confirm-modal'));
  document.getElementById('confirm-ok-btn').addEventListener('click', executeConfirmAction);

  // ── File storage modal ──
  document.getElementById('file-badge').addEventListener('click', openFileModal);
  document.getElementById('close-file-modal').addEventListener('click', () => closeModal('file-modal'));
  document.getElementById('pick-existing-file-btn').addEventListener('click', () => pickFile(false));
  document.getElementById('create-new-file-btn').addEventListener('click', () => pickFile(true));

  // ── Header buttons ──
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value=''; });
  document.getElementById('reset-btn').addEventListener('click', promptClearData);

  // ── Filters ──
  const fSearch = document.getElementById('filter-search');
  const fCat    = document.getElementById('filter-category');
  const fGroup  = document.getElementById('filter-group');
  const fStart  = document.getElementById('filter-start');
  const fEnd    = document.getElementById('filter-end');

  fSearch.addEventListener('input',  () => { state.filters.search    = fSearch.value; renderExpenses(); });
  fCat.addEventListener('change',    () => { state.filters.category  = fCat.value;    renderExpenses(); });
  fGroup.addEventListener('change',  () => { state.filters.groupId   = fGroup.value;  renderExpenses(); });
  fStart.addEventListener('change',  () => { state.filters.startDate = fStart.value;  renderExpenses(); });
  fEnd.addEventListener('change',    () => { state.filters.endDate   = fEnd.value;    renderExpenses(); });

  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    state.filters = { search:'', category:'', startDate:'', endDate:'', groupId:'' };
    fSearch.value=''; fCat.value=''; fGroup.value=''; fStart.value=''; fEnd.value='';
    renderExpenses();
  });

  // Backdrop / Escape to close modals
  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target===o) closeModal(o.id); }));
  document.addEventListener('keydown', e => {
    if (e.key==='Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
  });
}

// ────────────────────────────────────────────────────────────
// LOCAL FILE STORAGE  (File System Access API)
// ────────────────────────────────────────────────────────────

let fsHandle = null; // active FileSystemFileHandle

function supportsFS() { return 'showOpenFilePicker' in window; }

// ── IndexedDB helpers (store the file handle across sessions) ──

function _openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('splitease-fs', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
    req.onsuccess  = e => res(e.target.result);
    req.onerror    = ()  => rej(req.error);
  });
}

async function _storeHandle(handle) {
  try {
    const db = await _openDB();
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'dataFile');
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch { /* ignore */ }
}

async function _getStoredHandle() {
  try {
    const db  = await _openDB();
    const tx  = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get('dataFile');
    return new Promise(res => { req.onsuccess = () => res(req.result || null); req.onerror = () => res(null); });
  } catch { return null; }
}

// ── File read / write ──

async function _verifyPermission(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

async function writeDataToFile() {
  if (!fsHandle) return;
  try {
    if (!(await _verifyPermission(fsHandle))) return;
    const payload = JSON.stringify({
      version: '1.0', savedAt: new Date().toISOString(),
      members: state.members, expenses: state.expenses, groups: state.groups,
    }, null, 2);
    const writable = await fsHandle.createWritable();
    await writable.write(payload);
    await writable.close();
    updateFileBadge();
  } catch (err) { console.warn('File write failed:', err); }
}

async function _readFromHandle(handle) {
  try {
    const file = await handle.getFile();
    return JSON.parse(await file.text());
  } catch { return null; }
}

// ── Pick / create file ──

async function pickFile(create = false) {
  if (!supportsFS()) {
    document.getElementById('fs-not-supported').style.display = 'block';
    return;
  }
  try {
    let handle;
    if (create) {
      handle = await window.showSaveFilePicker({
        suggestedName: 'splitease-data.json',
        types: [{ description: 'JSON Data File', accept: { 'application/json': ['.json'] } }],
      });
    } else {
      [handle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON Data File', accept: { 'application/json': ['.json'] } }],
        multiple: false,
      });
    }

    fsHandle = handle;
    await _storeHandle(handle);

    if (!create) {
      // Load data from the chosen file
      const data = await _readFromHandle(handle);
      if (data && Array.isArray(data.members) && Array.isArray(data.expenses)) {
        state.members  = data.members;
        state.expenses = data.expenses;
        state.groups   = data.groups || [];
        saveMembers(); saveExpenses(); saveGroups(); // sync localStorage backup
        renderDashboard();
        showToast(`Loaded from "${handle.name}" ✓`, 'success');
      } else {
        // New / empty file — write current data into it
        await writeDataToFile();
        showToast(`New file "${handle.name}" created ✓`, 'success');
      }
    } else {
      await writeDataToFile(); // write current data into new file
      showToast(`Saving to "${handle.name}" ✓`, 'success');
    }

    updateFileBadge();
    closeModal('file-modal');
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Could not access file.', 'error');
  }
}

// ── Badge + status panel ──

function updateFileBadge() {
  const btn = document.getElementById('file-badge');
  if (!btn) return;
  if (fsHandle) {
    btn.textContent = `📁 ${fsHandle.name}`;
    btn.classList.add('file-badge-active');
    btn.title = `Auto-saving to: ${fsHandle.name}\nClick to change file`;
  } else {
    btn.textContent = '💾 Browser Only';
    btn.classList.remove('file-badge-active');
    btn.title = 'Data saved in browser only — click to save to a local file';
  }
}

function openFileModal() {
  const info = document.getElementById('file-status-info');
  if (!supportsFS()) {
    document.getElementById('fs-not-supported').style.display = 'block';
    document.querySelector('.file-action-row').style.display = 'none';
  } else {
    document.getElementById('fs-not-supported').style.display = 'none';
    document.querySelector('.file-action-row').style.display = 'flex';
  }
  if (info) {
    info.innerHTML = fsHandle
      ? `<div class="file-status-box file-status-ok">
           ✅ Auto-saving to <strong>${esc(fsHandle.name)}</strong><br>
           <span style="font-size:12px">Every change saves instantly to this file on your laptop.</span>
         </div>`
      : `<div class="file-status-box file-status-warn">
           ⚠️ Currently saved in browser storage only.<br>
           <span style="font-size:12px">Data will be lost if you clear browser cache or use a different browser.</span>
         </div>`;
  }
  openModal('file-modal');
}

// ── Auto-load on startup ──

async function initFileStorage() {
  updateFileBadge(); // show default state immediately
  if (!supportsFS()) return;

  const handle = await _getStoredHandle();
  if (!handle) return;

  try {
    // Only auto-load if permission already granted (no popup on startup)
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      // Show a subtle prompt to reconnect the file
      const btn = document.getElementById('file-badge');
      if (btn) { btn.textContent = '📁 Reconnect File'; btn.title = 'Click to reconnect your saved data file'; }
      fsHandle = handle; // keep handle so clicking badge will request permission
      return;
    }
    fsHandle = handle;
    const data = await _readFromHandle(handle);
    if (data && Array.isArray(data.members) && Array.isArray(data.expenses)) {
      state.members  = data.members;
      state.expenses = data.expenses;
      state.groups   = data.groups || [];
      Store.set(STORAGE.MEMBERS,  state.members);
      Store.set(STORAGE.EXPENSES, state.expenses);
      Store.set(STORAGE.GROUPS,   state.groups);
      renderDashboard();
    }
  } catch (err) { console.warn('Auto-load failed:', err); }

  updateFileBadge();
}

// ────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────

async function init() {
  loadData();       // immediate: load from localStorage
  initEvents();
  renderDashboard();
  await initFileStorage(); // async: silently load from file if already linked
}

document.addEventListener('DOMContentLoaded', init);

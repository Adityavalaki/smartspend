// SmartSpend v4.0 — app.js
// Fully self-contained, no CSS class dependency for tab switching

var API = 'api';
var TODAY = new Date().toISOString().split('T')[0];
var NOW = new Date();
var txs = [], goals = [], splits = [], wallets = {cash:0, digital:0};
var cfg = {budgetLimit:5000, alertThreshold:80, savingsTarget:1000, currency:'₹'};
var charts = {};

var MODES = [
  {k:'cash',       ico:'💵', lbl:'Cash',    tag:'CASH',    isCash:true},
  {k:'upi',        ico:'📱', lbl:'UPI',     tag:'DIGITAL', isCash:false},
  {k:'credit_card',ico:'💳', lbl:'Credit',  tag:'DIGITAL', isCash:false},
  {k:'debit_card', ico:'🏧', lbl:'Debit',   tag:'DIGITAL', isCash:false},
  {k:'net_banking',ico:'🌐', lbl:'NetBank', tag:'DIGITAL', isCash:false}
];
var MODE_LABEL = {cash:'💵 Cash',upi:'📱 UPI',credit_card:'💳 Credit',debit_card:'🏧 Debit',net_banking:'🌐 Net'};
var CATS = {
  expense:[
    {n:'Food & Dining',e:'🍔'},{n:'Transport',e:'🚌'},{n:'Accommodation',e:'🏠'},
    {n:'Entertainment',e:'🎮'},{n:'Subscriptions',e:'📱'},{n:'Utilities',e:'💡'},
    {n:'Study',e:'📚'},{n:'Clothing',e:'👕'},{n:'Health',e:'⚕️'},
    {n:'Gym',e:'💪'},{n:'Personal Care',e:'💄'},{n:'Tuition',e:'🎓'},
    {n:'Gifting',e:'🎁'},{n:'Events',e:'🎉'},{n:'Misc',e:'📌'}
  ],
  income:[
    {n:'Salary',e:'💼'},{n:'Freelance',e:'💻'},{n:'Part-time',e:'👨‍💼'},
    {n:'Allowance',e:'👨‍👩‍👧'},{n:'Gift',e:'🎁'},{n:'Investment',e:'📈'},
    {n:'Scholarship',e:'🏅'},{n:'Bonus',e:'🏆'},{n:'Other',e:'📌'}
  ]
};
var PAL = ['#00d4b8','#8b5cf6','#ff4f6d','#1de982','#ffb800','#4c8fff','#e040fb','#f48fb1','#80cbc4','#fff176','#a5d6a7','#ce93d8','#80deea','#ffcc80','#b0bec5'];
var ALL_TABS = ['dashboard','wallets','transactions','add','budget','goals','split','analytics','settings'];

// ═══════════════════════════════
// TAB SYSTEM — pure JS, no CSS dependency
// ═══════════════════════════════
function goTab(name) {
  // Hide ALL tabs using inline style
  ALL_TABS.forEach(function(t) {
    var el = document.getElementById('tab-' + t);
    if (el) {
      el.style.cssText = 'display:none!important';
    }
  });

  // Show target tab
  var target = document.getElementById('tab-' + name);
  if (target) {
    target.style.cssText = 'display:block!important';
  }

  // Update nav button highlights
  var allBtns = document.querySelectorAll('.dn, .bn');
  for (var i = 0; i < allBtns.length; i++) {
    allBtns[i].classList.remove('on');
    if (allBtns[i].getAttribute('data-tab') === name) {
      allBtns[i].classList.add('on');
    }
  }

  // Tab-specific actions
  if (name === 'transactions') { loadAllTx(); buildFilterMonth(); }
  if (name === 'analytics') { setTimeout(buildAnalyticsCharts, 100); }
  if (name === 'dashboard') { updateDashboard(); }
  if (name === 'wallets') { renderTransferHist(); }

  window.scrollTo(0, 0);
}

// ═══════════════════════════════
// TOAST
// ═══════════════════════════════
function toast(msg, type, dur) {
  type = type || 'info';
  dur = dur || 3000;
  var c = document.getElementById('tc');
  if (!c) return;
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = '<span>' + (type==='success'?'✅':type==='error'?'❌':'ℹ️') + '</span><span>' + msg + '</span>';
  c.appendChild(el);
  setTimeout(function() { if(el.parentNode) el.parentNode.removeChild(el); }, dur);
}

// ═══════════════════════════════
// THEME
// ═══════════════════════════════
function setTheme(v) {
  localStorage.setItem('ss-theme', v);
  var h = document.documentElement;
  h.removeAttribute('data-theme');
  if (v === 'dark' || v === 'light') h.setAttribute('data-theme', v);
  var btn = document.getElementById('theme-btn');
  var isDark = v==='dark' || (v==='auto' && window.matchMedia('(prefers-color-scheme:dark)').matches);
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
  var sel = document.getElementById('theme-sel');
  if (sel) sel.value = v;
  setTimeout(rebuildCharts, 100);
}
function toggleTheme() {
  var cur = localStorage.getItem('ss-theme') || 'auto';
  var isDark = cur==='dark' || (cur==='auto' && window.matchMedia('(prefers-color-scheme:dark)').matches);
  setTheme(isDark ? 'light' : 'dark');
}
function initTheme() {
  setTheme(localStorage.getItem('ss-theme') || 'auto');
}

// ═══════════════════════════════
// API HELPERS
// ═══════════════════════════════
function GET(url, cb) {
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(d) { cb(null, d); })
    .catch(function(e) { cb(e, null); });
}
function POST(url, data, cb) {
  cb = cb || function(){};
  fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)})
    .then(function(r) { return r.json(); })
    .then(function(d) { cb(null, d); })
    .catch(function(e) { cb(e, null); });
}
function DEL(url, cb) {
  cb = cb || function(){};
  fetch(url, {method:'DELETE'})
    .then(function(r) { return r.json(); })
    .then(function(d) { cb(null, d); })
    .catch(function(e) { cb(e, null); });
}

// ═══════════════════════════════
// STATUS CHECK
// ═══════════════════════════════
function checkStatus() {
  GET(API + '/transactions.php?limit=1', function(err, r) {
    var ok = !err && r !== null;
    ['api-dot','php-dot','db-dot'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.className = ok ? 'dot' : 'dot off';
    });
    ['api-lbl','php-st','db-st'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = ok ? 'Live' : 'Offline';
    });
  });
}

// ═══════════════════════════════
// LOAD ALL DATA
// ═══════════════════════════════
var loadCount = 0;
function checkAllLoaded() {
  loadCount++;
  if (loadCount >= 5) {
    applySettings();
    updateDashboard();
    renderGoals();
    renderSplitHist();
    buildFilterMonth();
  }
}

function loadAll() {
  loadCount = 0;

  GET(API + '/settings.php', function(err, sr) {
    if (sr && sr.settings) {
      var s = sr.settings;
      if (s.budget_limit) cfg.budgetLimit = parseFloat(s.budget_limit);
      if (s.alert_threshold) cfg.alertThreshold = parseFloat(s.alert_threshold);
      if (s.savings_target) cfg.savingsTarget = parseFloat(s.savings_target);
      if (s.currency) cfg.currency = s.currency;
    }
    checkAllLoaded();
  });

  GET(API + '/transactions.php?limit=5000', function(err, tr) {
    if (tr && tr.transactions) {
      txs = tr.transactions.map(function(t) {
        t.amount = parseFloat(t.amount);
        t.recurring = !!parseInt(t.recurring);
        return t;
      });
    }
    checkAllLoaded();
  });

  GET(API + '/goals.php', function(err, gr) {
    if (gr && gr.goals) {
      goals = gr.goals.map(function(g) {
        g.target_amount = parseFloat(g.target_amount);
        g.saved_amount = parseFloat(g.saved_amount);
        return g;
      });
    }
    checkAllLoaded();
  });

  GET(API + '/splits.php', function(err, sr) {
    if (sr && sr.splits) {
      splits = sr.splits.map(function(s) {
        s.total_amount = parseFloat(s.total_amount);
        return s;
      });
    }
    checkAllLoaded();
  });

  GET(API + '/wallets.php', function(err, wr) {
    if (wr && wr.wallets) wallets = wr.wallets;
    checkAllLoaded();
  });
}

function applySettings() {
  var bl = document.getElementById('b-limit');
  var bt = document.getElementById('b-thresh');
  var bta = document.getElementById('b-target');
  var cs = document.getElementById('cur-sel');
  var hc = document.getElementById('hdr-cur');
  if (bl) bl.value = cfg.budgetLimit;
  if (bt) bt.value = cfg.alertThreshold;
  if (bta) bta.value = cfg.savingsTarget;
  if (cs) cs.value = cfg.currency;
  if (hc) hc.textContent = cfg.currency;
}

// ═══════════════════════════════
// HELPERS
// ═══════════════════════════════
function monthTxs(m, y) {
  m = (m === undefined) ? NOW.getMonth() : m;
  y = (y === undefined) ? NOW.getFullYear() : y;
  return txs.filter(function(t) {
    var d = new Date(t.tx_date);
    return d.getMonth() === m && d.getFullYear() === y;
  });
}
function catEmoji(c) {
  var all = CATS.expense.concat(CATS.income);
  for (var i = 0; i < all.length; i++) {
    if (all[i].n === c) return all[i].e;
  }
  return '💰';
}
function fmt(n, d) { return (parseFloat(n) || 0).toFixed(d || 0); }
function cur(n, d) { return cfg.currency + fmt(n, d || 0); }
function isDark() {
  var v = localStorage.getItem('ss-theme') || 'auto';
  return v === 'dark' || (v === 'auto' && window.matchMedia('(prefers-color-scheme:dark)').matches);
}
function chartColors() {
  return {
    color: isDark() ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.45)',
    grid:  isDark() ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)'
  };
}

// ═══════════════════════════════
// DASHBOARD
// ═══════════════════════════════
function updateDashboard() {
  var md = monthTxs();
  var inc = 0, exp = 0, cashExp = 0, digExp = 0, cashInc = 0, digInc = 0, todayExp = 0;

  md.forEach(function(t) {
    if (t.type === 'income') {
      inc += t.amount;
      if (t.pay_mode === 'cash') cashInc += t.amount;
      else digInc += t.amount;
    } else {
      exp += t.amount;
      if (t.pay_mode === 'cash') cashExp += t.amount;
      else digExp += t.amount;
      if (t.tx_date === TODAY) todayExp += t.amount;
    }
  });

  var bal = inc - exp;
  var bl = Math.max(0, cfg.budgetLimit - exp);

  function set(id, val) { var e = document.getElementById(id); if(e) e.textContent = val; }

  set('month-label', NOW.toLocaleString('en-IN', {month:'long', year:'numeric'}));
  set('bal-val', Math.abs(bal).toFixed(2));
  set('p-inc', cur(inc));
  set('p-exp', cur(exp));
  set('p-bud', cur(bl));
  set('s-today', cur(todayExp));
  set('s-inc', cur(inc));
  set('s-cash', cur(cashExp));
  set('s-dig', cur(digExp));
  set('dash-cash-bal', cur(wallets.cash || 0));
  set('dash-dig-bal', cur(wallets.digital || 0));
  set('dash-cash-in', '+' + cur(cashInc));
  set('dash-cash-out', '-' + cur(cashExp));
  set('dash-dig-in', '+' + cur(digInc));
  set('dash-dig-out', '-' + cur(digExp));

  var beq = document.getElementById('bal-eq');
  if (beq) { beq.textContent = cur(bal); beq.className = bal >= 0 ? 'pos' : 'neg'; }

  updateBudgetUI(exp, cashExp, digExp);
  buildInsightsLocal(md, exp, inc);
  renderRecent(md);
  buildDashCharts(md);
}

function updateBudgetUI(exp, cashExp, digExp) {
  var rem = Math.max(0, cfg.budgetLimit - exp);
  var pct = cfg.budgetLimit > 0 ? Math.min(100, exp / cfg.budgetLimit * 100) : 0;
  function set(id, val) { var e = document.getElementById(id); if(e) e.textContent = val; }
  set('b-lim-d', fmt(cfg.budgetLimit));
  set('b-spent', fmt(exp));
  set('b-rem', fmt(rem));
  set('b-cash', fmt(cashExp));
  set('b-dig', fmt(digExp));
  set('b-pct', pct.toFixed(0) + '% used');
  var bar = document.getElementById('b-bar');
  if (bar) {
    bar.style.width = pct + '%';
    bar.className = 'pf ' + (pct > 90 ? 'r' : pct > 70 ? 'y' : 'c');
  }
}

function buildInsightsLocal(md, exp, inc) {
  var c = document.getElementById('ins-box');
  if (!c) return;
  var pct = cfg.budgetLimit > 0 ? (exp / cfg.budgetLimit * 100) : 0;
  var ins = [];
  if (pct >= 100) ins.push({type:'danger', icon:'🚨', title:'Budget Exceeded!', text:'Overspent by ' + cur(exp - cfg.budgetLimit)});
  else if (pct >= cfg.alertThreshold) ins.push({type:'warning', icon:'⚠️', title:'Budget Alert', text:pct.toFixed(0) + '% of monthly budget used'});
  else ins.push({type:'success', icon:'✅', title:'On Track', text:pct.toFixed(0) + '% used — ' + cur(cfg.budgetLimit - exp) + ' remaining'});
  if (inc > 0) {
    var rate = (inc - exp) / inc * 100;
    ins.push({type: rate >= 20 ? 'success' : 'info', icon:'💰', title:'Savings: ' + rate.toFixed(0) + '%', text: rate >= 20 ? 'Great! Saving ' + cur(inc - exp) + ' this month.' : 'Target 20%+.'});
  }
  var cashExp = md.filter(function(t){return t.type==='expense'&&t.pay_mode==='cash';}).reduce(function(s,t){return s+t.amount;},0);
  if (exp > 0) ins.push({type:'info', icon:'💳', title:'Payment Split', text:'Cash: ' + cur(cashExp) + ' · Digital: ' + cur(exp - cashExp)});
  c.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:18px">' + ins.map(insCard).join('') + '</div>';
}
function insCard(i) {
  return '<div class="ic ' + i.type + '"><div class="ic-ico">' + i.icon + '</div><div><div class="ic-t">' + i.title + '</div><div class="ic-b">' + i.text + '</div></div></div>';
}

// ═══════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════
function txCard(t, showDel) {
  var isCash = t.pay_mode === 'cash';
  var mTag = '<span class="tag ' + (isCash ? 'tag-cash' : 'tag-dig') + '">' + (MODE_LABEL[t.pay_mode] || t.pay_mode) + '</span>';
  var delBtn = showDel ? '<button class="btn btn-d btn-s" onclick="delTx(' + t.id + ')">✕</button>' : '';
  var sign = t.type === 'expense' ? '−' : '+';
  var date = new Date(t.tx_date).toLocaleDateString('en-IN', {day:'2-digit', month:'short'});
  return '<div class="txi">' +
    '<div class="tx-ico">' + catEmoji(t.category) + '</div>' +
    '<div class="tx-det">' +
      '<div class="tx-cat">' + t.category + (t.recurring ? '<span class="tag tag-r">REC</span>' : '') + '</div>' +
      '<div class="tx-dsc">' + mTag + ' ' + (t.description || '—') + '</div>' +
    '</div>' +
    '<div class="tx-meta">' +
      '<div class="tx-amt ' + t.type + '">' + sign + cfg.currency + fmt(t.amount, 2) + '</div>' +
      '<div class="tx-dt">' + date + '</div>' +
      delBtn +
    '</div>' +
  '</div>';
}

function renderRecent(md) {
  var sorted = md.slice().sort(function(a,b){ return new Date(b.tx_date) - new Date(a.tx_date); }).slice(0, 10);
  var c = document.getElementById('recent-list');
  if (!c) return;
  c.innerHTML = sorted.length ? sorted.map(function(t){ return txCard(t, false); }).join('') :
    '<div class="emp"><span class="emp-ico">📭</span><div class="emp-t">No Transactions Yet</div></div>';
}

function loadAllTx() {
  var typeEl = document.getElementById('f-type');
  var modeEl = document.getElementById('f-mode');
  var searchEl = document.getElementById('search');
  var monthEl = document.getElementById('f-month');
  var type = typeEl ? typeEl.value : '';
  var mode = modeEl ? modeEl.value : '';
  var search = searchEl ? searchEl.value.toLowerCase() : '';
  var mf = monthEl ? monthEl.value : '';

  var f = txs.slice().sort(function(a,b){ return new Date(b.tx_date) - new Date(a.tx_date); });
  if (type) f = f.filter(function(t){ return t.type === type; });
  if (mode) f = f.filter(function(t){ return t.pay_mode === mode; });
  if (mf) {
    var parts = mf.split('-');
    f = f.filter(function(t) {
      var d = new Date(t.tx_date);
      return d.getFullYear() == parts[0] && (d.getMonth()+1) == parts[1];
    });
  }
  if (search) f = f.filter(function(t){
    return (t.category + ' ' + (t.description||'') + ' ' + t.amount + ' ' + t.pay_mode).toLowerCase().indexOf(search) > -1;
  });

  var badge = document.getElementById('tx-badge');
  if (badge) badge.textContent = f.length + ' RECORDS';
  var c = document.getElementById('all-tx');
  if (c) c.innerHTML = f.length ? f.map(function(t){ return txCard(t, true); }).join('') :
    '<div class="emp"><span class="emp-ico">📭</span><div class="emp-t">No Results</div></div>';
}
function filterTx() { loadAllTx(); }

function buildFilterMonth() {
  var months = {};
  txs.forEach(function(t) {
    var d = new Date(t.tx_date);
    months[d.getFullYear() + '-' + (d.getMonth()+1)] = true;
  });
  var sel = document.getElementById('f-month');
  if (!sel) return;
  sel.innerHTML = '<option value="">All Months</option>';
  Object.keys(months).sort().reverse().forEach(function(m) {
    var parts = m.split('-');
    var lbl = new Date(parts[0], parts[1]-1, 1).toLocaleString('en-IN', {month:'long', year:'numeric'});
    sel.innerHTML += '<option value="' + m + '">' + lbl + '</option>';
  });
}

function delTx(id) {
  if (!confirm('Delete?')) return;
  DEL(API + '/transactions.php?id=' + id, function(err, r) {
    txs = txs.filter(function(t){ return t.id != id; });
    updateDashboard(); loadAllTx(); buildFilterMonth();
    toast('Deleted', 'success');
  });
}

// ═══════════════════════════════
// ADD TRANSACTION
// ═══════════════════════════════
function buildPmGrid() {
  var c = document.getElementById('pm-grid');
  if (!c) return;
  c.innerHTML = MODES.map(function(m) {
    return '<div class="pm-opt" onclick="selMode(this,\'' + m.k + '\')" data-mode="' + m.k + '">' +
      '<span class="pm-ico">' + m.ico + '</span>' +
      '<div class="pm-lbl">' + m.lbl + '</div>' +
      '<span class="pm-tag ' + (m.isCash?'c':'d') + '">' + m.tag + '</span>' +
    '</div>';
  }).join('');
  var first = c.querySelector('.pm-opt');
  if (first) selMode(first, 'cash');
}

function selMode(el, key) {
  var all = document.querySelectorAll('.pm-opt');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('sel', 'cash-mode', 'dig-mode');
  el.classList.add('sel');
  el.classList.add(key === 'cash' ? 'cash-mode' : 'dig-mode');
  document.getElementById('f-mode2').value = key;
}

function updateCats() {
  var typeEl = document.getElementById('f-type2');
  var type = typeEl ? typeEl.value : 'expense';
  var c = document.getElementById('f-cats');
  if (!c) return;
  c.innerHTML = CATS[type].map(function(cat) {
    return '<div class="ci" onclick="selCat(this,\'' + cat.n.replace(/'/g,"\\'") + '\')">' +
      '<span class="ce">' + cat.e + '</span><span class="cn">' + cat.n + '</span></div>';
  }).join('');
  document.getElementById('f-cat').value = '';
}

function selCat(el, name) {
  var all = document.querySelectorAll('.ci');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('sel');
  el.classList.add('sel');
  document.getElementById('f-cat').value = name;
}

function onTypeChange() {
  updateCats();
  var badge = document.getElementById('add-badge');
  var type = document.getElementById('f-type2');
  if (badge && type) badge.textContent = type.value.toUpperCase();
}

function saveTx() {
  var amount = parseFloat(document.getElementById('f-amount').value);
  var cat = document.getElementById('f-cat').value;
  var type = document.getElementById('f-type2').value;
  var date = document.getElementById('f-date').value;
  var pm = document.getElementById('f-mode2').value || 'cash';
  var desc = document.getElementById('f-desc').value.trim();
  var rec = document.getElementById('recur-tog').classList.contains('on');

  if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
  if (!cat) { toast('Select a category', 'error'); return; }
  if (!date) { toast('Select a date', 'error'); return; }

  POST(API + '/transactions.php', {amount:amount, category:cat, type:type, pay_mode:pm, date:date, description:desc, recurring:rec}, function(err, r) {
    if (r && r.transaction) {
      var t = r.transaction;
      t.amount = parseFloat(t.amount);
      t.recurring = !!parseInt(t.recurring);
      txs.unshift(t);
      toast('Saved! ' + (MODE_LABEL[pm] || pm), 'success');
    } else {
      txs.unshift({amount:amount, category:cat, type:type, pay_mode:pm, tx_date:date, description:desc, recurring:rec, id:Date.now()});
      toast('Saved locally', 'info');
    }
    clearForm();
    updateDashboard();
    buildFilterMonth();
  });
}

function clearForm() {
  document.getElementById('f-amount').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-date').value = TODAY;
  document.getElementById('f-cat').value = '';
  document.getElementById('recur-tog').classList.remove('on');
  var all = document.querySelectorAll('.ci, .pm-opt');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('sel','cash-mode','dig-mode');
  buildPmGrid();
}

// ═══════════════════════════════
// WALLETS
// ═══════════════════════════════
function setWallet(w) {
  var id = w === 'cash' ? 'set-cash' : 'set-dig';
  var bal = parseFloat(document.getElementById(id).value || 0);
  if (isNaN(bal) || bal < 0) { toast('Invalid balance', 'error'); return; }
  POST(API + '/wallets.php?action=set_balance', {wallet:w, balance:bal}, function(err, r) {
    if (r && r.status === 'updated') {
      wallets[w] = bal;
      updateWalletUI();
      toast((w==='cash'?'Cash':'Digital') + ' wallet updated!', 'success');
    } else {
      toast('Failed to update', 'error');
    }
  });
}

function doTransfer() {
  var from = document.getElementById('tr-from').value;
  var to = document.getElementById('tr-to').value;
  var amt = parseFloat(document.getElementById('tr-amt').value || 0);
  var note = document.getElementById('tr-note').value.trim();
  if (!amt || amt <= 0) { toast('Enter amount', 'error'); return; }
  if (from === to) { toast('Cannot transfer to same wallet', 'error'); return; }
  POST(API + '/wallets.php?action=transfer', {from:from, to:to, amount:amt, note:note}, function(err, r) {
    if (r && r.status === 'transferred') {
      wallets[from] = Math.max(0, (wallets[from]||0) - amt);
      wallets[to] = (wallets[to]||0) + amt;
      updateWalletUI();
      document.getElementById('tr-amt').value = '';
      document.getElementById('tr-note').value = '';
      renderTransferHist();
      toast('Transferred ' + cur(amt, 2) + '!', 'success');
    } else {
      toast((r && r.error) ? r.error : 'Transfer failed', 'error');
    }
  });
}

function updateWalletUI() {
  var ids = ['w-cash-bal','dash-cash-bal'];
  ids.forEach(function(id){ var e=document.getElementById(id); if(e) e.textContent=cur(wallets.cash||0); });
  var ids2 = ['w-dig-bal','dash-dig-bal'];
  ids2.forEach(function(id){ var e=document.getElementById(id); if(e) e.textContent=cur(wallets.digital||0); });
}

function renderTransferHist() {
  var c = document.getElementById('tr-hist');
  if (!c) return;
  GET(API + '/wallets.php?action=transfers', function(err, r) {
    if (!r || !r.transfers || !r.transfers.length) {
      c.innerHTML = '<div class="emp"><span class="emp-ico">⇌</span><div class="emp-t">No Transfers Yet</div></div>';
      return;
    }
    c.innerHTML = r.transfers.map(function(t) {
      return '<div class="txi">' +
        '<div class="tx-ico">' + (t.from_wallet==='cash'?'💵':'💳') + '→' + (t.to_wallet==='cash'?'💵':'💳') + '</div>' +
        '<div class="tx-det"><div class="tx-cat">' + t.from_wallet + ' → ' + t.to_wallet + '</div><div class="tx-dsc">' + (t.note||'Transfer') + ' · ' + t.tx_date + '</div></div>' +
        '<div class="tx-meta"><div class="tx-amt income">+' + cfg.currency + fmt(t.amount,2) + '</div></div>' +
      '</div>';
    }).join('');
  });
}

// ═══════════════════════════════
// BUDGET
// ═══════════════════════════════
function saveBudget() {
  cfg.budgetLimit = parseFloat(document.getElementById('b-limit').value) || 5000;
  cfg.alertThreshold = parseFloat(document.getElementById('b-thresh').value) || 80;
  cfg.savingsTarget = parseFloat(document.getElementById('b-target').value) || 1000;
  POST(API + '/settings.php', {budget_limit:cfg.budgetLimit, alert_threshold:cfg.alertThreshold, savings_target:cfg.savingsTarget}, function(err, r) {
    toast(r ? 'Budget saved!' : 'Saved locally', r ? 'success' : 'info');
    updateDashboard();
  });
}

// ═══════════════════════════════
// GOALS
// ═══════════════════════════════
function saveGoal() {
  var name = document.getElementById('g-name').value.trim();
  var amt = parseFloat(document.getElementById('g-amount').value);
  var date = document.getElementById('g-date').value;
  var saved = parseFloat(document.getElementById('g-saved').value) || 0;
  if (!name) { toast('Enter goal name', 'error'); return; }
  if (!amt || amt <= 0) { toast('Enter target amount', 'error'); return; }
  if (!date) { toast('Pick target date', 'error'); return; }
  POST(API + '/goals.php', {name:name, target_amount:amt, saved_amount:saved, target_date:date}, function(err, r) {
    if (r && r.goal) {
      var g = r.goal;
      g.target_amount = parseFloat(g.target_amount);
      g.saved_amount = parseFloat(g.saved_amount);
      goals.unshift(g);
      toast('Goal created!', 'success');
    } else {
      goals.unshift({name:name, target_amount:amt, saved_amount:saved, target_date:date, id:Date.now()});
      toast('Saved locally', 'info');
    }
    document.getElementById('g-name').value = '';
    document.getElementById('g-amount').value = '';
    document.getElementById('g-saved').value = '0';
    renderGoals();
  });
}

function delGoal(id) {
  if (!confirm('Delete goal?')) return;
  DEL(API + '/goals.php?id=' + id, function() {
    goals = goals.filter(function(g){ return g.id != id; });
    renderGoals();
    toast('Deleted', 'success');
  });
}

function renderGoals() {
  var c = document.getElementById('goals-list');
  if (!c) return;
  if (!goals.length) {
    c.innerHTML = '<div class="card"><div class="emp"><span class="emp-ico">🎯</span><div class="emp-t">No Goals Yet</div></div></div>';
    return;
  }
  c.innerHTML = goals.map(function(g) {
    var days = Math.ceil((new Date(g.target_date) - new Date()) / 86400000);
    var pct = Math.min(100, ((g.saved_amount||0) / g.target_amount) * 100);
    return '<div class="gc">' +
      '<div class="gt"><div><div class="gn">🎯 ' + g.name + '</div></div>' +
      '<div style="display:flex;gap:8px;align-items:center"><div class="gv">' + cur(g.target_amount) + '</div>' +
      '<button class="btn btn-d btn-s" onclick="delGoal(' + g.id + ')">✕</button></div></div>' +
      '<div class="pt"><div class="pf ' + (pct>=80?'g':pct>=40?'c':'y') + '" style="width:' + pct + '%"></div></div>' +
      '<div class="gm"><span>' + cur(g.saved_amount||0) + ' saved</span><span>' + pct.toFixed(0) + '%</span><span>' + Math.max(0,days) + 'd left</span></div>' +
    '</div>';
  }).join('');
}

// ═══════════════════════════════
// SPLITS
// ═══════════════════════════════
function addPerson() {
  var c = document.getElementById('sp-people');
  var d = document.createElement('div');
  d.className = 'spr';
  d.innerHTML = '<input type="text" class="fi sp-n" placeholder="Name"><input type="number" class="fi sp-a" placeholder="₹" step="0.01" min="0" style="max-width:110px" inputmode="decimal"><button class="btn btn-d btn-s" onclick="this.parentElement.remove()">✕</button>';
  c.appendChild(d);
}

function saveSplit() {
  var total = parseFloat(document.getElementById('sp-amt').value);
  var desc = document.getElementById('sp-desc').value.trim();
  if (!total || total <= 0) { toast('Enter total', 'error'); return; }
  if (!desc) { toast('Enter description', 'error'); return; }
  var people = [];
  var rows = document.querySelectorAll('.spr');
  for (var i = 0; i < rows.length; i++) {
    var n = rows[i].querySelector('.sp-n').value.trim();
    var a = parseFloat(rows[i].querySelector('.sp-a').value);
    if (n && a > 0) people.push({name:n, amount:a});
  }
  if (people.length < 2) { toast('Add at least 2 people', 'error'); return; }
  var sum = people.reduce(function(s,p){ return s+p.amount; }, 0);
  if (Math.abs(sum - total) > 0.01) { toast('Amounts (' + cur(sum,2) + ') ≠ total (' + cur(total,2) + ')', 'error'); return; }
  POST(API + '/splits.php', {description:desc, total_amount:total, people:people}, function(err, r) {
    if (r && r.status === 'created') {
      splits.unshift({description:desc, total_amount:total, people:people, id:r.id, split_date:TODAY});
      toast('Split recorded!', 'success');
    }
    document.getElementById('sp-amt').value = '';
    document.getElementById('sp-desc').value = '';
    document.getElementById('sp-people').innerHTML = '';
    addPerson();
    renderSplitHist();
  });
}

function delSplit(id) {
  if (!confirm('Delete?')) return;
  DEL(API + '/splits.php?id=' + id, function() {
    splits = splits.filter(function(s){ return s.id != id; });
    renderSplitHist();
    toast('Deleted', 'success');
  });
}

function renderSplitHist() {
  var c = document.getElementById('split-hist');
  if (!c) return;
  if (!splits.length) {
    c.innerHTML = '<div class="emp"><span class="emp-ico">🤝</span><div class="emp-t">No Splits Yet</div></div>';
    return;
  }
  c.innerHTML = splits.map(function(s) {
    var people = (s.people||[]).map(function(p){ return p.name+': '+cfg.currency+fmt(p.amount,0); }).join(' · ');
    return '<div class="txi">' +
      '<div class="tx-ico">💸</div>' +
      '<div class="tx-det"><div class="tx-cat">' + s.description + '</div><div class="tx-dsc">' + people + '</div></div>' +
      '<div class="tx-meta"><div class="tx-amt expense">' + cfg.currency + fmt(s.total_amount,2) + '</div>' +
      '<div class="tx-dt">' + (s.split_date||'—') + '</div>' +
      '<button class="btn btn-d btn-s" onclick="delSplit(' + s.id + ')">✕</button></div>' +
    '</div>';
  }).join('');
}

// ═══════════════════════════════
// CHARTS
// ═══════════════════════════════
function buildDashCharts(md) {
  var cc = chartColors();
  var cats = {};
  md.filter(function(t){ return t.type==='expense'; }).forEach(function(t){
    cats[t.category] = (cats[t.category]||0) + t.amount;
  });
  if (charts.cat) { charts.cat.destroy(); charts.cat = null; }
  var c1 = document.getElementById('catChart');
  var keys = Object.keys(cats);
  if (c1 && keys.length) {
    charts.cat = new Chart(c1, {
      type:'doughnut',
      data:{labels:keys, datasets:[{data:keys.map(function(k){return cats[k];}), backgroundColor:PAL, borderColor:'transparent', borderWidth:0, hoverOffset:6}]},
      options:{responsive:true, maintainAspectRatio:false, cutout:'64%', plugins:{legend:{position:'bottom', labels:{color:cc.color, font:{size:10}, padding:9, boxWidth:8}}}}
    });
  }
  var cashExp = md.filter(function(t){return t.type==='expense'&&t.pay_mode==='cash';}).reduce(function(s,t){return s+t.amount;},0);
  var digExp = md.filter(function(t){return t.type==='expense'&&t.pay_mode!=='cash';}).reduce(function(s,t){return s+t.amount;},0);
  if (charts.mode) { charts.mode.destroy(); charts.mode = null; }
  var c2 = document.getElementById('modeChart');
  if (c2 && (cashExp || digExp)) {
    charts.mode = new Chart(c2, {
      type:'doughnut',
      data:{labels:['💵 Cash','💳 Digital'], datasets:[{data:[cashExp,digExp], backgroundColor:['rgba(245,158,11,.7)','rgba(59,130,246,.7)'], borderColor:['#f59e0b','#3b82f6'], borderWidth:2, hoverOffset:6}]},
      options:{responsive:true, maintainAspectRatio:false, cutout:'64%', plugins:{legend:{position:'bottom', labels:{color:cc.color, font:{size:11, weight:'600'}, padding:12, boxWidth:10}}}}
    });
  }
}

function buildAnalyticsCharts() {
  var md = monthTxs();
  var cc = chartColors();
  var modes = {};
  md.filter(function(t){return t.type==='expense';}).forEach(function(t){
    modes[t.pay_mode] = (modes[t.pay_mode]||0) + t.amount;
  });
  if (charts.pm) { charts.pm.destroy(); charts.pm = null; }
  var c1 = document.getElementById('pmChart');
  var mkeys = Object.keys(modes);
  if (c1 && mkeys.length) {
    charts.pm = new Chart(c1, {
      type:'doughnut',
      data:{labels:mkeys.map(function(k){return MODE_LABEL[k]||k;}), datasets:[{data:mkeys.map(function(k){return modes[k];}), backgroundColor:PAL, borderColor:'transparent', borderWidth:0}]},
      options:{responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{legend:{position:'bottom', labels:{color:cc.color, font:{size:10}, padding:8, boxWidth:8}}}}
    });
  }
  var cashExp = md.filter(function(t){return t.type==='expense'&&t.pay_mode==='cash';}).reduce(function(s,t){return s+t.amount;},0);
  var digExp  = md.filter(function(t){return t.type==='expense'&&t.pay_mode!=='cash';}).reduce(function(s,t){return s+t.amount;},0);
  var cashInc = md.filter(function(t){return t.type==='income'&&t.pay_mode==='cash';}).reduce(function(s,t){return s+t.amount;},0);
  var digInc  = md.filter(function(t){return t.type==='income'&&t.pay_mode!=='cash';}).reduce(function(s,t){return s+t.amount;},0);
  if (charts.cd) { charts.cd.destroy(); charts.cd = null; }
  var c2 = document.getElementById('cdChart');
  if (c2) {
    charts.cd = new Chart(c2, {
      type:'bar',
      data:{labels:['Cash In','Cash Out','Digital In','Digital Out'], datasets:[{data:[cashInc,cashExp,digInc,digExp], backgroundColor:['rgba(29,233,130,.55)','rgba(245,158,11,.55)','rgba(76,143,255,.55)','rgba(255,79,109,.55)'], borderColor:['#1de982','#f59e0b','#4c8fff','#ff4f6d'], borderWidth:1.5, borderRadius:8}]},
      options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{color:cc.grid}, ticks:{color:cc.color, font:{size:10}}}, y:{grid:{color:cc.grid}, ticks:{color:cc.color, font:{size:10}}}}}
    });
  }
  GET(API + '/analytics.php?action=monthly_report&month=' + (NOW.getMonth()+1) + '&year=' + NOW.getFullYear(), function(err, mr) {
    if (charts.mo) { charts.mo.destroy(); charts.mo = null; }
    var c3 = document.getElementById('moChart');
    if (c3 && mr && mr.months) {
      charts.mo = new Chart(c3, {
        type:'bar',
        data:{labels:mr.months.map(function(m){return m.label;}), datasets:[
          {label:'Income', data:mr.months.map(function(m){return m.income;}), backgroundColor:'rgba(29,233,130,.4)', borderColor:'#1de982', borderWidth:1.5, borderRadius:5},
          {label:'Expense', data:mr.months.map(function(m){return m.expense;}), backgroundColor:'rgba(255,79,109,.4)', borderColor:'#ff4f6d', borderWidth:1.5, borderRadius:5}
        ]},
        options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:cc.color, font:{size:10}}}}, scales:{x:{grid:{color:cc.grid}, ticks:{color:cc.color, font:{size:10}}}, y:{grid:{color:cc.grid}, ticks:{color:cc.color, font:{size:10}}}}}
      });
    }
  });
  var cats = {};
  md.filter(function(t){return t.type==='expense';}).forEach(function(t){ cats[t.category]=(cats[t.category]||0)+t.amount; });
  var sorted = Object.keys(cats).map(function(c){return [c,cats[c]];}).sort(function(a,b){return b[1]-a[1];});
  var total = sorted.reduce(function(s,c){return s+c[1];},0) || 1;
  var cr = document.getElementById('cat-rank');
  if (cr) cr.innerHTML = sorted.map(function(item, i) {
    var pct = (item[1]/total*100).toFixed(1);
    return '<div style="margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
        '<span style="font-size:12px;font-weight:600">' + catEmoji(item[0]) + ' ' + item[0] + '</span>' +
        '<span style="font-family:var(--fm);font-size:11px;color:var(--cyan)">' + cur(item[1],0) + ' · ' + pct + '%</span>' +
      '</div>' +
      '<div class="pt"><div class="pf" style="width:' + pct + '%;background:' + PAL[i%PAL.length] + '"></div></div>' +
    '</div>';
  }).join('');
}

function rebuildCharts() {
  var md = monthTxs();
  setTimeout(function() {
    buildDashCharts(md);
    var ana = document.getElementById('tab-analytics');
    if (ana && ana.style.display !== 'none') buildAnalyticsCharts();
  }, 100);
}

// ═══════════════════════════════
// SETTINGS
// ═══════════════════════════════
function saveSettings() {
  cfg.currency = document.getElementById('cur-sel').value;
  POST(API + '/settings.php', {currency:cfg.currency}, function(err, r) {
    var hc = document.getElementById('hdr-cur');
    if (hc) hc.textContent = cfg.currency;
    toast(r ? 'Saved!' : 'Saved locally', r ? 'success' : 'info');
    updateDashboard();
  });
}

// ═══════════════════════════════
// EXPORT
// ═══════════════════════════════
function exportCSV() {
  var rows = [['Date','Category','Type','Pay Mode','Amount','Description','Recurring']];
  txs.forEach(function(t){ rows.push([t.tx_date, t.category, t.type, t.pay_mode, t.amount, t.description||'', t.recurring?'Yes':'No']); });
  dl(rows.map(function(r){ return r.map(function(c){ return '"'+String(c).replace(/"/g,'""')+'"'; }).join(','); }).join('\n'), 'smartspend-'+TODAY+'.csv', 'text/csv');
  toast('CSV exported!', 'success');
}
function exportJSON() {
  dl(JSON.stringify({transactions:txs, goals:goals, splits:splits, wallets:wallets, settings:cfg, exported:new Date().toISOString()}, null, 2), 'smartspend-backup-'+TODAY+'.json', 'application/json');
  toast('Backup saved!', 'success');
}
function dl(content, fname, mime) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], {type:mime}));
  a.download = fname;
  a.click();
  URL.revokeObjectURL(a.href);
}
function copySum() {
  var md = monthTxs();
  var inc = md.filter(function(t){return t.type==='income';}).reduce(function(s,t){return s+t.amount;},0);
  var exp = md.filter(function(t){return t.type==='expense';}).reduce(function(s,t){return s+t.amount;},0);
  var cashExp = md.filter(function(t){return t.type==='expense'&&t.pay_mode==='cash';}).reduce(function(s,t){return s+t.amount;},0);
  var text = '📊 SmartSpend — ' + NOW.toLocaleString('en-IN',{month:'long',year:'numeric'}) +
    '\n💰 Income: ' + cur(inc,2) + '\n📉 Expenses: ' + cur(exp,2) +
    '\n💵 Cash: ' + cur(cashExp,2) + ' | 💳 Digital: ' + cur(exp-cashExp,2) +
    '\n💎 Saved: ' + cur(inc-exp,2) +
    '\n👛 Cash Wallet: ' + cur(wallets.cash||0) + ' | Digital: ' + cur(wallets.digital||0);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function(){ toast('Copied!', 'success'); });
  } else {
    prompt('Copy:', text);
  }
}
function restoreData() {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = function(ev) {
    var r = new FileReader();
    r.onload = function(e) {
      try {
        var d = JSON.parse(e.target.result);
        txs = d.transactions || [];
        goals = d.goals || [];
        splits = d.splits || [];
        if (d.wallets) wallets = d.wallets;
        if (d.settings) { cfg.budgetLimit=d.settings.budgetLimit||cfg.budgetLimit; cfg.currency=d.settings.currency||cfg.currency; }
        updateDashboard(); renderGoals(); renderSplitHist();
        toast('Restored!', 'success');
      } catch(err) { toast('Restore failed', 'error'); }
    };
    r.readAsText(ev.target.files[0]);
  };
  inp.click();
}
function clearAll() {
  if (!confirm('Delete ALL data?')) return;
  if (!confirm('Final confirmation?')) return;
  txs=[]; goals=[]; splits=[]; wallets={cash:0,digital:0};
  updateDashboard(); renderGoals(); renderSplitHist();
  toast('Cleared', 'success');
}

// ═══════════════════════════════
// INIT
// ═══════════════════════════════
function init() {
  initTheme();

  // Set dates
  var fd = document.getElementById('f-date');
  if (fd) fd.value = TODAY;
  var gd = new Date(); gd.setMonth(gd.getMonth()+3);
  var gdate = document.getElementById('g-date');
  if (gdate) gdate.value = gd.toISOString().split('T')[0];

  buildPmGrid();
  updateCats();
  addPerson();
  loadAll();
  checkStatus();
  setInterval(checkStatus, 30000);
}

// ═══════════════════════════════
// BOOT — runs when page is ready
// ═══════════════════════════════
// Inject tab CSS immediately — before DOM ready
(function(){
  var s = document.createElement('style');
  s.textContent = '.tab{display:none!important}';
  document.head.appendChild(s);
})();

document.addEventListener('DOMContentLoaded', function() {
  // Force hide all tabs
  var names = ['dashboard','wallets','transactions','add','budget','goals','split','analytics','settings'];
  names.forEach(function(name) {
    var el = document.getElementById('tab-' + name);
    if (el) {
      el.setAttribute('style', 'display:none!important');
    }
  });

  // Show dashboard
  var dash = document.getElementById('tab-dashboard');
  if (dash) dash.setAttribute('style', 'display:block!important');

  // Attach nav clicks
  var btns = document.querySelectorAll('.dn, .bn');
  for (var i = 0; i < btns.length; i++) {
    (function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var name = btn.getAttribute('data-tab');
        if (name) goTab(name);
      });
    })(btns[i]);
  }

  init();
});
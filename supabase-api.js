// ═══════════════════════════════════════════════════
// SmartSpend v6 — supabase-api.js
// Replaces all PHP API files with Supabase JS calls
// Load this BEFORE app.js in index.html
// ═══════════════════════════════════════════════════

var SUPABASE_URL = 'https://ehufyimcowsiujnnxurm.supabase.co';      // 🔴 Replace with your Project URL
var SUPABASE_KEY = 'sb_publishable_X54IuEq3IvU1UvprU3Mu-Q_x3ReTXtT'; // 🔴 Replace with your anon/public key

var _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Auth helpers ─────────────────────────────────
async function _uid() {
  var res = await _sb.auth.getUser();
  return res.data.user ? res.data.user.id : null;
}

// ── Override GET/POST/DEL from app.js ─────────────
window.GET = function(url, cb) {
  _sbGET(url).then(function(d){ cb(null, d); }).catch(function(e){ cb(e, null); });
};

window.POST = function(url, data, cb) {
  cb = cb || function(){};
  _sbPOST(url, data).then(function(d){ cb(null, d); }).catch(function(e){ cb(e, null); });
};

window.DEL = function(url, cb) {
  cb = cb || function(){};
  _sbDEL(url).then(function(d){ cb(null, d); }).catch(function(e){ cb(e, null); });
};

// ── Parse URL helper ─────────────────────────────
function _parseUrl(url) {
  var parts = url.split('?');
  var path  = parts[0];
  var params = {};
  if (parts[1]) {
    parts[1].split('&').forEach(function(kv) {
      var x = kv.split('=');
      params[decodeURIComponent(x[0])] = decodeURIComponent(x[1] || '');
    });
  }
  return { path: path, params: params };
}

// ═══════════════════════════════════════════════════
// GET ROUTER
// ═══════════════════════════════════════════════════
async function _sbGET(url) {
  var uid = await _uid();
  var u   = _parseUrl(url);
  var p   = u.path;
  var q   = u.params;

  // ── TRANSACTIONS ──────────────────────────────
  if (p.indexOf('transactions') !== -1) {
    var query = _sb.from('ss_transactions')
      .select('*')
      .eq('user_id', uid)
      .order('tx_date', { ascending: false })
      .order('id', { ascending: false });

    if (q.month && q.year) {
      var m = String(q.month).padStart(2, '0');
      var y = q.year;
      query = query
        .gte('tx_date', y + '-' + m + '-01')
        .lte('tx_date', y + '-' + m + '-31');
    }
    if (q.type) query = query.eq('type', q.type);
    if (q.search) {
      query = query.or('category.ilike.%' + q.search + '%,description.ilike.%' + q.search + '%');
    }

    var lim = parseInt(q.limit || '2000');
    var off = parseInt(q.offset || '0');
    query = query.range(off, off + lim - 1);

    var res = await query;
    if (res.error) throw res.error;

    var rows = (res.data || []).map(function(r) {
      return Object.assign({}, r, { amount: parseFloat(r.amount), recurring: !!r.recurring });
    });

    var totals = { total_income: 0, total_expense: 0, total_count: rows.length,
                   cash_expense: 0, digital_expense: 0, cash_income: 0, digital_income: 0 };
    rows.forEach(function(r) {
      var a = r.amount;
      if (r.type === 'income') {
        totals.total_income += a;
        if (r.pay_mode === 'cash') totals.cash_income += a; else totals.digital_income += a;
      } else {
        totals.total_expense += a;
        if (r.pay_mode === 'cash') totals.cash_expense += a; else totals.digital_expense += a;
      }
    });

    return { transactions: rows, totals: totals };
  }

  // ── WALLETS ───────────────────────────────────
  if (p.indexOf('wallets') !== -1) {
    if (q.action === 'transfers') {
      var res = await _sb.from('ss_transfers')
        .select('*').eq('user_id', uid)
        .order('tx_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (res.error) throw res.error;
      return { transfers: (res.data || []).map(function(r){ return Object.assign({}, r, {amount: parseFloat(r.amount)}); }) };
    }

    var wRes = await _sb.from('ss_wallets').select('*').eq('user_id', uid);
    if (wRes.error) throw wRes.error;

    var wallets = {};
    (wRes.data || []).forEach(function(r){ wallets[r.name] = parseFloat(r.balance); });

    var now = new Date();
    var cm = String(now.getMonth() + 1).padStart(2, '0');
    var cy = now.getFullYear();
    var txRes = await _sb.from('ss_transactions')
      .select('amount, type, pay_mode')
      .eq('user_id', uid)
      .gte('tx_date', cy + '-' + cm + '-01')
      .lte('tx_date', cy + '-' + cm + '-31');

    var monthly = { cash_out: 0, digital_out: 0, cash_in: 0, digital_in: 0 };
    (txRes.data || []).forEach(function(r) {
      var a = parseFloat(r.amount);
      if (r.type === 'expense') {
        if (r.pay_mode === 'cash') monthly.cash_out += a; else monthly.digital_out += a;
      } else {
        if (r.pay_mode === 'cash') monthly.cash_in += a; else monthly.digital_in += a;
      }
    });

    return { wallets: wallets, monthly: monthly };
  }

  // ── SETTINGS ──────────────────────────────────
  if (p.indexOf('settings') !== -1) {
    var res = await _sb.from('ss_settings')
      .select('setting_key, setting_value')
      .eq('user_id', uid);
    if (res.error) throw res.error;
    var settings = {};
    (res.data || []).forEach(function(r){ settings[r.setting_key] = r.setting_value; });
    return { settings: settings };
  }

  // ── GOALS ─────────────────────────────────────
  if (p.indexOf('goals') !== -1) {
    var res = await _sb.from('ss_goals')
      .select('*').eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return { goals: (res.data || []).map(function(r){
      return Object.assign({}, r, { target_amount: parseFloat(r.target_amount), saved_amount: parseFloat(r.saved_amount) });
    })};
  }

  // ── SPLITS ────────────────────────────────────
  if (p.indexOf('splits') !== -1) {
    var res = await _sb.from('ss_splits')
      .select('*, ss_split_people(*)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return { splits: (res.data || []).map(function(s){
      return Object.assign({}, s, {
        total_amount: parseFloat(s.total_amount),
        people: (s.ss_split_people || []).map(function(pp){ return { name: pp.name, amount: parseFloat(pp.amount) }; })
      });
    })};
  }

  // ── ANALYTICS ─────────────────────────────────
  if (p.indexOf('analytics') !== -1) {
    var month  = parseInt(q.month || new Date().getMonth() + 1);
    var year   = parseInt(q.year  || new Date().getFullYear());
    var action = q.action || 'summary';
    var m = String(month).padStart(2, '0');

    var txRes = await _sb.from('ss_transactions')
      .select('amount, type, pay_mode, category, tx_date')
      .eq('user_id', uid)
      .gte('tx_date', year + '-' + m + '-01')
      .lte('tx_date', year + '-' + m + '-31');
    var txs = txRes.data || [];

    if (action === 'summary' || action === 'insights') {
      var monthly = { income: 0, expense: 0, cash_expense: 0, digital_expense: 0, cash_income: 0, digital_income: 0 };
      txs.forEach(function(r) {
        var a = parseFloat(r.amount);
        monthly[r.type] += a;
        if (r.type === 'expense') {
          if (r.pay_mode === 'cash') monthly.cash_expense += a; else monthly.digital_expense += a;
        } else {
          if (r.pay_mode === 'cash') monthly.cash_income += a; else monthly.digital_income += a;
        }
      });

      var catMap = {};
      txs.filter(function(r){ return r.type === 'expense'; }).forEach(function(r){
        catMap[r.category] = (catMap[r.category] || 0) + parseFloat(r.amount);
      });
      var cats = Object.keys(catMap).map(function(k){ return { category: k, total: catMap[k] }; });
      cats.sort(function(a,b){ return b.total - a.total; });

      return { monthly: monthly, categories: cats };
    }

    if (action === 'monthly_report') {
      var months = [];
      for (var i = 5; i >= 0; i--) {
        var mm = month - i; var yy = year;
        if (mm <= 0) { mm += 12; yy--; }
        var ms = String(mm).padStart(2,'0');
        var mRes = await _sb.from('ss_transactions')
          .select('amount, type')
          .eq('user_id', uid)
          .gte('tx_date', yy + '-' + ms + '-01')
          .lte('tx_date', yy + '-' + ms + '-31');
        var mTxs = mRes.data || [];
        var exp = 0, inc = 0;
        mTxs.forEach(function(r){ if(r.type==='expense') exp += parseFloat(r.amount); else inc += parseFloat(r.amount); });
        var d = new Date(yy, mm-1, 1);
        var label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
        months.push({ label: label, expense: exp, income: inc });
      }
      return { months: months };
    }
  }

  throw new Error('Unknown endpoint: ' + url);
}

// ═══════════════════════════════════════════════════
// POST ROUTER
// ═══════════════════════════════════════════════════
async function _sbPOST(url, data) {
  var uid = await _uid();
  var u   = _parseUrl(url);
  var p   = u.path;
  var q   = u.params;

  // ── ADD TRANSACTION ───────────────────────────
  if (p.indexOf('transactions') !== -1) {
    var ins = {
      user_id:     uid,
      amount:      parseFloat(data.amount),
      category:    data.category,
      type:        data.type,
      pay_mode:    data.pay_mode || 'cash',
      tx_date:     data.date,
      description: data.description || '',
      recurring:   !!(data.recurring)
    };
    var res = await _sb.from('ss_transactions').insert(ins).select().single();
    if (res.error) throw res.error;
    var row = Object.assign({}, res.data, { amount: parseFloat(res.data.amount), recurring: !!res.data.recurring });
    return { status: 'created', transaction: row };
  }

  // ── WALLETS ───────────────────────────────────
  if (p.indexOf('wallets') !== -1) {
    if (q.action === 'set_balance') {
      var res = await _sb.from('ss_wallets')
        .update({ balance: parseFloat(data.balance) })
        .eq('user_id', uid).eq('name', data.wallet);
      if (res.error) throw res.error;
      return { status: 'updated', wallet: data.wallet, balance: parseFloat(data.balance) };
    }

    if (q.action === 'transfer') {
      var from = data.from; var to = data.to; var amt = parseFloat(data.amount);

      // Get from-wallet balance
      var fromRes = await _sb.from('ss_wallets').select('balance').eq('user_id', uid).eq('name', from).single();
      if (fromRes.error) throw fromRes.error;
      var bal = parseFloat(fromRes.data.balance);
      if (bal < amt) throw new Error('Insufficient ' + from + ' balance');

      // Deduct from source
      await _sb.from('ss_wallets').update({ balance: bal - amt }).eq('user_id', uid).eq('name', from);

      // Add to destination
      var toRes = await _sb.from('ss_wallets').select('balance').eq('user_id', uid).eq('name', to).single();
      var toBal = parseFloat(toRes.data.balance);
      await _sb.from('ss_wallets').update({ balance: toBal + amt }).eq('user_id', uid).eq('name', to);

      // Log transfer
      await _sb.from('ss_transfers').insert({
        user_id: uid, from_wallet: from, to_wallet: to,
        amount: amt, note: data.note || '', tx_date: new Date().toISOString().split('T')[0]
      });

      return { status: 'transferred', from: from, to: to, amount: amt };
    }
  }

  // ── SETTINGS ──────────────────────────────────
  if (p.indexOf('settings') !== -1) {
    var upserts = Object.keys(data).map(function(k) {
      return { user_id: uid, setting_key: k, setting_value: String(data[k]), updated_at: new Date().toISOString() };
    });
    var res = await _sb.from('ss_settings').upsert(upserts, { onConflict: 'user_id,setting_key' });
    if (res.error) throw res.error;
    return { status: 'saved' };
  }

  // ── GOALS ─────────────────────────────────────
  if (p.indexOf('goals') !== -1) {
    var ins = {
      user_id:       uid,
      name:          data.name,
      target_amount: parseFloat(data.target_amount),
      saved_amount:  parseFloat(data.saved_amount || 0),
      target_date:   data.target_date
    };
    var res = await _sb.from('ss_goals').insert(ins).select().single();
    if (res.error) throw res.error;
    var row = Object.assign({}, res.data, { target_amount: parseFloat(res.data.target_amount), saved_amount: parseFloat(res.data.saved_amount) });
    return { status: 'created', goal: row };
  }

  // ── SPLITS ────────────────────────────────────
  if (p.indexOf('splits') !== -1) {
    var sRes = await _sb.from('ss_splits').insert({
      user_id:      uid,
      description:  data.description,
      total_amount: parseFloat(data.total_amount),
      split_date:   new Date().toISOString().split('T')[0]
    }).select().single();
    if (sRes.error) throw sRes.error;

    var sid = sRes.data.id;
    var people = (data.people || []).map(function(pp){ return { split_id: sid, name: pp.name, amount: parseFloat(pp.amount) }; });
    var pRes = await _sb.from('ss_split_people').insert(people);
    if (pRes.error) throw pRes.error;

    return { status: 'created', id: sid };
  }

  throw new Error('Unknown POST endpoint: ' + url);
}

// ═══════════════════════════════════════════════════
// DELETE ROUTER
// ═══════════════════════════════════════════════════
async function _sbDEL(url) {
  var uid = await _uid();
  var u   = _parseUrl(url);
  var p   = u.path;
  var q   = u.params;
  var id  = parseInt(q.id || '0');

  if (p.indexOf('transactions') !== -1) {
    var res = await _sb.from('ss_transactions').delete().eq('id', id).eq('user_id', uid);
    if (res.error) throw res.error;
    return { status: 'deleted' };
  }

  if (p.indexOf('goals') !== -1) {
    var res = await _sb.from('ss_goals').delete().eq('id', id).eq('user_id', uid);
    if (res.error) throw res.error;
    return { status: 'deleted' };
  }

  if (p.indexOf('splits') !== -1) {
    var res = await _sb.from('ss_splits').delete().eq('id', id).eq('user_id', uid);
    if (res.error) throw res.error;
    return { status: 'deleted' };
  }

  throw new Error('Unknown DELETE endpoint: ' + url);
}

// ═══════════════════════════════════════════════════
// AUTH — called from login.html
// ═══════════════════════════════════════════════════
async function sbSignIn(email, password) {
  var res = await _sb.auth.signInWithPassword({ email: email, password: password });
  if (res.error) throw res.error;
  return res.data;
}

async function sbSignUp(email, password, name) {
  var res = await _sb.auth.signUp({ email: email, password: password, options: { data: { name: name } } });
  if (res.error) throw res.error;

  // Create default wallets + settings for new user
  var uid = res.data.user.id;
  await _sb.from('ss_wallets').insert([
    { user_id: uid, name: 'cash',    balance: 0 },
    { user_id: uid, name: 'digital', balance: 0 }
  ]);
  await _sb.from('ss_settings').insert([
    { user_id: uid, setting_key: 'budget_limit',      setting_value: '5000' },
    { user_id: uid, setting_key: 'alert_threshold',   setting_value: '80' },
    { user_id: uid, setting_key: 'savings_target',    setting_value: '1000' },
    { user_id: uid, setting_key: 'currency',          setting_value: '₹' }
  ]);

  return res.data;
}

async function sbSignOut() {
  await _sb.auth.signOut();
  window.location.href = 'login.html';
}

async function sbCheckSession() {
  var res = await _sb.auth.getSession();
  if (!res.data.session) {
    window.location.href = 'login.html';
  }
}

// Expose supabase client for other uses
window._sb = _sb;

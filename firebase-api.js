// ═══════════════════════════════════════════════════
// SmartSpend v6 — firebase-api.js
// Replaces supabase-api.js with Firebase Firestore
// Load this BEFORE app.js in index.html
// ═══════════════════════════════════════════════════

// 🔴 STEP 3: Replace these with your Firebase config
var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCAGIWZPhroAJFZT8yeYHT5xeETPhP-cnc",
  authDomain:        "smartspend-e7aa1.firebaseapp.com",
  projectId:         "smartspend-e7aa1",
  storageBucket:     "smartspend-e7aa1.firebasestorage.app",
  messagingSenderId: "1082968617324",
  appId:             "1:1082968617324:web:88d10070a528ea109a8349"
};

// ── Init Firebase ─────────────────────────────────
firebase.initializeApp(FIREBASE_CONFIG);
var _auth = firebase.auth();
var _db   = firebase.firestore();

// ── Auth helper ───────────────────────────────────
async function _uid() {
  var user = _auth.currentUser;
  if (user) return user.uid;
  return new Promise(function(res) {
    var unsub = _auth.onAuthStateChanged(function(u) {
      unsub(); res(u ? u.uid : null);
    });
  });
}

// ── Firestore helpers ─────────────────────────────
function _col(uid, name) {
  return _db.collection('users').doc(uid).collection(name);
}

// ── Override GET/POST/DEL (same as before) ────────
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

// ── Parse URL helper ──────────────────────────────
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
    var ref = _col(uid, 'transactions').orderBy('tx_date', 'desc');

    if (q.month && q.year) {
      var m  = String(q.month).padStart(2, '0');
      var y  = q.year;
      ref = ref
        .where('tx_date', '>=', y + '-' + m + '-01')
        .where('tx_date', '<=', y + '-' + m + '-31');
    }
    if (q.type) ref = ref.where('type', '==', q.type);

    var snap = await ref.limit(parseInt(q.limit || '2000')).get();
    var rows = [];
    snap.forEach(function(doc) {
      var r = Object.assign({ id: doc.id }, doc.data());
      r.amount = parseFloat(r.amount);
      r.recurring = !!r.recurring;
      if (q.search) {
        var s = q.search.toLowerCase();
        if ((r.category||'').toLowerCase().indexOf(s) === -1 &&
            (r.description||'').toLowerCase().indexOf(s) === -1) return;
      }
      rows.push(r);
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
      var snap = await _col(uid, 'transfers')
        .orderBy('tx_date', 'desc').limit(100).get();
      var transfers = [];
      snap.forEach(function(doc) {
        transfers.push(Object.assign({ id: doc.id }, doc.data(), { amount: parseFloat(doc.data().amount) }));
      });
      return { transfers: transfers };
    }

    // Get wallet balances
    var wSnap = await _col(uid, 'wallets').get();
    var wallets = {};
    wSnap.forEach(function(doc) { wallets[doc.id] = parseFloat(doc.data().balance || 0); });

    // Monthly stats
    var now = new Date();
    var cm  = String(now.getMonth() + 1).padStart(2, '0');
    var cy  = now.getFullYear();
    var txSnap = await _col(uid, 'transactions')
      .where('tx_date', '>=', cy + '-' + cm + '-01')
      .where('tx_date', '<=', cy + '-' + cm + '-31').get();

    var monthly = { cash_out: 0, digital_out: 0, cash_in: 0, digital_in: 0 };
    txSnap.forEach(function(doc) {
      var r = doc.data(); var a = parseFloat(r.amount);
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
    var snap = await _col(uid, 'settings').get();
    var settings = {};
    snap.forEach(function(doc) { settings[doc.id] = doc.data().value; });
    return { settings: settings };
  }

  // ── GOALS ─────────────────────────────────────
  if (p.indexOf('goals') !== -1) {
    var snap = await _col(uid, 'goals').orderBy('created_at', 'desc').get();
    var goals = [];
    snap.forEach(function(doc) {
      var r = Object.assign({ id: doc.id }, doc.data());
      r.target_amount = parseFloat(r.target_amount);
      r.saved_amount  = parseFloat(r.saved_amount);
      goals.push(r);
    });
    return { goals: goals };
  }

  // ── SPLITS ────────────────────────────────────
  if (p.indexOf('splits') !== -1) {
    var snap = await _col(uid, 'splits').orderBy('created_at', 'desc').get();
    var splits = [];
    snap.forEach(function(doc) {
      var r = Object.assign({ id: doc.id }, doc.data());
      r.total_amount = parseFloat(r.total_amount);
      splits.push(r);
    });
    return { splits: splits };
  }

  // ── ANALYTICS ─────────────────────────────────
  if (p.indexOf('analytics') !== -1) {
    var month  = parseInt(q.month || new Date().getMonth() + 1);
    var year   = parseInt(q.year  || new Date().getFullYear());
    var action = q.action || 'summary';
    var m = String(month).padStart(2, '0');

    var txSnap = await _col(uid, 'transactions')
      .where('tx_date', '>=', year + '-' + m + '-01')
      .where('tx_date', '<=', year + '-' + m + '-31').get();
    var txs = [];
    txSnap.forEach(function(doc) { txs.push(doc.data()); });

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
        var mSnap = await _col(uid, 'transactions')
          .where('tx_date', '>=', yy + '-' + ms + '-01')
          .where('tx_date', '<=', yy + '-' + ms + '-31').get();
        var exp = 0, inc = 0;
        mSnap.forEach(function(doc) {
          var r = doc.data();
          if (r.type === 'expense') exp += parseFloat(r.amount);
          else inc += parseFloat(r.amount);
        });
        var d = new Date(yy, mm-1, 1);
        months.push({ label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), expense: exp, income: inc });
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
    var amt     = parseFloat(data.amount);
    var payMode = data.pay_mode || 'cash';
    var txType  = data.type;

    var ins = {
      amount:      amt,
      category:    data.category,
      type:        txType,
      pay_mode:    payMode,
      tx_date:     data.date,
      description: data.description || '',
      recurring:   !!(data.recurring),
      created_at:  new Date().toISOString()
    };
    var ref = await _col(uid, 'transactions').add(ins);

    // Auto-update wallet
    var walletName = (payMode === 'cash') ? 'cash' : 'digital';
    var wRef  = _col(uid, 'wallets').doc(walletName);
    var wSnap = await wRef.get();
    if (wSnap.exists) {
      var cur = parseFloat(wSnap.data().balance || 0);
      var newBal = txType === 'income' ? cur + amt : cur - amt;
      await wRef.update({ balance: newBal });
    }

    return { status: 'created', transaction: Object.assign({ id: ref.id }, ins) };
  }

  // ── WALLETS ───────────────────────────────────
  if (p.indexOf('wallets') !== -1) {
    if (q.action === 'set_balance') {
      await _col(uid, 'wallets').doc(data.wallet)
        .set({ balance: parseFloat(data.balance) }, { merge: true });
      return { status: 'updated', wallet: data.wallet, balance: parseFloat(data.balance) };
    }

    if (q.action === 'transfer') {
      var from = (data.from || '').toLowerCase().replace(' wallet', '').trim();
      var to   = (data.to   || '').toLowerCase().replace(' wallet', '').trim();
      var amt  = parseFloat(data.amount);

      var fromRef  = _col(uid, 'wallets').doc(from);
      var fromSnap = await fromRef.get();
      if (!fromSnap.exists) throw new Error('Wallet not found: ' + from);
      var bal = parseFloat(fromSnap.data().balance || 0);
      if (bal < amt) throw new Error('Insufficient ' + from + ' balance');

      await fromRef.update({ balance: bal - amt });

      var toRef  = _col(uid, 'wallets').doc(to);
      var toSnap = await toRef.get();
      var toBal  = toSnap.exists ? parseFloat(toSnap.data().balance || 0) : 0;
      await toRef.set({ balance: toBal + amt }, { merge: true });

      await _col(uid, 'transfers').add({
        from_wallet: from, to_wallet: to,
        amount: amt, note: data.note || '',
        tx_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      });

      return { status: 'transferred', from: from, to: to, amount: amt };
    }
  }

  // ── SETTINGS ──────────────────────────────────
  if (p.indexOf('settings') !== -1) {
    var batch = _db.batch();
    Object.keys(data).forEach(function(k) {
      var ref = _col(uid, 'settings').doc(k);
      batch.set(ref, { value: String(data[k]), updated_at: new Date().toISOString() }, { merge: true });
    });
    await batch.commit();
    return { status: 'saved' };
  }

  // ── GOALS ─────────────────────────────────────
  if (p.indexOf('goals') !== -1) {
    var ins = {
      name:          data.name,
      target_amount: parseFloat(data.target_amount),
      saved_amount:  parseFloat(data.saved_amount || 0),
      target_date:   data.target_date,
      created_at:    new Date().toISOString()
    };
    var ref = await _col(uid, 'goals').add(ins);
    return { status: 'created', goal: Object.assign({ id: ref.id }, ins) };
  }

  // ── SPLITS ────────────────────────────────────
  if (p.indexOf('splits') !== -1) {
    var ins = {
      description:  data.description,
      total_amount: parseFloat(data.total_amount),
      split_date:   new Date().toISOString().split('T')[0],
      created_at:   new Date().toISOString(),
      people:       (data.people || []).map(function(pp){ return { name: pp.name, amount: parseFloat(pp.amount) }; })
    };
    var ref = await _col(uid, 'splits').add(ins);
    return { status: 'created', id: ref.id };
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
  var id  = q.id || '';

  if (p.indexOf('transactions') !== -1) {
    await _col(uid, 'transactions').doc(id).delete();
    return { status: 'deleted' };
  }
  if (p.indexOf('goals') !== -1) {
    await _col(uid, 'goals').doc(id).delete();
    return { status: 'deleted' };
  }
  if (p.indexOf('splits') !== -1) {
    await _col(uid, 'splits').doc(id).delete();
    return { status: 'deleted' };
  }

  throw new Error('Unknown DELETE endpoint: ' + url);
}

// ═══════════════════════════════════════════════════
// AUTH — same function names as before
// ═══════════════════════════════════════════════════
async function sbSignIn(email, pass) {
  var res = await _auth.signInWithEmailAndPassword(email, pass);

  // Auto-create wallets if missing
  var uid   = res.user.uid;
  var wSnap = await _col(uid, 'wallets').get();
  if (wSnap.empty) {
    await _col(uid, 'wallets').doc('cash').set({ balance: 0 });
    await _col(uid, 'wallets').doc('digital').set({ balance: 0 });
  }
  return res;
}

async function sbSignUp(email, password, name) {
  var res = await _auth.createUserWithEmailAndPassword(email, password);
  await res.user.updateProfile({ displayName: name });
  await res.user.sendEmailVerification();

  // Create default data
  var uid = res.user.uid;
  await _col(uid, 'wallets').doc('cash').set({ balance: 0 });
  await _col(uid, 'wallets').doc('digital').set({ balance: 0 });

  var batch = _db.batch();
  var defaults = { budget_limit: '5000', alert_threshold: '80', savings_target: '1000', currency: '₹' };
  Object.keys(defaults).forEach(function(k) {
    batch.set(_col(uid, 'settings').doc(k), { value: defaults[k] });
  });
  await batch.commit();

  return res;
}

async function sbSignOut() {
  await _auth.signOut();
  window.location.href = 'login.html';
}

async function sbCheckSession() {
  return new Promise(function(res) {
    _auth.onAuthStateChanged(function(user) {
      if (!user) window.location.href = 'login.html';
      else res(user);
    });
  });
}

// Keep _sb compatible reference for checkStatus in app.js
window._sb = {
  from: function() {
    return {
      select: function() { return { limit: function() { return Promise.resolve({ error: null }); } }; }
    };
  }
};
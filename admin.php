<?php
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    session_start();
}
require_once __DIR__ . '/includes/config.php';

// Must be logged in AND admin
if (empty($_SESSION['ss_user_id'])) { header('Location: login.php'); exit(); }
if (empty($_SESSION['ss_is_admin']))  { die('<div style="font-family:sans-serif;padding:40px;color:#ff4f6d;background:#07090f;min-height:100vh">⛔ Admin access only.</div>'); }

try {
    $pdo = new PDO(
        "mysql:host=".DB_HOST.";port=".DB_PORT.";dbname=".DB_NAME.";charset=utf8mb4",
        DB_USER, DB_PASS,
        array(PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC)
    );
} catch (PDOException $e) {
    die('DB error: ' . $e->getMessage());
}

// ── Handle delete user ──
if (isset($_GET['delete_user']) && is_numeric($_GET['delete_user'])) {
    $did = (int)$_GET['delete_user'];
    if ($did !== (int)$_SESSION['ss_user_id']) { // can't delete yourself
        $pdo->prepare("DELETE FROM ss_transactions WHERE user_id=?")->execute(array($did));
        $pdo->prepare("DELETE FROM ss_wallets WHERE user_id=?")->execute(array($did));
        $pdo->prepare("DELETE FROM ss_goals WHERE user_id=?")->execute(array($did));
        $pdo->prepare("DELETE FROM ss_splits WHERE user_id=?")->execute(array($did));
        $pdo->prepare("DELETE FROM ss_settings WHERE user_id=?")->execute(array($did));
        $pdo->prepare("DELETE FROM ss_transfers WHERE user_id=?")->execute(array($did));
        $pdo->prepare("DELETE FROM ss_users WHERE id=?")->execute(array($did));
    }
    header('Location: admin.php');
    exit();
}

// ── Fetch stats ──
$totalUsers    = (int)$pdo->query("SELECT COUNT(*) FROM ss_users")->fetchColumn();
$totalTx       = (int)$pdo->query("SELECT COUNT(*) FROM ss_transactions")->fetchColumn();
$totalExpense  = (float)$pdo->query("SELECT COALESCE(SUM(amount),0) FROM ss_transactions WHERE type='expense'")->fetchColumn();
$totalIncome   = (float)$pdo->query("SELECT COALESCE(SUM(amount),0) FROM ss_transactions WHERE type='income'")->fetchColumn();
$totalGoals    = (int)$pdo->query("SELECT COUNT(*) FROM ss_goals")->fetchColumn();

// ── Fetch all users with their stats ──
$users = $pdo->query("
    SELECT u.*,
        COUNT(DISTINCT t.id) AS tx_count,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END),0) AS total_exp,
        COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount ELSE 0 END),0) AS total_inc,
        COALESCE(SUM(CASE WHEN t.type='expense' AND t.pay_mode='cash' THEN t.amount ELSE 0 END),0) AS cash_exp,
        COUNT(DISTINCT g.id) AS goal_count
    FROM ss_users u
    LEFT JOIN ss_transactions t ON t.user_id = u.id
    LEFT JOIN ss_goals g ON g.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
")->fetchAll();

// ── Recent transactions across all users ──
$recentTx = $pdo->query("
    SELECT t.*, u.name AS user_name, u.email AS user_email
    FROM ss_transactions t
    JOIN ss_users u ON u.id = t.user_id
    ORDER BY t.tx_date DESC, t.id DESC
    LIMIT 20
")->fetchAll();

// ── Monthly chart data (last 6 months) ──
$chartMonths = array();
for ($i = 5; $i >= 0; $i--) {
    $m = (int)date('n') - $i;
    $y = (int)date('Y');
    if ($m <= 0) { $m += 12; $y--; }
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS exp, COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS inc FROM ss_transactions WHERE MONTH(tx_date)=? AND YEAR(tx_date)=?");
    $stmt->execute(array($m, $y));
    $row = $stmt->fetch();
    $chartMonths[] = array('label' => date('M y', mktime(0,0,0,$m,1,$y)), 'exp' => (float)$row['exp'], 'inc' => (float)$row['inc']);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SmartSpend — Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{-webkit-font-smoothing:antialiased}
body{font-family:'Outfit',sans-serif;background:#07090f;color:#e2ecf8;min-height:100vh}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;z-index:0}

/* NAV */
.nav{position:sticky;top:0;z-index:100;background:rgba(7,9,15,.95);border-bottom:1px solid rgba(255,255,255,.06);backdrop-filter:blur(20px);padding:0 24px}
.nav-in{display:flex;align-items:center;justify-content:space-between;height:56px;max-width:1200px;margin:0 auto}
.nav-logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:16px}
.nav-ico{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#00d4b8,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:14px}
.admin-badge{background:rgba(255,79,109,.12);border:1px solid rgba(255,79,109,.3);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;color:#ff4f6d;font-family:'JetBrains Mono',monospace;letter-spacing:1px}
.nav-r{display:flex;align-items:center;gap:10px}
.nav-r a{color:#6b82a0;text-decoration:none;font-size:13px;font-weight:600;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.07);transition:.2s}
.nav-r a:hover{color:#00d4b8;border-color:rgba(0,212,184,.3)}

/* LAYOUT */
.wrap{max-width:1200px;margin:0 auto;padding:28px 24px;position:relative;z-index:1}

/* STAT CARDS */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:28px}
.sc{background:rgba(13,17,23,.9);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:20px;position:relative;overflow:hidden}
.sc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--ac)}
.sc-ico{font-size:24px;margin-bottom:10px}
.sc-val{font-size:26px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--ac)}
.sc-lbl{font-size:11px;color:#6b82a0;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}

/* SECTION */
.sec{background:rgba(13,17,23,.9);border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:22px;margin-bottom:20px}
.sec-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.sec-t{font-size:14px;font-weight:700;color:#e2ecf8}
.sec-badge{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;padding:3px 8px;border-radius:5px;letter-spacing:1px}
.badge-cyan{background:rgba(0,212,184,.1);color:#00d4b8;border:1px solid rgba(0,212,184,.2)}
.badge-red{background:rgba(255,79,109,.1);color:#ff4f6d;border:1px solid rgba(255,79,109,.2)}

/* TABLE */
table{width:100%;border-collapse:collapse;font-size:13px}
th{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;color:#4d6080;text-transform:uppercase;letter-spacing:1px;padding:8px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,.05)}
td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.03);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.02)}

.av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#00d4b8,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0}
.user-info{display:flex;align-items:center;gap:10px}
.user-name{font-weight:700;font-size:13px}
.user-email{font-size:11px;color:#6b82a0;font-family:'JetBrains Mono',monospace}
.tag{display:inline-block;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:.5px;font-family:'JetBrains Mono',monospace}
.tag-admin{background:rgba(255,184,0,.1);color:#ffb800;border:1px solid rgba(255,184,0,.25)}
.tag-user{background:rgba(107,130,160,.1);color:#6b82a0;border:1px solid rgba(107,130,160,.2)}
.tag-exp{background:rgba(255,79,109,.1);color:#ff4f6d}
.tag-inc{background:rgba(29,233,130,.1);color:#1de982}
.tag-cash{background:rgba(245,158,11,.1);color:#f59e0b}
.tag-dig{background:rgba(59,130,246,.1);color:#3b82f6}
.mono{font-family:'JetBrains Mono',monospace;font-size:12px}
.del-btn{background:rgba(255,79,109,.08);border:1px solid rgba(255,79,109,.2);color:#ff4f6d;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;text-decoration:none;font-family:'Outfit',sans-serif}
.del-btn:hover{background:rgba(255,79,109,.15)}

/* CHART */
.chart-wrap{height:220px;position:relative}

/* GRID */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:700px){.g2{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}}

.emp{text-align:center;padding:30px;color:#4d6080;font-size:13px}
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-in">
    <div class="nav-logo">
      <div class="nav-ico">💸</div>
      SmartSpend
      <span class="admin-badge">ADMIN</span>
    </div>
    <div class="nav-r">
      <a href="index.php">← Back to App</a>
      <a href="logout.php">🚪 Logout</a>
    </div>
  </div>
</nav>

<div class="wrap">

  <!-- STAT CARDS -->
  <div class="stats">
    <div class="sc" style="--ac:#00d4b8">
      <div class="sc-ico">👥</div>
      <div class="sc-val"><?php echo $totalUsers; ?></div>
      <div class="sc-lbl">Total Users</div>
    </div>
    <div class="sc" style="--ac:#8b5cf6">
      <div class="sc-ico">💳</div>
      <div class="sc-val"><?php echo $totalTx; ?></div>
      <div class="sc-lbl">Transactions</div>
    </div>
    <div class="sc" style="--ac:#ff4f6d">
      <div class="sc-ico">📉</div>
      <div class="sc-val">₹<?php echo number_format($totalExpense,0); ?></div>
      <div class="sc-lbl">Total Expenses</div>
    </div>
    <div class="sc" style="--ac:#1de982">
      <div class="sc-ico">📈</div>
      <div class="sc-val">₹<?php echo number_format($totalIncome,0); ?></div>
      <div class="sc-lbl">Total Income</div>
    </div>
    <div class="sc" style="--ac:#ffb800">
      <div class="sc-ico">🎯</div>
      <div class="sc-val"><?php echo $totalGoals; ?></div>
      <div class="sc-lbl">Active Goals</div>
    </div>
  </div>

  <!-- CHART + USERS -->
  <div class="g2">
    <div class="sec">
      <div class="sec-h">
        <span class="sec-t">Platform Activity (6 months)</span>
        <span class="sec-badge badge-cyan">CHART</span>
      </div>
      <div class="chart-wrap"><canvas id="moChart"></canvas></div>
    </div>

    <div class="sec">
      <div class="sec-h">
        <span class="sec-t">Quick Stats</span>
        <span class="sec-badge badge-cyan">LIVE</span>
      </div>
      <table>
        <tr><td style="color:#6b82a0;font-size:12px">Avg txns/user</td><td class="mono"><?php echo $totalUsers > 0 ? round($totalTx/$totalUsers,1) : 0; ?></td></tr>
        <tr><td style="color:#6b82a0;font-size:12px">Avg expense/user</td><td class="mono">₹<?php echo $totalUsers > 0 ? number_format($totalExpense/$totalUsers,0) : 0; ?></td></tr>
        <tr><td style="color:#6b82a0;font-size:12px">Avg income/user</td><td class="mono">₹<?php echo $totalUsers > 0 ? number_format($totalIncome/$totalUsers,0) : 0; ?></td></tr>
        <tr><td style="color:#6b82a0;font-size:12px">Net savings (all)</td><td class="mono" style="color:<?php echo ($totalIncome-$totalExpense)>=0?'#1de982':'#ff4f6d'; ?>">₹<?php echo number_format($totalIncome-$totalExpense,0); ?></td></tr>
        <tr><td style="color:#6b82a0;font-size:12px">Goals per user</td><td class="mono"><?php echo $totalUsers > 0 ? round($totalGoals/$totalUsers,1) : 0; ?></td></tr>
        <tr><td style="color:#6b82a0;font-size:12px">DB Host</td><td class="mono" style="font-size:10px;color:#6b82a0"><?php echo DB_HOST; ?></td></tr>
      </table>
    </div>
  </div>

  <!-- USERS TABLE -->
  <div class="sec">
    <div class="sec-h">
      <span class="sec-t">All Users</span>
      <span class="sec-badge badge-cyan"><?php echo $totalUsers; ?> TOTAL</span>
    </div>
    <?php if (empty($users)): ?>
      <div class="emp">No users registered yet.</div>
    <?php else: ?>
    <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Role</th>
          <th>Transactions</th>
          <th>Total Expense</th>
          <th>Total Income</th>
          <th>Cash Exp</th>
          <th>Goals</th>
          <th>Joined</th>
          <th>Last Login</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($users as $u): ?>
        <tr>
          <td>
            <div class="user-info">
              <div class="av"><?php echo strtoupper(substr($u['name'],0,1)); ?></div>
              <div>
                <div class="user-name"><?php echo htmlspecialchars($u['name']); ?></div>
                <div class="user-email"><?php echo htmlspecialchars($u['email']); ?></div>
              </div>
            </div>
          </td>
          <td><span class="tag <?php echo $u['is_admin']?'tag-admin':'tag-user'; ?>"><?php echo $u['is_admin']?'ADMIN':'USER'; ?></span></td>
          <td class="mono"><?php echo $u['tx_count']; ?></td>
          <td class="mono" style="color:#ff4f6d">₹<?php echo number_format($u['total_exp'],0); ?></td>
          <td class="mono" style="color:#1de982">₹<?php echo number_format($u['total_inc'],0); ?></td>
          <td class="mono" style="color:#f59e0b">₹<?php echo number_format($u['cash_exp'],0); ?></td>
          <td class="mono"><?php echo $u['goal_count']; ?></td>
          <td style="font-size:11px;color:#6b82a0"><?php echo $u['created_at'] ? date('d M y', strtotime($u['created_at'])) : '—'; ?></td>
          <td style="font-size:11px;color:#6b82a0"><?php echo $u['last_login'] ? date('d M y', strtotime($u['last_login'])) : 'Never'; ?></td>
          <td>
            <?php if ((int)$u['id'] !== (int)$_SESSION['ss_user_id']): ?>
              <a href="admin.php?delete_user=<?php echo $u['id']; ?>" class="del-btn" onclick="return confirm('Delete <?php echo htmlspecialchars($u['name']); ?> and ALL their data?')">Delete</a>
            <?php else: ?>
              <span style="font-size:11px;color:#2d3f56">You</span>
            <?php endif; ?>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    </div>
    <?php endif; ?>
  </div>

  <!-- RECENT TRANSACTIONS -->
  <div class="sec">
    <div class="sec-h">
      <span class="sec-t">Recent Transactions (All Users)</span>
      <span class="sec-badge badge-red">LIVE</span>
    </div>
    <?php if (empty($recentTx)): ?>
      <div class="emp">No transactions yet.</div>
    <?php else: ?>
    <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Date</th>
          <th>Category</th>
          <th>Type</th>
          <th>Pay Mode</th>
          <th>Amount</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($recentTx as $t): ?>
        <tr>
          <td>
            <div style="font-size:12px;font-weight:600"><?php echo htmlspecialchars($t['user_name']); ?></div>
            <div style="font-size:10px;color:#6b82a0;font-family:monospace"><?php echo htmlspecialchars($t['user_email']); ?></div>
          </td>
          <td class="mono" style="font-size:11px"><?php echo $t['tx_date']; ?></td>
          <td style="font-size:12px"><?php echo htmlspecialchars($t['category']); ?></td>
          <td><span class="tag <?php echo $t['type']==='expense'?'tag-exp':'tag-inc'; ?>"><?php echo strtoupper($t['type']); ?></span></td>
          <td><span class="tag <?php echo $t['pay_mode']==='cash'?'tag-cash':'tag-dig'; ?>"><?php echo strtoupper(str_replace('_',' ',$t['pay_mode'])); ?></span></td>
          <td class="mono" style="color:<?php echo $t['type']==='expense'?'#ff4f6d':'#1de982'; ?>;font-weight:700">
            <?php echo $t['type']==='expense'?'−':'+'; ?>₹<?php echo number_format((float)$t['amount'],2); ?>
          </td>
          <td style="font-size:11px;color:#6b82a0"><?php echo htmlspecialchars($t['description'] ?: '—'); ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    </div>
    <?php endif; ?>
  </div>

</div><!-- /wrap -->

<script>
var months = <?php echo json_encode(array_column($chartMonths,'label')); ?>;
var expData = <?php echo json_encode(array_column($chartMonths,'exp')); ?>;
var incData = <?php echo json_encode(array_column($chartMonths,'inc')); ?>;
var ctx = document.getElementById('moChart');
if (ctx) {
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Income',  data: incData, backgroundColor: 'rgba(29,233,130,.4)', borderColor: '#1de982', borderWidth: 1.5, borderRadius: 6 },
        { label: 'Expense', data: expData, backgroundColor: 'rgba(255,79,109,.4)', borderColor: '#ff4f6d', borderWidth: 1.5, borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: 'rgba(255,255,255,.5)', font: { size: 11 } } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: 'rgba(255,255,255,.4)', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: 'rgba(255,255,255,.4)', font: { size: 10 } } }
      }
    }
  });
}
</script>
</body>
</html>
<?php
// Start session FIRST before anything else
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_lifetime', 86400 * 30);
    ini_set('session.cookie_httponly', 1);
    session_start();
}

require_once __DIR__ . '/includes/config.php';

// Already logged in
if (!empty($_SESSION['ss_user_id'])) {
    header('Location: index.php');
    exit();
}

$error = '';
$success = '';
$mode = isset($_GET['mode']) ? $_GET['mode'] : 'login';

try {
    $pdo = new PDO(
        "mysql:host=".DB_HOST.";port=".DB_PORT.";dbname=".DB_NAME.";charset=utf8mb4",
        DB_USER, DB_PASS,
        array(PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC)
    );
} catch (PDOException $e) {
    die('<p style="color:red;padding:20px;font-family:sans-serif">Database connection failed: ' . $e->getMessage() . '</p>');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = isset($_POST['action']) ? $_POST['action'] : '';

    if ($action === 'login') {
        $email = trim(isset($_POST['email']) ? $_POST['email'] : '');
        $pass  = isset($_POST['password']) ? $_POST['password'] : '';

        if (!$email || !$pass) {
            $error = 'Please enter email and password.';
        } else {
            $stmt = $pdo->prepare("SELECT * FROM ss_users WHERE email = ? LIMIT 1");
            $stmt->execute(array(strtolower($email)));
            $user = $stmt->fetch();

            if ($user && password_verify($pass, $user['password_hash'])) {
                $_SESSION['ss_user_id']    = $user['id'];
                $_SESSION['ss_user_name']  = $user['name'];
                $_SESSION['ss_user_email'] = $user['email'];
                $_SESSION['ss_is_admin']   = (int)$user['is_admin'];
                $pdo->prepare("UPDATE ss_users SET last_login=NOW() WHERE id=?")->execute(array($user['id']));
                header('Location: index.php');
                exit();
            } else {
                $error = 'Incorrect email or password.';
            }
        }
    }

    elseif ($action === 'register') {
        $name  = trim(isset($_POST['name']) ? $_POST['name'] : '');
        $email = strtolower(trim(isset($_POST['email']) ? $_POST['email'] : ''));
        $pass  = isset($_POST['password']) ? $_POST['password'] : '';
        $pass2 = isset($_POST['password2']) ? $_POST['password2'] : '';

        if (!$name || !$email || !$pass) {
            $error = 'All fields are required.';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $error = 'Enter a valid email address.';
        } elseif (strlen($pass) < 6) {
            $error = 'Password must be at least 6 characters.';
        } elseif ($pass !== $pass2) {
            $error = 'Passwords do not match.';
        } else {
            $stmt = $pdo->prepare("SELECT id FROM ss_users WHERE email=?");
            $stmt->execute(array($email));
            if ($stmt->fetch()) {
                $error = 'That email is already registered.';
            } else {
                $hash = password_hash($pass, PASSWORD_DEFAULT);
                $count = (int)$pdo->query("SELECT COUNT(*) FROM ss_users")->fetchColumn();
                $isAdmin = ($count === 0) ? 1 : 0;

                $pdo->prepare("INSERT INTO ss_users (name,email,password_hash,is_admin,created_at) VALUES (?,?,?,?,NOW())")
                    ->execute(array($name, $email, $hash, $isAdmin));
                $uid = (int)$pdo->lastInsertId();

                $pdo->prepare("INSERT INTO ss_wallets (user_id,name,balance) VALUES (?,?,0),(?,?,0)")
                    ->execute(array($uid,'cash',$uid,'digital'));

                $pdo->prepare("INSERT INTO ss_settings (user_id,setting_key,setting_value) VALUES (?,?,?),(?,?,?),(?,?,?),(?,?,?)")
                    ->execute(array($uid,'budget_limit','5000',$uid,'alert_threshold','80',$uid,'savings_target','1000',$uid,'currency','₹'));

                $success = 'Account created! You can now sign in.';
                $mode = 'login';
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#07090f">
<title>SmartSpend — <?php echo $mode === 'login' ? 'Sign In' : 'Register'; ?></title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{-webkit-font-smoothing:antialiased}
body{font-family:'Outfit',sans-serif;background:#07090f;color:#e2ecf8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;position:relative;overflow:hidden}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
.orb{position:fixed;border-radius:50%;filter:blur(80px);pointer-events:none}
.orb1{width:500px;height:500px;top:-150px;left:-150px;background:radial-gradient(circle,rgba(0,212,184,.1),transparent 70%)}
.orb2{width:400px;height:400px;bottom:-100px;right:-100px;background:radial-gradient(circle,rgba(139,92,246,.1),transparent 70%)}
.box{position:relative;z-index:1;background:rgba(13,17,23,.95);border:1px solid rgba(255,255,255,.07);border-radius:24px;padding:40px;width:100%;max-width:420px;backdrop-filter:blur(20px);box-shadow:0 24px 80px rgba(0,0,0,.6)}
.logo{display:flex;align-items:center;gap:12px;margin-bottom:32px;justify-content:center}
.logo-ico{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#00d4b8,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 0 20px rgba(0,212,184,.3)}
.logo-t{font-size:20px;font-weight:800;letter-spacing:-.3px}
.logo-v{font-family:'JetBrains Mono',monospace;font-size:8px;color:#00d4b8;letter-spacing:2px;text-transform:uppercase}
.tabs{display:grid;grid-template-columns:1fr 1fr;background:rgba(255,255,255,.04);border-radius:12px;padding:4px;margin-bottom:28px}
.tab-btn{padding:10px;border:none;background:transparent;border-radius:9px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;color:#6b82a0;cursor:pointer;transition:all .25s}
.tab-btn.on{background:rgba(0,212,184,.12);color:#00d4b8}
.ttl{font-size:22px;font-weight:800;margin-bottom:6px;letter-spacing:-.3px}
.sub{font-size:13px;color:#6b82a0;margin-bottom:24px}
label{display:block;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;color:#4d6080;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px}
input{width:100%;padding:13px 16px;background:#0d1117;border:1px solid rgba(255,255,255,.07);border-radius:10px;font-family:'Outfit',sans-serif;font-size:14px;color:#e2ecf8;outline:none;transition:all .25s;margin-bottom:14px}
input:focus{border-color:#00d4b8;box-shadow:0 0 0 3px rgba(0,212,184,.1)}
input::placeholder{color:#2d3f56}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#00d4b8,#00b39a);color:#07090f;font-family:'Outfit',sans-serif;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;transition:all .3s;margin-top:4px}
.btn:hover{box-shadow:0 8px 24px rgba(0,212,184,.3);transform:translateY(-1px)}
.err{background:rgba(255,79,109,.08);border:1px solid rgba(255,79,109,.2);border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:13px;color:#ff4f6d}
.ok{background:rgba(29,233,130,.07);border:1px solid rgba(29,233,130,.2);border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:13px;color:#1de982}
.foot{text-align:center;font-size:12px;color:#4d6080;margin-top:18px}
.foot a{color:#00d4b8;text-decoration:none;font-weight:600}
.strength{height:3px;border-radius:2px;margin-top:-10px;margin-bottom:14px;transition:all .3s;background:#1a2535}
.strength.w{background:#ff4f6d;width:33%}
.strength.m{background:#ffb800;width:66%}
.strength.s{background:#1de982;width:100%}
.note{font-family:'JetBrains Mono',monospace;font-size:10px;color:#2d3f56;text-align:center;margin-top:16px}
</style>
</head>
<body>
<div class="orb orb1"></div>
<div class="orb orb2"></div>
<div class="box">
  <div class="logo">
    <div class="logo-ico">💸</div>
    <div><div class="logo-t">SmartSpend</div><div class="logo-v">Finance OS · v5.0</div></div>
  </div>

  <div class="tabs">
    <button class="tab-btn <?php echo $mode==='login'?'on':''; ?>" onclick="location.href='login.php?mode=login'">Sign In</button>
    <button class="tab-btn <?php echo $mode==='register'?'on':''; ?>" onclick="location.href='login.php?mode=register'">Register</button>
  </div>

  <?php if ($error): ?>
    <div class="err">⚠️ <?php echo htmlspecialchars($error); ?></div>
  <?php endif; ?>
  <?php if ($success): ?>
    <div class="ok">✅ <?php echo htmlspecialchars($success); ?></div>
  <?php endif; ?>

  <?php if ($mode === 'login'): ?>
    <div class="ttl">Welcome back</div>
    <div class="sub">Sign in to your SmartSpend account</div>
    <form method="POST" action="login.php">
      <input type="hidden" name="action" value="login">
      <label>Email Address</label>
      <input type="email" name="email" placeholder="you@example.com" required autocomplete="email" value="<?php echo htmlspecialchars(isset($_POST['email'])?$_POST['email']:''); ?>">
      <label>Password</label>
      <input type="password" name="password" placeholder="Your password" required autocomplete="current-password">
      <button type="submit" class="btn">Sign In →</button>
    </form>
    <div class="foot">Don't have an account? <a href="login.php?mode=register">Register free</a></div>

  <?php else: ?>
    <div class="ttl">Create account</div>
    <div class="sub">Your data stays private — no one else can see it</div>
    <form method="POST" action="login.php?mode=register">
      <input type="hidden" name="action" value="register">
      <label>Your Name</label>
      <input type="text" name="name" placeholder="Aditya" required autocomplete="name" value="<?php echo htmlspecialchars(isset($_POST['name'])?$_POST['name']:''); ?>">
      <label>Email Address</label>
      <input type="email" name="email" placeholder="you@example.com" required autocomplete="email" value="<?php echo htmlspecialchars(isset($_POST['email'])?$_POST['email']:''); ?>">
      <label>Password</label>
      <input type="password" name="password" id="pw" placeholder="Min 6 characters" required autocomplete="new-password" oninput="checkStr(this.value)">
      <div class="strength" id="str"></div>
      <label>Confirm Password</label>
      <input type="password" name="password2" placeholder="Repeat password" required autocomplete="new-password">
      <button type="submit" class="btn">Create Account →</button>
    </form>
    <div class="foot">Already have an account? <a href="login.php?mode=login">Sign in</a></div>
    <div class="note">🔒 Your transactions are 100% private</div>
  <?php endif; ?>
</div>
<script>
function checkStr(v) {
  var s = document.getElementById('str');
  if (!s) return;
  if (v.length < 4) { s.className = 'strength'; return; }
  if (v.length < 8 || !/[0-9]/.test(v)) { s.className = 'strength w'; return; }
  if (v.length < 10) { s.className = 'strength m'; return; }
  s.className = 'strength s';
}
</script>
</body>
</html>
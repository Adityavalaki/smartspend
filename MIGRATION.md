# SmartSpend v6 — Supabase Migration Guide
## From PHP/MySQL (InfinityFree) → Supabase + GitHub Pages

---

## PHASE 1 — Supabase Setup (15 min)

1. Go to https://supabase.com → Sign up free
2. Click **New Project** → name it `smartspend` → set a strong DB password → choose region closest to you (e.g. South Asia)
3. Wait ~2 minutes for project to be ready
4. Go to **SQL Editor** (left sidebar)
5. Paste the entire contents of `supabase-schema.sql` and click **Run**
   - You should see: "Success. No rows returned"
6. Go to **Project Settings → API**
   - Copy your **Project URL** (looks like: https://xxxx.supabase.co)
   - Copy your **anon/public** key (long string starting with eyJ...)
7. Open `supabase-api.js` and replace lines 7-8:
   ```js
   var SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
   var SUPABASE_KEY = 'eyJ...your-anon-key...';
   ```
8. In Supabase → **Authentication → Settings**:
   - Disable "Confirm email" if you don't want email verification
   - Set Site URL to: `https://smartspend.dev`
   - Add `https://smartspend.dev` to Redirect URLs

---

## PHASE 2 — Update index.php → index.html (10 min)

Open your existing `index.php`. Make these 2 changes:

### Change 1 — Remove PHP header (first 7 lines)
DELETE these lines at the very top:
```php
<?php
require_once __DIR__.'/includes/config.php';
require_once __DIR__.'/includes/auth.php';
requireLoginRoot();
$user = currentUser();
try { $pdo=new PDO(...); }
catch(PDOException $e){ header('Location: login.php'); exit(); }
?>
```

### Change 2 — Add Supabase scripts BEFORE your existing scripts
Find the closing `</head>` tag and add these 2 lines BEFORE it:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-api.js"></script>
```

### Change 3 — Add session check at top of your existing <script> section
Find this line at the top of your inline `<script>` or in app.js init:
```js
document.addEventListener('DOMContentLoaded', function() {
```
Add this right after it:
```js
  sbCheckSession(); // redirects to login.html if not logged in
```

### Change 4 — Fix the logout button
Find wherever logout is triggered in index.php (search for `logout.php`):
```html
<a href="logout.php">
```
Replace with:
```html
<a href="#" onclick="sbSignOut()">
```

### Change 5 — Show user name
Find where the user name is displayed (search for `<?php echo $user`):
```php
<?php echo htmlspecialchars($user['name']); ?>
```
Replace with:
```html
<span id="user-name">...</span>
```
Then in app.js init, add:
```js
_sb.auth.getUser().then(function(r){
  var n = document.getElementById('user-name');
  if (n && r.data.user) n.textContent = r.data.user.user_metadata.name || r.data.user.email;
});
```

### Change 6 — Save the file as index.html
Rename `index.php` → `index.html`

---

## PHASE 3 — Update app.js (5 min)

Open `app.js` and make ONE change:

Find the `init()` function (around line 135). Add `sbCheckSession()` at the very start:
```js
function init() {
  sbCheckSession(); // ← ADD THIS LINE
  ...rest of your init code...
}
```

No other changes needed — `supabase-api.js` handles everything else!

---

## PHASE 4 — GitHub Pages Setup (10 min)

1. Create a new GitHub repo: `smartspend`
2. Upload these files to the repo:
   - `index.html`  (renamed from index.php)
   - `login.html`  (new file)
   - `app.js`      (unchanged)
   - `supabase-api.js` (new file)
   - Any other assets (CSS if separate, images, etc.)
   - DO NOT upload: any `.php` files, `includes/`, `api/` folder
3. Go to repo **Settings → Pages**
4. Source: **Deploy from branch** → `main` → `/ (root)` → Save
5. Your site will be live at: `https://yourusername.github.io/smartspend`

---

## PHASE 5 — Connect smartspend.dev (10 min)

1. In GitHub repo → Settings → Pages → **Custom domain**
   - Enter: `smartspend.dev` → Save
2. In name.com → DNS Settings for `smartspend.dev`:
   - Add these 4 **A records** (GitHub Pages IPs):
     ```
     Type: A  |  Host: @  |  Value: 185.199.108.153
     Type: A  |  Host: @  |  Value: 185.199.109.153
     Type: A  |  Host: @  |  Value: 185.199.110.153
     Type: A  |  Host: @  |  Value: 185.199.111.153
     ```
   - Add 1 **CNAME record**:
     ```
     Type: CNAME  |  Host: www  |  Value: yourusername.github.io
     ```
3. Wait 10-30 minutes → GitHub Pages will auto-issue SSL for `.dev` ✅
4. In Supabase → Authentication → Settings → update Site URL to `https://smartspend.dev`

---

## FINAL FILE STRUCTURE (what to upload to GitHub)

```
smartspend/
├── index.html       ← renamed from index.php (PHP removed)
├── login.html       ← new Supabase auth login
├── app.js           ← unchanged (mostly)
├── supabase-api.js  ← new — replaces all PHP APIs
└── (optional) any images or other assets
```

## WHAT YOU CAN DELETE
- `login.php`
- `logout.php`
- `admin.php`
- `migrate.php`
- `includes/` (entire folder)
- `api/` (entire folder)
- `.htaccess`

---

## END RESULT ✅
```
smartspend.dev (HTTPS auto ✅)
      │
      ▼
GitHub Pages (free, fast, no suspensions)
  index.html + app.js + supabase-api.js
      │
      ▼ Supabase JS SDK
Supabase (free tier: 500MB DB, 50k users)
  PostgreSQL + Auth + REST API
```

No PHP. No MySQL. No InfinityFree. No dangerous warnings. Ever again. 🚀

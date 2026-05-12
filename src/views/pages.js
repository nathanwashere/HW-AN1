function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLayout(title, content, session) {
  const nav = session
    ? `${session.role === "admin" ? `<a href="/admin">Admin Panel</a>` : ""}
       <a href="/dashboard">Dashboard</a>
       <a href="/profile">My Profile</a>
       <a href="/logout">Logout</a>`
    : `<a href="/">Login</a>
       <a href="/vulnerable">Vulnerable Login</a>
       <a href="/forgot-password">Forgot Password</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${htmlEscape(title)}</title>
  <link rel="stylesheet" href="/public/style.css">
</head>
<body>
  <div class="page-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Data Security</p>
        <h1>Authentication Assignment</h1>
      </div>
      <nav>${nav}</nav>
    </header>
    <main>${content}</main>
  </div>
</body>
</html>`;
}

function renderLoginPage({ error = "", success = "" } = {}) {
  return `
  <section class="card">
    <h2>Secure Login</h2>
    <p class="muted">Passwords are verified by comparing SHA-256 hashes — the plaintext is never stored or compared directly.</p>
    ${error   ? `<div class="alert error">${htmlEscape(error)}</div>`   : ""}
    ${success ? `<div class="alert success">${htmlEscape(success)}</div>` : ""}
    <form method="POST" action="/login" class="form-grid">
      <label>Username
        <input type="text" name="username" autocomplete="username" required>
      </label>
      <label>Password
        <input type="password" name="password" autocomplete="current-password" required>
      </label>
      <button type="submit">Sign In</button>
    </form>
    <p class="fine-print"><a href="/forgot-password">Forgot the password?</a></p>
    <p class="fine-print"><a href="/vulnerable">SQL Injection Demo →</a></p>
  </section>`;
}

function renderVulnerableLoginPage({ error = "" } = {}) {
  return `
  <section class="card">
    <h2>Vulnerable Login</h2>
    <div class="alert warning">
      <strong>SQL Injection Demo.</strong> This form concatenates raw input directly into the SQL query without escaping or hashing.
      Try these attacks:<br><br>
      <strong>Method 1 — bypass password (username field):</strong><br>
      Username: <code>' or 1=1--</code> &nbsp; Password: <em>anything</em><br>
      Query becomes: <code>WHERE username='' OR 1=1-- AND password_plain='...'</code><br>
      Always true → returns first row → logs in as <strong>admin</strong>.<br><br>
      <strong>Method 2 — target specific user (password field):</strong><br>
      Username: <code>student</code> &nbsp; Password: <code>' or (1=1 and username='student')--</code><br>
      Query becomes: <code>WHERE username='student' AND password_plain='' or (1=1 and username='student')--</code><br>
      Always true for student → logs in as <strong>student</strong> without the real password.
    </div>
    ${error ? `<div class="alert error">${htmlEscape(error)}</div>` : ""}
    <form method="POST" action="/vulnerable-login" class="form-grid">
      <label>Username
        <input type="text" name="username" autocomplete="off">
      </label>
      <label>Password
        <input type="text" name="password" autocomplete="off" placeholder="visible so you can see injection payloads">
      </label>
      <button type="submit" class="btn-danger">Sign In (Vulnerable)</button>
    </form>
    <p class="fine-print"><a href="/">← Back to secure login</a></p>
  </section>`;
}

function renderForgotPasswordPage({ error = "" } = {}) {
  return `
  <section class="card">
    <h2>Forgot Password</h2>
    <p class="muted">The old password cannot be restored because the database stores only a SHA-256 hash, not the original plaintext.</p>
    ${error ? `<div class="alert error">${htmlEscape(error)}</div>` : ""}
    <form method="POST" action="/forgot-password" class="form-grid">
      <label>Username
        <input type="text" name="username" autocomplete="username" required>
      </label>
      <button type="submit">Create Reset Link</button>
    </form>
  </section>`;
}

function renderResetLinkPage({ username = "", resetLink = "" } = {}) {
  return `
  <section class="card">
    <h2>Password Reset Link</h2>
    <p class="muted">A reset link was created for ${htmlEscape(username)}. The old password still cannot be restored because only a SHA-256 hash is stored in the database.</p>
    <div class="reset-box">
      <p>Use this link to create a new password:</p>
      <p><a href="${htmlEscape(resetLink)}">${htmlEscape(resetLink)}</a></p>
    </div>
  </section>`;
}

function renderResetPage({ token = "", error = "" } = {}) {
  return `
  <section class="card">
    <h2>Create a New Password</h2>
    <p class="muted">Set a new password. The previous password cannot be recovered from the database.</p>
    ${error ? `<div class="alert error">${htmlEscape(error)}</div>` : ""}
    <form method="POST" action="/reset-password" class="form-grid">
      <input type="hidden" name="token" value="${htmlEscape(token)}">
      <label>New Password
        <input type="password" name="password" minlength="8" autocomplete="new-password" required>
      </label>
      <label>Confirm Password
        <input type="password" name="confirmPassword" minlength="8" autocomplete="new-password" required>
      </label>
      <button type="submit">Save New Password</button>
    </form>
  </section>`;
}

function renderDashboard(session) {
  const rolePanel = session.role === "admin"
    ? `<div class="panel accent">
        <h3>Admin Access</h3>
        <p>You are the administrator. You can view all users and their credit card data in the Admin Panel.</p>
      </div>`
    : `<div class="panel">
        <h3>Standard User Access</h3>
        <p>You are logged in as a standard user. Visit <a href="/profile">My Profile</a> to view or edit your credit card.</p>
      </div>`;

  return `
  <section class="hero">
    <div class="card">
      <h2>Welcome, ${htmlEscape(session.username)}</h2>
      <p class="muted">Authenticated successfully with username/password over HTTP on localhost.</p>
      <div class="role-badge">${htmlEscape(session.role.toUpperCase())}</div>
    </div>
    ${rolePanel}
  </section>`;
}

function renderProfilePage(card, { error = "", success = "" } = {}) {
  const v = (field) => htmlEscape(card?.[field] ?? "");

  return `
  <section class="card card-wide">
    <h2>My Credit Card</h2>
    <p class="muted">
      All fields are validated with regular expressions before saving.
      The card is stored <strong>unencrypted</strong> in the database — this is intentional for the SQL injection demonstration.
    </p>
    ${error   ? `<div class="alert error">${htmlEscape(error)}</div>`   : ""}
    ${success ? `<div class="alert success">${htmlEscape(success)}</div>` : ""}
    <form method="POST" action="/profile" class="form-grid form-grid-2col">
      <label>First Name
        <input type="text" name="firstName" value="${v("firstName")}"
               pattern="[A-Za-z ]{1,50}" title="Letters and spaces only (1–50 chars)" required>
      </label>
      <label>Last Name
        <input type="text" name="lastName" value="${v("lastName")}"
               pattern="[A-Za-z ]{1,50}" title="Letters and spaces only (1–50 chars)" required>
      </label>
      <label>National ID (9 digits)
        <input type="text" name="nationalId" value="${v("nationalId")}"
               pattern="\\d{9}" title="Exactly 9 digits" maxlength="9" required>
      </label>
      <label>CVC (3 digits)
        <input type="text" name="cvc" value="${v("cvc")}"
               pattern="\\d{3}" title="Exactly 3 digits" maxlength="3" required>
      </label>
      <label class="span-2">Credit Card Number (XXXX XXXX XXXX XXXX)
        <input type="text" name="cardNumber" value="${v("cardNumber")}"
               pattern="\\d{4} \\d{4} \\d{4} \\d{4}" title="Format: 1234 5678 9012 3456" maxlength="19" required>
      </label>
      <label>Valid Date (MM/YY)
        <input type="text" name="validDate" value="${v("validDate")}"
               pattern="(0[1-9]|1[0-2])/\\d{2}" title="Format MM/YY, e.g. 12/32" maxlength="5" required>
      </label>
      <div class="span-2">
        <button type="submit">Save Card</button>
      </div>
    </form>
  </section>`;
}

function renderAdminPage(session, users = []) {
  const rows = users.map(u => {
    const c = u.card;
    return `<tr>
      <td>${htmlEscape(String(u.id))}</td>
      <td>${htmlEscape(u.username)}</td>
      <td><span class="role-badge-sm ${u.role}">${htmlEscape(u.role)}</span></td>
      <td>${c ? htmlEscape(c.firstName) : "—"}</td>
      <td>${c ? htmlEscape(c.lastName)  : "—"}</td>
      <td>${c ? htmlEscape(c.nationalId) : "—"}</td>
      <td>${c ? htmlEscape(c.cardNumber) : "—"}</td>
      <td>${c ? htmlEscape(c.validDate)  : "—"}</td>
      <td>${c ? htmlEscape(c.cvc)        : "—"}</td>
    </tr>`;
  }).join("\n");

  return `
  <section>
    <div class="card card-wide">
      <h2>Admin Panel</h2>
      <p class="muted">
        Logged in as <strong>${htmlEscape(session.username)}</strong>.
        All users and their unencrypted credit card data are visible here.
        If you reached this page via SQL injection, this demonstrates the full data exposure an attacker gains.
      </p>
      <div class="role-badge">${htmlEscape(session.role.toUpperCase())}</div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Role</th>
            <th>First Name</th>
            <th>Last Name</th>
            <th>National ID</th>
            <th>Card Number</th>
            <th>Valid Date</th>
            <th>CVC</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function renderForbiddenPage() {
  return `
  <section class="card">
    <h2>403 Forbidden</h2>
    <p class="muted">This area is available only to the administrator.</p>
  </section>`;
}

module.exports = {
  renderLayout,
  renderLoginPage,
  renderVulnerableLoginPage,
  renderForgotPasswordPage,
  renderResetLinkPage,
  renderResetPage,
  renderDashboard,
  renderAdminPage,
  renderProfilePage,
  renderForbiddenPage
};

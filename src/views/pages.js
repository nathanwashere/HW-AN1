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
    ? `${session.role === "admin" ? `<a href="/admin">Admin Panel</a>` : ""}<a href="/dashboard">Dashboard</a><a href="/logout">Logout</a>`
    : `<a href="/">Login</a><a href="/forgot-password">Forgot Password</a>`;

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
    <h2>Login</h2>
    <p class="muted">Use your username and password. Passwords are stored only as SHA-256 hashes.</p>
    ${error ? `<div class="alert error">${htmlEscape(error)}</div>` : ""}
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
  </section>`;
}

function renderForgotPasswordPage({ error = "", success = "", resetLink = "" } = {}) {
  return `
  <section class="card">
    <h2>Forgot Password</h2>
    <p class="muted">The old password cannot be restored because the database stores only a SHA-256 hash, not the original plaintext.</p>
    ${error ? `<div class="alert error">${htmlEscape(error)}</div>` : ""}
    ${success ? `<div class="alert success">${htmlEscape(success)}</div>` : ""}
    <form method="POST" action="/forgot-password" class="form-grid">
      <label>Username
        <input type="text" name="username" autocomplete="username" required>
      </label>
      <button type="submit">Create Reset Link</button>
    </form>
    ${
      resetLink
        ? `<div class="reset-box">
            <p>Your reset link is ready:</p>
            <p><a href="${htmlEscape(resetLink)}">${htmlEscape(resetLink)}</a></p>
          </div>`
        : ""
    }
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
  const rolePanel =
    session.role === "admin"
      ? `<div class="panel accent">
          <h3>Admin Access</h3>
          <p>You are the administrator. This role can manage standard users and has elevated access.</p>
        </div>`
      : `<div class="panel">
          <h3>Standard User Access</h3>
          <p>You are logged in as a standard user. Your access is limited compared with the administrator.</p>
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

function renderAdminPage(session) {
  return `
  <section class="hero">
    <div class="card">
      <h2>Admin Control Area</h2>
      <p class="muted">This page is restricted to the administrator only. Standard users cannot access it.</p>
      <div class="role-badge">${htmlEscape(session.role.toUpperCase())}</div>
    </div>
    <div class="panel accent">
      <h3>Access Control Verified</h3>
      <p>The application distinguishes between an admin user and a standard user and enforces different access rights.</p>
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
  renderForgotPasswordPage,
  renderResetLinkPage,
  renderResetPage,
  renderDashboard,
  renderAdminPage,
  renderForbiddenPage
};

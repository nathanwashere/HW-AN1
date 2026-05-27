const http = require("http");
const config = require("./config");
const { parseCookies, getRequestBody, redirect, sendHtml, sendText, sendAsset } = require("./lib/http");
const { hashPassword, signSession, readSession } = require("./lib/security");
const {
  getUserByUsername,
  getUserByCredentialsVulnerable,
  getUserByCredentialsMitigated,
  getAllUsersWithCards,
  getCardByUserId,
  updateCard,
  createResetToken,
  findResetToken,
  markResetTokenUsed,
  updatePassword
} = require("./db/users");
const {
  renderLayout,
  renderLoginPage,
  renderVulnerableLoginPage,
  renderMitigatedLoginPage,
  renderForgotPasswordPage,
  renderResetLinkPage,
  renderResetPage,
  renderDashboard,
  renderAdminPage,
  renderProfilePage,
  renderForbiddenPage
} = require("./views/pages");

const CARD_REGEX = {
  firstName:  /^[A-Za-z ]{1,50}$/,
  lastName:   /^[A-Za-z ]{1,50}$/,
  nationalId: /^\d{9}$/,
  cardNumber: /^\d{4} \d{4} \d{4} \d{4}$/,
  validDate:  /^(0[1-9]|1[0-2])\/\d{2}$/,
  cvc:        /^\d{3}$/
};

function validateCard(data) {
  if (!CARD_REGEX.firstName.test(data.firstName))  return "First name must contain letters only (1–50 characters).";
  if (!CARD_REGEX.lastName.test(data.lastName))    return "Last name must contain letters only (1–50 characters).";
  if (!CARD_REGEX.nationalId.test(data.nationalId)) return "ID must be exactly 9 digits.";
  if (!CARD_REGEX.cardNumber.test(data.cardNumber)) return "Card number must be in format: 1234 5678 9012 3456.";
  if (!CARD_REGEX.validDate.test(data.validDate))   return "Valid date must be in format MM/YY (e.g. 12/32).";
  if (!CARD_REGEX.cvc.test(data.cvc))               return "CVC must be exactly 3 digits.";
  return null;
}

function buildSessionCookie(user) {
  return `${config.sessionCookie}=${signSession(
    { username: user.username, role: user.role },
    config.sessionSecret
  )}; HttpOnly; Path=/; SameSite=Lax`;
}

function buildExpiredSessionCookie() {
  return `${config.sessionCookie}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, config.appHost);
    const cookies = parseCookies(req.headers.cookie);
    const session = readSession(cookies[config.sessionCookie], config.sessionSecret);

    try {
      // ── static ──────────────────────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/public/style.css") {
        return sendAsset(res, config.assets.stylesPath, "text/css");
      }

      // ── home / secure login ──────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/") {
        if (session) return redirect(res, "/dashboard");
        return sendHtml(res, 200, renderLayout("Login", renderLoginPage(), session));
      }

      if (req.method === "POST" && url.pathname === "/login") {
        const body = await getRequestBody(req);
        const username = String(body.username || "").trim();
        const password = String(body.password || "");

        if (!username || !password) {
          return sendHtml(res, 400, renderLayout("Login", renderLoginPage({ error: "Username and password are required." }), session));
        }

        const user = await getUserByUsername(username);
        if (!user || user.passwordHash !== hashPassword(password)) {
          return sendHtml(res, 401, renderLayout("Login", renderLoginPage({ error: "Invalid username or password." }), session));
        }

        return redirect(res, "/dashboard", [buildSessionCookie(user)]);
      }

      // ── vulnerable login (SQL injection demo) ───────────────────────────
      if (req.method === "GET" && url.pathname === "/vulnerable") {
        if (session) return redirect(res, "/dashboard");
        return sendHtml(res, 200, renderLayout("Vulnerable Login", renderVulnerableLoginPage(), session));
      }

      if (req.method === "POST" && url.pathname === "/vulnerable-login") {
        const body = await getRequestBody(req);
        const username = String(body.username || "");
        const password = String(body.password || "");

        let user = null;
        try {
          user = await getUserByCredentialsVulnerable(username, password);
        } catch {
          return sendHtml(res, 400, renderLayout("Vulnerable Login",
            renderVulnerableLoginPage({ error: "SQL error — your injection broke the query syntax. Try again." }),
            session
          ));
        }

        if (!user) {
          return sendHtml(res, 401, renderLayout("Vulnerable Login",
            renderVulnerableLoginPage({ error: "No matching user found." }),
            session
          ));
        }

        return redirect(res, "/dashboard", [buildSessionCookie(user)]);
      }

      // ── mitigated login (SQL injection prevented) ───────────────────────
      if (req.method === "GET" && url.pathname === "/mitigated") {
        if (session) return redirect(res, "/dashboard");
        return sendHtml(res, 200, renderLayout("Mitigated Login", renderMitigatedLoginPage(), session));
      }

      if (req.method === "POST" && url.pathname === "/mitigated-login") {
        const body = await getRequestBody(req);
        const username = String(body.username || "");
        const password = String(body.password || "");

        let user = null;
        try {
          user = await getUserByCredentialsMitigated(username, password);
        } catch {
          return sendHtml(res, 400, renderLayout("Mitigated Login",
            renderMitigatedLoginPage({ error: "SQL error occurred." }),
            session
          ));
        }

        if (!user) {
          return sendHtml(res, 401, renderLayout("Mitigated Login",
            renderMitigatedLoginPage({ error: "No matching user found. Injection attempt was neutralised.", lastUsername: username, lastPassword: password }),
            session
          ));
        }

        return redirect(res, "/dashboard", [buildSessionCookie(user)]);
      }

      // ── dashboard ────────────────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/dashboard") {
        if (!session) return redirect(res, "/");
        return sendHtml(res, 200, renderLayout("Dashboard", renderDashboard(session), session));
      }

      // ── profile (credit card) ────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/profile") {
        if (!session) return redirect(res, "/");
        const user = await getUserByUsername(session.username);
        const card = await getCardByUserId(user.id);
        return sendHtml(res, 200, renderLayout("My Profile", renderProfilePage(card), session));
      }

      if (req.method === "POST" && url.pathname === "/profile") {
        if (!session) return redirect(res, "/");
        const user = await getUserByUsername(session.username);

        const body = await getRequestBody(req);
        const cardData = {
          firstName:  String(body.firstName  || "").trim(),
          lastName:   String(body.lastName   || "").trim(),
          nationalId: String(body.nationalId || "").trim(),
          cardNumber: String(body.cardNumber || "").trim(),
          validDate:  String(body.validDate  || "").trim(),
          cvc:        String(body.cvc        || "").trim()
        };

        const validationError = validateCard(cardData);
        if (validationError) {
          return sendHtml(res, 400, renderLayout("My Profile",
            renderProfilePage(cardData, { error: validationError }),
            session
          ));
        }

        await updateCard(user.id, cardData);
        const updatedCard = await getCardByUserId(user.id);
        return sendHtml(res, 200, renderLayout("My Profile",
          renderProfilePage(updatedCard, { success: "Credit card updated successfully." }),
          session
        ));
      }

      // ── admin panel ──────────────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/admin") {
        if (!session) return redirect(res, "/");
        if (session.role !== "admin") {
          return sendHtml(res, 403, renderLayout("Forbidden", renderForbiddenPage(), session));
        }
        const users = await getAllUsersWithCards();
        return sendHtml(res, 200, renderLayout("Admin Panel", renderAdminPage(session, users), session));
      }

      // ── logout ───────────────────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/logout") {
        return redirect(res, "/", [buildExpiredSessionCookie()]);
      }

      // ── forgot / reset password ──────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/forgot-password") {
        return sendHtml(res, 200, renderLayout("Forgot Password", renderForgotPasswordPage(), session));
      }

      if (req.method === "POST" && url.pathname === "/forgot-password") {
        const body = await getRequestBody(req);
        const username = String(body.username || "").trim();
        const user = await getUserByUsername(username);

        if (!user) {
          return sendHtml(res, 404, renderLayout("Forgot Password",
            renderForgotPasswordPage({ error: "No user was found with that username." }),
            session
          ));
        }

        const token = await createResetToken(user.id);
        const resetLink = `/reset-link?username=${encodeURIComponent(user.username)}&token=${encodeURIComponent(token)}`;
        return redirect(res, resetLink);
      }

      if (req.method === "GET" && url.pathname === "/reset-link") {
        const username = url.searchParams.get("username") || "";
        const token = url.searchParams.get("token") || "";

        if (!username || !token) {
          return sendHtml(res, 400, renderLayout("Reset Link",
            renderForgotPasswordPage({ error: "Missing reset-link information." }),
            session
          ));
        }

        const resetLink = `${config.appHost}/reset-password?token=${encodeURIComponent(token)}`;
        return sendHtml(res, 200, renderLayout("Reset Link", renderResetLinkPage({ username, resetLink }), session));
      }

      if (req.method === "GET" && url.pathname === "/reset-password") {
        const token = url.searchParams.get("token") || "";
        if (!token) {
          return sendHtml(res, 400, renderLayout("Reset Password", renderResetPage({ error: "Missing reset token." }), session));
        }

        const tokenRecord = await findResetToken(token);
        if (!tokenRecord) {
          return sendHtml(res, 400, renderLayout("Reset Password",
            renderResetPage({ error: "This reset link is invalid or expired." }),
            session
          ));
        }

        return sendHtml(res, 200, renderLayout("Reset Password", renderResetPage({ token }), session));
      }

      if (req.method === "POST" && url.pathname === "/reset-password") {
        const body = await getRequestBody(req);
        const token = String(body.token || "");
        const password = String(body.password || "");
        const confirmPassword = String(body.confirmPassword || "");

        if (!token) {
          return sendHtml(res, 400, renderLayout("Reset Password", renderResetPage({ error: "Missing reset token." }), session));
        }

        const tokenRecord = await findResetToken(token);
        if (!tokenRecord) {
          return sendHtml(res, 400, renderLayout("Reset Password",
            renderResetPage({ error: "This reset link is invalid or expired." }),
            session
          ));
        }

        if (password.length < 8) {
          return sendHtml(res, 400, renderLayout("Reset Password",
            renderResetPage({ token, error: "Password must be at least 8 characters long." }),
            session
          ));
        }

        if (password !== confirmPassword) {
          return sendHtml(res, 400, renderLayout("Reset Password",
            renderResetPage({ token, error: "Passwords do not match." }),
            session
          ));
        }

        await updatePassword(tokenRecord.userId, password);
        await markResetTokenUsed(tokenRecord.id);

        return sendHtml(res, 200, renderLayout("Login",
          renderLoginPage({ success: "Password updated. Sign in with the new password." }),
          session
        ));
      }

      return sendText(res, 404, "Not found");
    } catch (error) {
      return sendText(res, 500, `Server error: ${error.message}`);
    }
  });
}

module.exports = { createServer };

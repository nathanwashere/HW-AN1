const http = require("http");
const config = require("./config");
const { parseCookies, getRequestBody, redirect, sendHtml, sendText, sendAsset } = require("./lib/http");
const { hashPassword, signSession, readSession } = require("./lib/security");
const {
  getUserByUsername,
  createResetToken,
  findResetToken,
  markResetTokenUsed,
  updatePassword
} = require("./db/users");
const {
  renderLayout,
  renderLoginPage,
  renderForgotPasswordPage,
  renderResetLinkPage,
  renderResetPage,
  renderDashboard,
  renderAdminPage,
  renderForbiddenPage
} = require("./views/pages");

function buildSessionCookie(user) {
  return `${config.sessionCookie}=${signSession(
    {
      username: user.username,
      role: user.role
    },
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
      if (req.method === "GET" && url.pathname === "/public/style.css") {
        return sendAsset(res, config.assets.stylesPath, "text/css");
      }

      if (req.method === "GET" && url.pathname === "/") {
        if (session) {
          return redirect(res, "/dashboard");
        }

        return sendHtml(res, 200, renderLayout("Login", renderLoginPage(), session));
      }

      if (req.method === "POST" && url.pathname === "/login") {
        const body = await getRequestBody(req);
        const username = String(body.username || "").trim();
        const password = String(body.password || "");

        if (!username || !password) {
          return sendHtml(
            res,
            400,
            renderLayout("Login", renderLoginPage({ error: "Username and password are required." }), session)
          );
        }

        const user = await getUserByUsername(username);
        if (!user || user.passwordHash !== hashPassword(password)) {
          return sendHtml(
            res,
            401,
            renderLayout("Login", renderLoginPage({ error: "Invalid username or password." }), session)
          );
        }

        return redirect(res, "/dashboard", [buildSessionCookie(user)]);
      }

      if (req.method === "GET" && url.pathname === "/dashboard") {
        if (!session) {
          return redirect(res, "/");
        }

        return sendHtml(res, 200, renderLayout("Dashboard", renderDashboard(session), session));
      }

      if (req.method === "GET" && url.pathname === "/admin") {
        if (!session) {
          return redirect(res, "/");
        }

        if (session.role !== "admin") {
          return sendHtml(
            res,
            403,
            renderLayout("Forbidden", renderForbiddenPage(), session)
          );
        }

        return sendHtml(res, 200, renderLayout("Admin Panel", renderAdminPage(session), session));
      }

      if (req.method === "GET" && url.pathname === "/logout") {
        return redirect(res, "/", [buildExpiredSessionCookie()]);
      }

      if (req.method === "GET" && url.pathname === "/forgot-password") {
        return sendHtml(
          res,
          200,
          renderLayout("Forgot Password", renderForgotPasswordPage(), session)
        );
      }

      if (req.method === "POST" && url.pathname === "/forgot-password") {
        const body = await getRequestBody(req);
        const username = String(body.username || "").trim();
        const user = await getUserByUsername(username);

        if (!user) {
          return sendHtml(
            res,
            404,
            renderLayout(
              "Forgot Password",
              renderForgotPasswordPage({ error: "No user was found with that username." }),
              session
            )
          );
        }

        const token = await createResetToken(user.id);
        const resetLink = `/reset-link?username=${encodeURIComponent(user.username)}&token=${encodeURIComponent(token)}`;
        return redirect(res, resetLink);
      }

      if (req.method === "GET" && url.pathname === "/reset-link") {
        const username = url.searchParams.get("username") || "";
        const token = url.searchParams.get("token") || "";

        if (!username || !token) {
          return sendHtml(
            res,
            400,
            renderLayout(
              "Reset Link",
              renderForgotPasswordPage({ error: "Missing reset-link information." }),
              session
            )
          );
        }

        const resetLink = `${config.appHost}/reset-password?token=${encodeURIComponent(token)}`;
        return sendHtml(
          res,
          200,
          renderLayout(
            "Reset Link",
            renderResetLinkPage({ username, resetLink }),
            session
          )
        );
      }

      if (req.method === "GET" && url.pathname === "/reset-password") {
        const token = url.searchParams.get("token") || "";
        if (!token) {
          return sendHtml(
            res,
            400,
            renderLayout("Reset Password", renderResetPage({ error: "Missing reset token." }), session)
          );
        }

        const tokenRecord = await findResetToken(token);
        if (!tokenRecord) {
          return sendHtml(
            res,
            400,
            renderLayout(
              "Reset Password",
              renderResetPage({ error: "This reset link is invalid or expired." }),
              session
            )
          );
        }

        return sendHtml(
          res,
          200,
          renderLayout("Reset Password", renderResetPage({ token }), session)
        );
      }

      if (req.method === "POST" && url.pathname === "/reset-password") {
        const body = await getRequestBody(req);
        const token = String(body.token || "");
        const password = String(body.password || "");
        const confirmPassword = String(body.confirmPassword || "");

        if (!token) {
          return sendHtml(
            res,
            400,
            renderLayout("Reset Password", renderResetPage({ error: "Missing reset token." }), session)
          );
        }

        const tokenRecord = await findResetToken(token);
        if (!tokenRecord) {
          return sendHtml(
            res,
            400,
            renderLayout(
              "Reset Password",
              renderResetPage({ error: "This reset link is invalid or expired." }),
              session
            )
          );
        }

        if (password.length < 8) {
          return sendHtml(
            res,
            400,
            renderLayout(
              "Reset Password",
              renderResetPage({ token, error: "Password must be at least 8 characters long." }),
              session
            )
          );
        }

        if (password !== confirmPassword) {
          return sendHtml(
            res,
            400,
            renderLayout(
              "Reset Password",
              renderResetPage({ token, error: "Passwords do not match." }),
              session
            )
          );
        }

        await updatePassword(tokenRecord.userId, password);
        await markResetTokenUsed(tokenRecord.id);

        return sendHtml(
          res,
          200,
          renderLayout(
            "Login",
            renderLoginPage({ success: "Password updated. Sign in with the new password." }),
            session
          )
        );
      }

      return sendText(res, 404, "Not found");
    } catch (error) {
      return sendText(res, 500, `Server error: ${error.message}`);
    }
  });
}

module.exports = {
  createServer
};

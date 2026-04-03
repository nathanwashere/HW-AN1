const config = require("../config");
const { hashPassword, randomToken } = require("../lib/security");
const { runPsql, loadSchemaSql } = require("./psql");

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

async function initDb() {
  await runPsql(loadSchemaSql());

  const countRows = await runPsql("SELECT COUNT(*) FROM app_users;");
  const userCount = Number(countRows[0]?.[0] || "0");

  if (userCount === 0) {
    await runPsql(`
      INSERT INTO app_users (username, password_hash, role)
      VALUES (
        '${escapeSql(config.defaults.admin.username)}',
        '${hashPassword(config.defaults.admin.password)}',
        'admin'
      );
      INSERT INTO app_users (username, password_hash, role)
      VALUES (
        '${escapeSql(config.defaults.user.username)}',
        '${hashPassword(config.defaults.user.password)}',
        'user'
      );
    `);
  }
}

async function ensureAdminExists() {
  const rows = await runPsql("SELECT COUNT(*) FROM app_users WHERE role = 'admin';");
  if (Number(rows[0]?.[0] || "0") === 0) {
    throw new Error("At least one admin user is required.");
  }
}

async function getUserByUsername(username) {
  const rows = await runPsql(`
    SELECT id, username, password_hash, role
    FROM app_users
    WHERE username = '${escapeSql(username)}'
    LIMIT 1;
  `);

  if (rows.length === 0) {
    return null;
  }

  const [id, foundUsername, passwordHash, role] = rows[0];
  return { id: Number(id), username: foundUsername, passwordHash, role };
}

async function createResetToken(userId) {
  const token = randomToken();
  const tokenHash = hashPassword(token);

  await runPsql(`
    DELETE FROM password_reset_tokens WHERE user_id = ${userId};
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, '${tokenHash}', NOW() + INTERVAL '15 minutes');
  `);

  return token;
}

async function findResetToken(token) {
  const rows = await runPsql(`
    SELECT prt.id, prt.user_id, u.username
    FROM password_reset_tokens prt
    JOIN app_users u ON u.id = prt.user_id
    WHERE prt.token_hash = '${hashPassword(token)}'
      AND prt.used_at IS NULL
      AND prt.expires_at > NOW()
    LIMIT 1;
  `);

  if (rows.length === 0) {
    return null;
  }

  const [id, userId, username] = rows[0];
  return { id: Number(id), userId: Number(userId), username };
}

async function markResetTokenUsed(tokenId) {
  await runPsql(`
    UPDATE password_reset_tokens
    SET used_at = NOW()
    WHERE id = ${tokenId};
  `);
}

async function updatePassword(userId, password) {
  await runPsql(`
    UPDATE app_users
    SET password_hash = '${hashPassword(password)}'
    WHERE id = ${userId};
  `);
}

module.exports = {
  initDb,
  ensureAdminExists,
  getUserByUsername,
  createResetToken,
  findResetToken,
  markResetTokenUsed,
  updatePassword
};

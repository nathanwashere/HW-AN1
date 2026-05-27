const config = require("../config");
const { hashPassword, randomToken } = require("../lib/security");
const { runPsql, loadSchemaSql } = require("./psql");

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

const SEED_USERS = [
  { username: "admin",        password: "Admin123!",  role: "admin" },
  { username: "student",      password: "User12345!", role: "user"  },
  { username: "yael_cohen",   password: "Yael1234!",  role: "user"  },
  { username: "david_levi",   password: "David567!",  role: "user"  },
  { username: "sarah_m",      password: "Sarah890!",  role: "user"  },
  { username: "oren_s",       password: "Oren1234!",  role: "user"  },
  { username: "maya_katz",    password: "Maya5678!",  role: "user"  },
  { username: "noam_bar",     password: "Noam9012!",  role: "user"  },
  { username: "tamar_gold",   password: "Tamar345!",  role: "user"  },
  { username: "itay_saban",   password: "Itay6789!",  role: "user"  }
];

const SEED_CARDS = [
  { username: "admin",      firstName: "Israeli",  lastName: "Israeili",  nationalId: "123456789", cardNumber: "1234 5567 8901 2345", validDate: "12/32", cvc: "123" },
  { username: "student",    firstName: "Yossi",    lastName: "Student",   nationalId: "987654321", cardNumber: "4532 1234 5678 9010", validDate: "08/28", cvc: "456" },
  { username: "yael_cohen", firstName: "Yael",     lastName: "Cohen",     nationalId: "324567891", cardNumber: "5423 1234 5678 9012", validDate: "03/27", cvc: "789" },
  { username: "david_levi", firstName: "David",    lastName: "Levi",      nationalId: "435678912", cardNumber: "4916 1234 5678 9013", validDate: "07/29", cvc: "321" },
  { username: "sarah_m",    firstName: "Sarah",    lastName: "Mizrahi",   nationalId: "546789123", cardNumber: "3714 4567 8901 2345", validDate: "11/26", cvc: "654" },
  { username: "oren_s",     firstName: "Oren",     lastName: "Shapiro",   nationalId: "657891234", cardNumber: "6011 2345 6789 0123", validDate: "05/30", cvc: "987" },
  { username: "maya_katz",  firstName: "Maya",     lastName: "Katz",      nationalId: "768912345", cardNumber: "5105 1234 5678 9016", validDate: "09/27", cvc: "147" },
  { username: "noam_bar",   firstName: "Noam",     lastName: "Bar",       nationalId: "879123456", cardNumber: "4111 1234 5678 9017", validDate: "01/28", cvc: "258" },
  { username: "tamar_gold", firstName: "Tamar",    lastName: "Gold",      nationalId: "912345678", cardNumber: "5500 1234 5678 9018", validDate: "06/31", cvc: "369" },
  { username: "itay_saban", firstName: "Itay",     lastName: "Saban",     nationalId: "198765432", cardNumber: "4012 1234 5678 9019", validDate: "04/29", cvc: "741" }
];

async function initDb() {
  await runPsql(loadSchemaSql());

  await runPsql("TRUNCATE app_users, password_reset_tokens, credit_cards RESTART IDENTITY;");

  const userInserts = SEED_USERS.map(u =>
    `INSERT INTO app_users (username, password_hash, password_plain, role) VALUES ('${escapeSql(u.username)}', '${hashPassword(u.password)}', '${escapeSql(u.password)}', '${u.role}');`
  ).join("\n");
  await runPsql(userInserts);

  const cardInserts = SEED_CARDS.map(c =>
    `INSERT INTO credit_cards (user_id, first_name, last_name, national_id, card_number, valid_date, cvc) SELECT id, '${escapeSql(c.firstName)}', '${escapeSql(c.lastName)}', '${c.nationalId}', '${c.cardNumber}', '${c.validDate}', '${c.cvc}' FROM app_users WHERE username='${escapeSql(c.username)}';`
  ).join("\n");
  await runPsql(cardInserts);
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

  if (rows.length === 0) return null;
  const [id, foundUsername, passwordHash, role] = rows[0];
  return { id: Number(id), username: foundUsername, passwordHash, role };
}

// INTENTIONALLY VULNERABLE: raw input concatenated directly — no escaping, no hashing.
// Used only for the SQL injection demonstration in CW2.
async function getUserByCredentialsVulnerable(username, password) {
  const sql = `SELECT id, username, role FROM app_users WHERE username='${username}' AND password_plain='${password}'`;
  const rows = await runPsql(sql);
  if (rows.length === 0) return null;
  const [id, foundUsername, role] = rows[0];
  return { id: Number(id), username: foundUsername, role };
}

// MITIGATED: single quotes are escaped before being inserted into the SQL string.
// The dangerous character ' becomes '' (two single quotes), which PostgreSQL treats
// as a literal quote character — it can no longer break out of the string boundary.
async function getUserByCredentialsMitigated(username, password) {
  const safeUsername = escapeSql(username);
  const safePassword = escapeSql(password);
  const sql = `SELECT id, username, role FROM app_users WHERE username='${safeUsername}' AND password_plain='${safePassword}'`;
  const rows = await runPsql(sql);
  if (rows.length === 0) return null;
  const [id, foundUsername, role] = rows[0];
  return { id: Number(id), username: foundUsername, role };
}

async function getAllUsersWithCards() {
  const rows = await runPsql(`
    SELECT u.id, u.username, u.role,
           c.first_name, c.last_name, c.national_id, c.card_number, c.valid_date, c.cvc
    FROM app_users u
    LEFT JOIN credit_cards c ON c.user_id = u.id
    ORDER BY u.id;
  `);

  return rows.map(([id, username, role, firstName, lastName, nationalId, cardNumber, validDate, cvc]) => ({
    id: Number(id),
    username,
    role,
    card: firstName ? { firstName, lastName, nationalId, cardNumber, validDate, cvc } : null
  }));
}

async function getCardByUserId(userId) {
  const rows = await runPsql(`
    SELECT first_name, last_name, national_id, card_number, valid_date, cvc
    FROM credit_cards
    WHERE user_id = ${userId}
    LIMIT 1;
  `);
  if (rows.length === 0) return null;
  const [firstName, lastName, nationalId, cardNumber, validDate, cvc] = rows[0];
  return { firstName, lastName, nationalId, cardNumber, validDate, cvc };
}

async function updateCard(userId, { firstName, lastName, nationalId, cardNumber, validDate, cvc }) {
  const e = escapeSql;
  await runPsql(`
    UPDATE credit_cards
    SET first_name='${e(firstName)}', last_name='${e(lastName)}', national_id='${e(nationalId)}',
        card_number='${e(cardNumber)}', valid_date='${e(validDate)}', cvc='${e(cvc)}'
    WHERE user_id=${userId};
  `);
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

  if (rows.length === 0) return null;
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
  getUserByCredentialsVulnerable,
  getUserByCredentialsMitigated,
  getAllUsersWithCards,
  getCardByUserId,
  updateCard,
  createResetToken,
  findResetToken,
  markResetTokenUsed,
  updatePassword
};

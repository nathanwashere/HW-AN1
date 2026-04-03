const crypto = require("crypto");

function hashPassword(password) {
  // utf8 is to convert string into bytes
  return crypto.createHash("sha256").update(password, "utf8").digest("hex");
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function signSession(payload, sessionSecret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", sessionSecret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function readSession(rawCookie, sessionSecret) {
  if (!rawCookie) {
    return null;
  }

  const [encoded, signature] = rawCookie.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", sessionSecret)
    .update(encoded)
    .digest("base64url");

  if (
    Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload || !payload.username || !payload.role) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  hashPassword,
  randomToken,
  signSession,
  readSession
};

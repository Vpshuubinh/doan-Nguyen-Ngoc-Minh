const crypto = require("crypto");

const SESSION_COOKIE_NAME = "chat_session";

function normalizeValue(value) {
  return String(value || "").trim();
}

function hashPassword(password) {
  const normalizedPassword = normalizeValue(password);
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(normalizedPassword, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const normalizedPassword = normalizeValue(password);
  const [salt, storedHash] = String(passwordHash || "").split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const hash = crypto.scryptSync(normalizedPassword, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
}

function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function getSessionTokenFromCookieHeader(cookieHeader = "") {
  const cookies = parseCookies(cookieHeader);
  return cookies[SESSION_COOKIE_NAME] || "";
}

function getSessionFromRequest(req, appState) {
  const token = getSessionTokenFromCookieHeader(req.headers.cookie || "");
  return token ? appState.sessions.get(token) || null : null;
}

function getSessionFromSocket(socket, appState) {
  const token = getSessionTokenFromCookieHeader(socket.handshake.headers.cookie || "");
  return token ? appState.sessions.get(token) || null : null;
}

function createSession(appState, user) {
  const token = crypto.randomBytes(32).toString("hex");

  appState.sessions.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    createdAt: Date.now(),
  });

  return token;
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

function destroySessionsForUser(appState, userId) {
  Array.from(appState.sessions.entries()).forEach(([token, session]) => {
    if (session.userId === userId) {
      appState.sessions.delete(token);
    }
  });
}

module.exports = {
  clearSessionCookie,
  createSession,
  destroySessionsForUser,
  getSessionFromRequest,
  getSessionFromSocket,
  hashPassword,
  normalizeValue,
  parseCookies,
  setSessionCookie,
  verifyPassword,
};

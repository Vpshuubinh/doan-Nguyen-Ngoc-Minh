const express = require("express");

const {
  clearSessionCookie,
  createSession,
  getSessionFromRequest,
  normalizeValue,
  setSessionCookie,
  verifyPassword,
  hashPassword,
} = require("../utils/auth.helpers");

function createAuthRouter(db, appState) {
  const router = express.Router();

  router.post("/register", (req, res) => {
    const username = normalizeValue(req.body.username);
    const fullName = normalizeValue(req.body.fullName);
    const email = normalizeValue(req.body.email).toLowerCase();
    const password = String(req.body.password || "").trim();

    if (!username || !fullName || !email || !password) {
      return res.status(400).json({ error: "Họ và tên, username, email và password là bắt buộc." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password phải có ít nhất 6 ký tự." });
    }

    db.run(
      `
        INSERT INTO users (username, full_name, email, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, 'user', 1)
      `,
      [username, fullName, email, hashPassword(password)],
      function onInsert(err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "Username hoặc email đã tồn tại." });
          }

          return res.status(500).json({ error: "Không thể tạo tài khoản mới." });
        }

        const user = {
          id: this.lastID,
          username,
          full_name: fullName,
          email,
          role: "user",
          is_active: true,
        };

        const token = createSession(appState, user);
        setSessionCookie(res, token);

        return res.status(201).json({
          message: "Đăng ký thành công.",
          user,
        });
      }
    );
  });

  router.post("/login", (req, res) => {
    const login = normalizeValue(req.body.login || req.body.email);
    const password = String(req.body.password || "").trim();

    if (!login || !password) {
      return res.status(400).json({ error: "Thông tin đăng nhập không được để trống." });
    }

    db.get(
      `
        SELECT id, username, full_name, email, password_hash, role, is_active, created_at
        FROM users
        WHERE username = ? OR email = ?
      `,
      [login, login.toLowerCase()],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: "Không thể xử lý đăng nhập." });
        }

        if (!user || !verifyPassword(password, user.password_hash)) {
          return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu." });
        }

        if (!user.is_active) {
          return res.status(403).json({ error: "Tài khoản đã bị khóa." });
        }

        const token = createSession(appState, user);
        setSessionCookie(res, token);

        return res.json({
          message: "Đăng nhập thành công.",
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name || user.username,
            email: user.email,
            role: user.role,
            is_active: Boolean(user.is_active),
            created_at: user.created_at,
          },
        });
      }
    );
  });

  router.post("/logout", (req, res) => {
    const session = getSessionFromRequest(req, appState);

    if (session) {
      Array.from(appState.sessions.entries()).forEach(([token, value]) => {
        if (value.userId === session.userId && value.username === session.username) {
          appState.sessions.delete(token);
        }
      });
    }

    clearSessionCookie(res);
    return res.json({ message: "Đăng xuất thành công." });
  });

  router.get("/me", (req, res) => {
    const session = getSessionFromRequest(req, appState);

    if (!session) {
      return res.json({ user: null });
    }

    return db.get(
      `
        SELECT id, username, full_name, email, role, is_active, created_at
        FROM users
        WHERE id = ?
      `,
      [session.userId],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: "Không thể tải thông tin phiên đăng nhập." });
        }

        if (!user || !user.is_active) {
          clearSessionCookie(res);
          return res.json({ user: null });
        }

        return res.json({
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name || user.username,
            email: user.email,
            role: user.role,
            is_active: Boolean(user.is_active),
            created_at: user.created_at,
          },
        });
      }
    );
  });

  return router;
}

module.exports = createAuthRouter;

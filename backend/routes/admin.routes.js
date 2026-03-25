const express = require("express");

const {
  clearSessionCookie,
  createSession,
  destroySessionsForUser,
  getSessionFromRequest,
  normalizeValue,
  setSessionCookie,
  verifyPassword,
} = require("../utils/auth.helpers");

function getOnlineUsersCount(io, roomId) {
  const members = io.sockets.adapter.rooms.get(roomId);
  return members ? members.size : 0;
}

function rollbackTransaction(db, res, statusCode, message) {
  db.run("ROLLBACK", () => {
    res.status(statusCode).json({ error: message });
  });
}

function normalizeUserRecord(row, appState) {
  const presence = appState.onlineUsers.get(row.id);

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    status: presence ? "online" : "offline",
    current_room: presence?.roomId || null,
  };
}

function disconnectUser(io, appState, userId, message) {
  const presence = appState.onlineUsers.get(userId);

  if (!presence) {
    return;
  }

  Array.from(presence.socketIds).forEach((socketId) => {
    const client = io.sockets.sockets.get(socketId);

    if (!client) {
      return;
    }

    client.emit("force_logout", {
      message: message || "Tài khoản của bạn đã thay đổi trạng thái.",
      redirectTo: "/dang-nhap",
    });
    client.disconnect(true);
  });

  appState.onlineUsers.delete(userId);
}

function notifyRoomDeleted(io, appState, roomId) {
  const roomMembers = io.sockets.adapter.rooms.get(roomId);

  if (!roomMembers) {
    return;
  }

  Array.from(roomMembers).forEach((socketId) => {
    const client = io.sockets.sockets.get(socketId);

    if (!client) {
      return;
    }

    client.leave(roomId);

    if (client.data.roomId === roomId) {
      client.data.roomId = undefined;
      const presence = client.data.userId ? appState.onlineUsers.get(client.data.userId) : null;

      if (presence) {
        presence.roomId = null;
      }

      client.emit("room_deleted", {
        roomId,
        message: `Phòng "${roomId}" đã bị xóa bởi admin.`,
      });
    }
  });
}

function createAdminRouter(db, io, appState) {
  const router = express.Router();

  router.post("/login", (req, res) => {
    const login = normalizeValue(req.body.login || req.body.email || req.body.username);
    const password = String(req.body.password || "").trim();

    if (!login || !password) {
      return res.status(400).json({ error: "Thông tin đăng nhập admin không được để trống." });
    }

    db.get(
      `
        SELECT id, username, email, password_hash, role, is_active, created_at
        FROM users
        WHERE username = ? OR email = ?
      `,
      [login, login.toLowerCase()],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: "Không thể đăng nhập admin." });
        }

        if (!user || !verifyPassword(password, user.password_hash) || user.role !== "admin") {
          return res.status(401).json({ error: "Sai tài khoản admin hoặc mật khẩu." });
        }

        if (!user.is_active) {
          return res.status(403).json({ error: "Tài khoản admin đang bị khóa." });
        }

        const token = createSession(appState, user);
        setSessionCookie(res, token);

        return res.json({
          message: "Đăng nhập admin thành công.",
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
          },
        });
      }
    );
  });

  router.post("/logout", (req, res) => {
    const session = getSessionFromRequest(req, appState);

    if (session) {
      destroySessionsForUser(appState, session.userId);
    }

    clearSessionCookie(res);
    return res.json({ message: "Đăng xuất admin thành công." });
  });

  router.get("/me", (req, res) => {
    const session = getSessionFromRequest(req, appState);

    if (!session) {
      return res.status(401).json({ user: null });
    }

    db.get(
      `
        SELECT id, username, email, role, is_active, created_at
        FROM users
        WHERE id = ?
      `,
      [session.userId],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: "Không thể tải thông tin admin." });
        }

        if (!user || !user.is_active || user.role !== "admin") {
          clearSessionCookie(res);
          return res.status(401).json({ user: null });
        }

        return res.json({
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
          },
        });
      }
    );
  });

  router.use((req, res, next) => {
    const session = getSessionFromRequest(req, appState);

    if (!session) {
      return res.status(401).json({ error: "Admin chưa đăng nhập." });
    }

    return db.get(
      `
        SELECT id, username, email, role, is_active, created_at
        FROM users
        WHERE id = ?
      `,
      [session.userId],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: "Không thể kiểm tra phiên admin." });
        }

        if (!user || !user.is_active || user.role !== "admin") {
          clearSessionCookie(res);
          return res.status(401).json({ error: "Phiên admin không hợp lệ." });
        }

        req.adminUser = user;
        return next();
      }
    );
  });

  router.get("/rooms", (req, res) => {
    const query = `
      SELECT
        rooms.id,
        rooms.room_name,
        rooms.created_by,
        rooms.created_at,
        COUNT(messages.id) AS total_messages
      FROM rooms
      LEFT JOIN messages ON messages.room_id = rooms.id
      GROUP BY rooms.id, rooms.room_name, rooms.created_by, rooms.created_at
      ORDER BY rooms.created_at DESC, rooms.room_name COLLATE NOCASE ASC
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Không thể tải danh sách phòng admin." });
      }

      const rooms = rows.map((row) => ({
        id: row.id,
        room_name: row.room_name,
        created_by: row.created_by,
        created_at: row.created_at,
        total_messages: Number(row.total_messages || 0),
        online_users: getOnlineUsersCount(io, row.id),
      }));

      const stats = rooms.reduce(
        (summary, room) => {
          summary.totalRooms += 1;
          summary.totalMessages += room.total_messages;
          summary.totalOnlineUsers += room.online_users;
          return summary;
        },
        {
          totalRooms: 0,
          totalMessages: 0,
          totalOnlineUsers: 0,
        }
      );

      return res.json({ stats, rooms });
    });
  });

  router.post("/rooms", (req, res) => {
    const roomName = normalizeValue(req.body.roomName);
    const createdBy = normalizeValue(req.body.createdBy) || req.adminUser.username;

    if (!roomName) {
      return res.status(400).json({ error: "Tên phòng không được để trống." });
    }

    db.run(
      `
        INSERT INTO rooms (id, room_name, created_by)
        VALUES (?, ?, ?)
      `,
      [roomName, roomName, createdBy],
      function onInsert(err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "Phòng này đã tồn tại." });
          }

          return res.status(500).json({ error: "Không thể tạo phòng mới." });
        }

        return db.get(
          `
            SELECT id, room_name, created_by, created_at
            FROM rooms
            WHERE id = ?
          `,
          [roomName],
          (selectErr, room) => {
            if (selectErr) {
              return res.status(500).json({ error: "Đã tạo phòng nhưng không thể tải lại dữ liệu." });
            }

            return res.status(201).json({
              message: "Tạo phòng thành công.",
              room,
            });
          }
        );
      }
    );
  });

  router.delete("/rooms/:id", (req, res) => {
    const roomId = normalizeValue(req.params.id);

    if (!roomId) {
      return res.status(400).json({ error: "Mã phòng không hợp lệ." });
    }

    db.serialize(() => {
      db.run("BEGIN TRANSACTION", (beginErr) => {
        if (beginErr) {
          return res.status(500).json({ error: "Không thể bắt đầu xóa phòng." });
        }

        db.run("DELETE FROM messages WHERE room_id = ?", [roomId], function onDeleteMessages(messageErr) {
          if (messageErr) {
            return rollbackTransaction(db, res, 500, "Không thể xóa tin nhắn trong phòng.");
          }

          const deletedMessages = this.changes;

          db.run("DELETE FROM rooms WHERE id = ?", [roomId], function onDeleteRoom(roomErr) {
            if (roomErr) {
              return rollbackTransaction(db, res, 500, "Không thể xóa phòng.");
            }

            if (this.changes === 0) {
              return rollbackTransaction(db, res, 404, "Phòng không tồn tại.");
            }

            db.run("COMMIT", (commitErr) => {
              if (commitErr) {
                return rollbackTransaction(db, res, 500, "Không thể hoàn tất xóa phòng.");
              }

              notifyRoomDeleted(io, appState, roomId);

              return res.json({
                message: "Xóa phòng thành công.",
                deletedRoomId: roomId,
                deletedMessages,
              });
            });
          });
        });
      });
    });
  });

  router.get("/users", (req, res) => {
    db.all(
      `
        SELECT id, username, email, role, is_active, created_at
        FROM users
        ORDER BY created_at DESC, username COLLATE NOCASE ASC
      `,
      [],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: "Không thể tải danh sách user." });
        }

        const users = rows.map((row) => normalizeUserRecord(row, appState));
        const stats = users.reduce(
          (summary, user) => {
            summary.totalUsers += 1;
            summary.activeUsers += user.is_active ? 1 : 0;
            summary.onlineUsers += user.status === "online" ? 1 : 0;
            return summary;
          },
          {
            totalUsers: 0,
            activeUsers: 0,
            onlineUsers: 0,
          }
        );

        return res.json({ stats, users });
      }
    );
  });

  router.patch("/users/:id/status", (req, res) => {
    const targetUserId = Number(req.params.id);
    const isActive = Boolean(req.body.isActive);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "User id không hợp lệ." });
    }

    db.get(
      `
        SELECT id, username, email, role, is_active, created_at
        FROM users
        WHERE id = ?
      `,
      [targetUserId],
      (findErr, user) => {
        if (findErr) {
          return res.status(500).json({ error: "Không thể tìm user." });
        }

        if (!user) {
          return res.status(404).json({ error: "User không tồn tại." });
        }

        if (user.role === "admin") {
          return res.status(400).json({ error: "Không thể khóa/mở khóa tài khoản admin." });
        }

        db.run(
          "UPDATE users SET is_active = ? WHERE id = ?",
          [isActive ? 1 : 0, targetUserId],
          (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ error: "Không thể cập nhật trạng thái user." });
            }

            if (!isActive) {
              destroySessionsForUser(appState, targetUserId);
              disconnectUser(io, appState, targetUserId, "Tài khoản của bạn đã bị khóa.");
            }

            return db.get(
              `
                SELECT id, username, email, role, is_active, created_at
                FROM users
                WHERE id = ?
              `,
              [targetUserId],
              (reloadErr, updatedUser) => {
                if (reloadErr) {
                  return res.status(500).json({ error: "Đã cập nhật nhưng không thể tải lại user." });
                }

                return res.json({
                  message: isActive ? "Đã mở khóa user." : "Đã khóa user.",
                  user: normalizeUserRecord(updatedUser, appState),
                });
              }
            );
          }
        );
      }
    );
  });

  router.patch("/users/:id/role", (req, res) => {
    const targetUserId = Number(req.params.id);
    const nextRole = normalizeValue(req.body.role).toLowerCase();

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "User id không hợp lệ." });
    }

    if (!["admin", "user"].includes(nextRole)) {
      return res.status(400).json({ error: "Role không hợp lệ." });
    }

    db.get(
      `
        SELECT id, username, email, role, is_active, created_at
        FROM users
        WHERE id = ?
      `,
      [targetUserId],
      (findErr, user) => {
        if (findErr) {
          return res.status(500).json({ error: "Không thể tìm user." });
        }

        if (!user) {
          return res.status(404).json({ error: "User không tồn tại." });
        }

        if (user.id === req.adminUser.id && nextRole !== "admin") {
          return res.status(400).json({ error: "Không thể tự đổi tài khoản admin hiện tại thành user." });
        }

        if (user.role === nextRole) {
          return res.json({
            message: "Role không thay đổi.",
            user: normalizeUserRecord(user, appState),
          });
        }

        db.run(
          "UPDATE users SET role = ? WHERE id = ?",
          [nextRole, targetUserId],
          (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ error: "Không thể cập nhật role user." });
            }

            return db.get(
              `
                SELECT id, username, email, role, is_active, created_at
                FROM users
                WHERE id = ?
              `,
              [targetUserId],
              (reloadErr, updatedUser) => {
                if (reloadErr) {
                  return res.status(500).json({ error: "Đã cập nhật nhưng không thể tải lại user." });
                }

                return res.json({
                  message: nextRole === "admin" ? "Đã cập nhật user thành admin." : "Đã cập nhật admin thành user.",
                  user: normalizeUserRecord(updatedUser, appState),
                });
              }
            );
          }
        );
      }
    );
  });

  router.delete("/users/:id", (req, res) => {
    const targetUserId = Number(req.params.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "User id không hợp lệ." });
    }

    if (targetUserId === req.adminUser.id) {
      return res.status(400).json({ error: "Không thể xóa chính tài khoản admin đang đăng nhập." });
    }

    db.get(
      `
        SELECT id, username, role
        FROM users
        WHERE id = ?
      `,
      [targetUserId],
      (findErr, user) => {
        if (findErr) {
          return res.status(500).json({ error: "Không thể tìm user cần xóa." });
        }

        if (!user) {
          return res.status(404).json({ error: "User không tồn tại." });
        }

        if (user.role === "admin") {
          return res.status(400).json({ error: "Không thể xóa tài khoản admin." });
        }

        db.run("DELETE FROM users WHERE id = ?", [targetUserId], function onDelete(deleteErr) {
          if (deleteErr) {
            return res.status(500).json({ error: "Không thể xóa user." });
          }

          destroySessionsForUser(appState, targetUserId);
          disconnectUser(io, appState, targetUserId, "Tài khoản của bạn đã bị xóa.");

          return res.json({
            message: "Xóa user thành công.",
            deletedUserId: targetUserId,
          });
        });
      }
    );
  });

  return router;
}

module.exports = createAdminRouter;

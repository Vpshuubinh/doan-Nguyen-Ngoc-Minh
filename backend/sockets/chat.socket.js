const { getSessionFromSocket, normalizeValue } = require("../utils/auth.helpers");

function findRoomById(db, roomId, callback) {
  db.get("SELECT id, room_name FROM rooms WHERE id = ?", [roomId], callback);
}

function findActiveUserById(db, userId, callback) {
  db.get(
    `
      SELECT id, username, full_name, role, is_active
      FROM users
      WHERE id = ?
    `,
    [userId],
    callback
  );
}

function getDisplayName(user) {
  return user.full_name || user.username;
}

function updatePresence(appState, userId, socketId, username, roomId) {
  const currentPresence = appState.onlineUsers.get(userId);

  if (!currentPresence) {
    appState.onlineUsers.set(userId, {
      username,
      roomId: roomId || null,
      socketIds: new Set([socketId]),
    });
    return;
  }

  currentPresence.username = username;
  currentPresence.socketIds.add(socketId);
  currentPresence.roomId = roomId || currentPresence.roomId || null;
}

function clearPresence(appState, userId, socketId) {
  const presence = appState.onlineUsers.get(userId);

  if (!presence) {
    return;
  }

  presence.socketIds.delete(socketId);

  if (presence.socketIds.size === 0) {
    appState.onlineUsers.delete(userId);
  } else {
    presence.roomId = null;
  }
}

function leaveCurrentRoom(socket, appState) {
  const roomId = socket.data.roomId;
  const username = socket.data.username;
  const userId = socket.data.userId;

  if (!roomId || !username) {
    return;
  }

  socket.leave(roomId);
  socket.to(roomId).emit("system_message", {
    message: `${username} da roi cuoc chat.`,
  });
  socket.data.roomId = undefined;

  if (userId) {
    const presence = appState.onlineUsers.get(userId);

    if (presence) {
      presence.roomId = null;
    }
  }
}

function registerChatSocket(io, db, appState) {
  io.on("connection", (socket) => {
    socket.on("join_room", ({ roomId }, callback = () => {}) => {
      const session = getSessionFromSocket(socket, appState);
      const normalizedRoomId = normalizeValue(roomId);

      if (!session) {
        callback({
          ok: false,
          error: "Ban can dang nhap truoc khi vao chat.",
        });
        return;
      }

      if (!normalizedRoomId) {
        callback({
          ok: false,
          error: "Vui long nhap ma phong.",
        });
        return;
      }

      findActiveUserById(db, session.userId, (userErr, user) => {
        if (userErr) {
          callback({
            ok: false,
            error: "Khong the kiem tra user hien tai.",
          });
          return;
        }

        if (!user || !user.is_active) {
          callback({
            ok: false,
            error: "Tai khoan khong hop le hoac da bi khoa.",
          });
          return;
        }

        findRoomById(db, normalizedRoomId, (roomErr, room) => {
          if (roomErr) {
            callback({
              ok: false,
              error: "Khong the kiem tra thong tin phong.",
            });
            return;
          }

          if (!room) {
            callback({
              ok: false,
              error: "Phong khong ton tai. Hay chon phong duoc admin tao truoc.",
            });
            return;
          }

          if (socket.data.roomId && socket.data.roomId !== normalizedRoomId) {
            leaveCurrentRoom(socket, appState);
          }

          socket.join(normalizedRoomId);
          socket.data.roomId = normalizedRoomId;
          socket.data.userId = user.id;
          socket.data.username = getDisplayName(user);

          updatePresence(appState, user.id, socket.id, getDisplayName(user), normalizedRoomId);

          socket.to(normalizedRoomId).emit("system_message", {
            message: `${getDisplayName(user)} da tham gia cuoc chat.`,
          });

          callback({
            ok: true,
            room,
            user: {
              id: user.id,
              username: user.username,
              full_name: getDisplayName(user),
            },
          });
        });
      });
    });

    socket.on("send_message", ({ roomId, content }) => {
      const session = getSessionFromSocket(socket, appState);
      const normalizedRoomId = normalizeValue(roomId);
      const normalizedContent = String(content || "").trim();

      if (!session || !normalizedRoomId || !normalizedContent) {
        return;
      }

      if (socket.data.roomId !== normalizedRoomId || !socket.data.userId) {
        socket.emit("system_message", {
          message: "Phien chat khong hop le. Hay vao phong lai.",
        });
        return;
      }

      findActiveUserById(db, session.userId, (userErr, user) => {
        if (userErr || !user || !user.is_active) {
          socket.emit("system_message", {
            message: "Tai khoan khong hop le hoac da bi khoa.",
          });
          return;
        }

        findRoomById(db, normalizedRoomId, (findErr, room) => {
          if (findErr || !room) {
            socket.emit("system_message", {
              message: "Phong chat khong ton tai hoac da bi xoa.",
            });
            return;
          }

          db.run(
            "INSERT INTO messages (room_id, sender, content) VALUES (?, ?, ?)",
            [normalizedRoomId, getDisplayName(user), normalizedContent],
            function onInsert(insertErr) {
              if (insertErr) {
                socket.emit("system_message", { message: "Khong the luu tin nhan." });
                return;
              }

              io.to(normalizedRoomId).emit("receive_message", {
                id: this.lastID,
                room_id: normalizedRoomId,
                sender: getDisplayName(user),
                content: normalizedContent,
                created_at: new Date().toISOString(),
              });
            }
          );
        });
      });
    });

    socket.on("leave_room", () => {
      leaveCurrentRoom(socket, appState);
      if (socket.data.userId) {
        clearPresence(appState, socket.data.userId, socket.id);
      }
    });

    socket.on("disconnect", () => {
      leaveCurrentRoom(socket, appState);
      if (socket.data.userId) {
        clearPresence(appState, socket.data.userId, socket.id);
      }
    });
  });
}

module.exports = registerChatSocket;

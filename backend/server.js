const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();

const createAdminRouter = require("./routes/admin.routes");
const createAuthRouter = require("./routes/auth.routes");
const createMessagesRouter = require("./routes/messages.routes");
const createRoomsRouter = require("./routes/rooms.routes");
const registerChatSocket = require("./sockets/chat.socket");
const {
  clearSessionCookie,
  createSession,
  getSessionFromRequest,
  hashPassword,
  setSessionCookie,
} = require("./utils/auth.helpers");

const DEFAULT_ADMIN = {
  username: "admin",
  full_name: "Quan tri vien",
  email: "admin@chatrealtime.local",
  password: "Admin@12345",
};

const DEFAULT_DEMO_USER = {
  username: "demo_user",
  full_name: "Nguoi dung Demo",
  email: "demo@chatrealtime.local",
  password: "Demo@12345",
};

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const appState = {
  sessions: new Map(),
  onlineUsers: new Map(),
};

const PORT = process.env.PORT || 3008;
const dbPath = path.join(__dirname, "database", "database.db");
const publicPath = path.join(__dirname, "..", "frontend", "public");
const assetsPath = path.join(__dirname, "..", "frontend", "assets");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("SQLite connection error:", err.message);
  } else {
    console.log("SQLite connected:", dbPath);
  }
});

function loadSessionUser(req, res, callback) {
  const session = getSessionFromRequest(req, appState);

  if (!session) {
    callback(null, null);
    return;
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
        callback(err);
        return;
      }

      if (!user || !user.is_active) {
        clearSessionCookie(res);
        callback(null, null);
        return;
      }

      callback(null, user);
    }
  );
}

function requirePageAuth(options = {}) {
  const { role, redirectTo } = options;

  return (req, res, next) => {
    loadSessionUser(req, res, (err, user) => {
      if (err) {
        res.status(500).send("Cannot validate session.");
        return;
      }

      if (!user || (role && user.role !== role)) {
        clearSessionCookie(res);
        res.redirect(redirectTo);
        return;
      }

      req.sessionUser = user;
      next();
    });
  };
}

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error("Create users table error:", err.message);
      }
    }
  );

  db.all("PRAGMA table_info(users)", [], (pragmaErr, columns) => {
    if (pragmaErr) {
      console.error("Users table pragma error:", pragmaErr.message);
      return;
    }

    const hasFullName = columns.some((column) => column.name === "full_name");
    if (!hasFullName) {
      db.run("ALTER TABLE users ADD COLUMN full_name TEXT", (alterErr) => {
        if (alterErr) {
          console.error("Add full_name column error:", alterErr.message);
        }
      });
    }
  });

  db.run(
    `CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      room_name TEXT NOT NULL UNIQUE,
      created_by TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error("Create rooms table error:", err.message);
      }
    }
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err) {
        console.error("Create messages table error:", err.message);
      }
    }
  );

  db.run(
    `INSERT INTO rooms (id, room_name, created_by)
     SELECT DISTINCT messages.room_id, messages.room_id, 'legacy-import'
     FROM messages
     WHERE TRIM(messages.room_id) <> ''
       AND NOT EXISTS (
         SELECT 1
         FROM rooms
         WHERE rooms.id = messages.room_id
       )`,
    (err) => {
      if (err) {
        console.error("Legacy room sync error:", err.message);
      }
    }
  );

  db.run(
    `INSERT INTO rooms (id, room_name, created_by)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    ["room-2-users", "room-2-users", "system"],
    (err) => {
      if (err) {
        console.error("Default room seed error:", err.message);
      }
    }
  );

  db.run(
    `INSERT INTO users (username, full_name, email, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, 'admin', 1)
     ON CONFLICT(username) DO UPDATE SET
       full_name = COALESCE(users.full_name, excluded.full_name)`,
    [
      DEFAULT_ADMIN.username,
      DEFAULT_ADMIN.full_name,
      DEFAULT_ADMIN.email,
      hashPassword(DEFAULT_ADMIN.password),
    ],
    (err) => {
      if (err) {
        console.error("Default admin seed error:", err.message);
      }
    }
  );

  db.run(
    `INSERT INTO users (username, full_name, email, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, 'user', 1)
     ON CONFLICT(username) DO UPDATE SET
       full_name = COALESCE(users.full_name, excluded.full_name)`,
    [
      DEFAULT_DEMO_USER.username,
      DEFAULT_DEMO_USER.full_name,
      DEFAULT_DEMO_USER.email,
      hashPassword(DEFAULT_DEMO_USER.password),
    ],
    (err) => {
      if (err) {
        console.error("Default demo user seed error:", err.message);
      }
    }
  );
});

app.use(express.json());
app.use(express.static(publicPath, { index: false }));
app.use("/assets", express.static(assetsPath));
app.use("/auth", createAuthRouter(db, appState));
app.use("/rooms", createRoomsRouter(db));
app.use("/messages", createMessagesRouter(db));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "home.html"));
});

app.get("/gioi-thieu", (req, res) => {
  res.sendFile(path.join(publicPath, "gioi-thieu.html"));
});

app.get("/tinh-nang", (req, res) => {
  res.sendFile(path.join(publicPath, "tinh-nang.html"));
});

app.get(
  "/chat",
  requirePageAuth({ redirectTo: "/dang-nhap?redirect=%2Fchat" }),
  (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  }
);

app.get("/dang-nhap", (req, res) => {
  res.sendFile(path.join(publicPath, "login.html"));
});

app.get("/dang-ky", (req, res) => {
  res.sendFile(path.join(publicPath, "register.html"));
});

app.get("/demo-chat", (req, res) => {
  db.get(
    `
      SELECT id, username, full_name, email, role, is_active, created_at
      FROM users
      WHERE username = ?
    `,
    [DEFAULT_DEMO_USER.username],
    (err, user) => {
      if (err || !user || !user.is_active) {
        res.redirect("/dang-nhap?message=Khong the vao che do demo");
        return;
      }

      const token = createSession(appState, user);
      setSessionCookie(res, token);
      res.redirect("/chat");
    }
  );
});

app.get("/admin/login", (req, res) => {
  loadSessionUser(req, res, (err, user) => {
    if (err) {
      res.status(500).send("Cannot validate admin session.");
      return;
    }

    if (user && user.role === "admin") {
      res.redirect("/admin/dashboard");
      return;
    }

    res.sendFile(path.join(publicPath, "admin-login.html"));
  });
});

app.get(
  "/admin/dashboard",
  requirePageAuth({ role: "admin", redirectTo: "/admin/login" }),
  (req, res) => {
    res.sendFile(path.join(publicPath, "admin-dashboard.html"));
  }
);

app.get(
  "/admin/rooms-page",
  requirePageAuth({ role: "admin", redirectTo: "/admin/login" }),
  (req, res) => {
    res.sendFile(path.join(publicPath, "admin-rooms.html"));
  }
);

app.get(
  "/admin/users-page",
  requirePageAuth({ role: "admin", redirectTo: "/admin/login" }),
  (req, res) => {
    res.sendFile(path.join(publicPath, "admin-users.html"));
  }
);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/admin", createAdminRouter(db, io, appState));

registerChatSocket(io, db, appState);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

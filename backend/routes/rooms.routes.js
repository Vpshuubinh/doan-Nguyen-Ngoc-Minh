const express = require("express");

function createRoomsRouter(db) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const query = `
      SELECT id, room_name, created_at
      FROM rooms
      ORDER BY created_at DESC, room_name COLLATE NOCASE ASC
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Khong the tai danh sach phong." });
      }

      return res.json({ rooms: rows });
    });
  });

  return router;
}

module.exports = createRoomsRouter;

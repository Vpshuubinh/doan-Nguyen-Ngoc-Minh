const express = require("express");

function createMessagesRouter(db) {
  const router = express.Router();

  router.get("/:roomId", (req, res) => {
    const { roomId } = req.params;

    const query = `
      SELECT id, room_id, sender, content, created_at
      FROM messages
      WHERE room_id = ?
      ORDER BY id ASC
    `;

    db.all(query, [roomId], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Không thể tải lịch sử tin nhắn." });
      }

      return res.json(rows);
    });
  });

  return router;
}

module.exports = createMessagesRouter;

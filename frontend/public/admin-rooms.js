const adminIdentity = document.getElementById("adminIdentity");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const roomForm = document.getElementById("roomForm");
const roomNameInput = document.getElementById("roomNameInput");
const roomNotice = document.getElementById("roomNotice");
const refreshRoomsBtn = document.getElementById("refreshRoomsBtn");
const roomsTableBody = document.getElementById("roomsTableBody");

function sanitize(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}

function showNotice(message, type) {
  roomNotice.textContent = message;
  roomNotice.className = `admin-notice ${type}`;
}

function hideNotice() {
  roomNotice.className = "admin-notice hidden";
  roomNotice.textContent = "";
}

function renderRooms(rooms) {
  if (!rooms.length) {
    roomsTableBody.innerHTML = `<tr><td colspan="6" class="admin-empty">Chưa có phòng nào. Hãy tạo phòng đầu tiên.</td></tr>`;
    return;
  }

  roomsTableBody.innerHTML = rooms.map((room, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${sanitize(room.room_name)}</strong><span>Mã phòng: ${sanitize(room.id)}</span></td>
      <td>${room.online_users}</td>
      <td>${room.total_messages}</td>
      <td>${sanitize(formatDate(room.created_at))}</td>
      <td><div class="admin-table-actions"><button type="button" class="ghost-btn danger-btn" data-delete-room="${encodeURIComponent(room.id)}">Xóa</button></div></td>
    </tr>
  `).join("");
}

async function fetchAdminMe() {
  const res = await fetch("/admin/me");
  const payload = await res.json();

  if (!res.ok || !payload.user) {
    window.location.href = "/admin/login";
    return null;
  }

  adminIdentity.textContent = `Đăng nhập với ${payload.user.username} (${payload.user.email})`;
  return payload.user;
}

async function loadRooms() {
  roomsTableBody.innerHTML = `<tr><td colspan="6" class="admin-empty">Đang tải danh sách phòng...</td></tr>`;

  try {
    const res = await fetch("/admin/rooms");
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || "Không thể tải danh sách phòng.");
    }

    renderRooms(payload.rooms || []);
  } catch (error) {
    roomsTableBody.innerHTML = `<tr><td colspan="6" class="admin-empty">${sanitize(error.message)}</td></tr>`;
    showNotice(error.message, "error");
  }
}

async function createRoom(event) {
  event.preventDefault();

  const roomName = roomNameInput.value.trim();
  if (!roomName) {
    showNotice("Hãy nhập tên phòng trước khi tạo.", "error");
    return;
  }

  try {
    const res = await fetch("/admin/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName }),
    });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || "Không thể tạo phòng.");
    }

    roomNameInput.value = "";
    showNotice(payload.message || "Tạo phòng thành công.", "success");
    await loadRooms();
  } catch (error) {
    showNotice(error.message, "error");
  }
}

async function deleteRoom(roomId) {
  if (!window.confirm(`Bạn chắc chắn muốn xóa phòng "${roomId}"? Toàn bộ tin nhắn trong phòng cũng sẽ bị xóa.`)) {
    return;
  }

  try {
    const res = await fetch(`/admin/rooms/${encodeURIComponent(roomId)}`, {
      method: "DELETE",
    });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || "Không thể xóa phòng.");
    }

    showNotice(`${payload.message} Đã xóa ${payload.deletedMessages || 0} tin nhắn.`, "success");
    await loadRooms();
  } catch (error) {
    showNotice(error.message, "error");
  }
}

roomForm.addEventListener("submit", createRoom);

refreshRoomsBtn.addEventListener("click", async () => {
  hideNotice();
  await loadRooms();
});

roomsTableBody.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-room]");
  if (!deleteButton) return;

  const roomId = decodeURIComponent(deleteButton.dataset.deleteRoom || "");
  if (roomId) {
    await deleteRoom(roomId);
  }
});

adminLogoutBtn.addEventListener("click", async () => {
  await fetch("/admin/logout", { method: "POST" });
  window.location.href = "/admin/login";
});

async function bootstrap() {
  const adminUser = await fetchAdminMe();
  if (!adminUser) return;
  await loadRooms();
}

bootstrap();

const adminIdentity = document.getElementById("adminIdentity");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

const totalRooms = document.getElementById("totalRooms");
const totalUsers = document.getElementById("totalUsers");
const totalOnlineUsers = document.getElementById("totalOnlineUsers");
const totalActiveUsers = document.getElementById("totalActiveUsers");
const totalMessages = document.getElementById("totalMessages");

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

async function loadSummary() {
  const [roomsRes, usersRes] = await Promise.all([
    fetch("/admin/rooms"),
    fetch("/admin/users"),
  ]);

  const roomsPayload = await roomsRes.json();
  const usersPayload = await usersRes.json();

  if (!roomsRes.ok) {
    throw new Error(roomsPayload.error || "Không thể tải thống kê phòng.");
  }

  if (!usersRes.ok) {
    throw new Error(usersPayload.error || "Không thể tải thống kê user.");
  }

  totalRooms.textContent = roomsPayload.stats?.totalRooms || 0;
  totalMessages.textContent = roomsPayload.stats?.totalMessages || 0;
  totalUsers.textContent = usersPayload.stats?.totalUsers || 0;
  totalOnlineUsers.textContent = usersPayload.stats?.onlineUsers || 0;
  totalActiveUsers.textContent = usersPayload.stats?.activeUsers || 0;
}

adminLogoutBtn.addEventListener("click", async () => {
  await fetch("/admin/logout", { method: "POST" });
  window.location.href = "/admin/login";
});

async function bootstrap() {
  const adminUser = await fetchAdminMe();
  if (!adminUser) return;
  await loadSummary();
}

bootstrap();

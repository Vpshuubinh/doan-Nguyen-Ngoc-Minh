const socket = io();

const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");
const accountName = document.getElementById("accountName");
const accountLogoutBtn = document.getElementById("accountLogoutBtn");
const adminDashboardBtn = document.getElementById("adminDashboardBtn");

const roomInput = document.getElementById("roomInput");
const roomsList = document.getElementById("roomsList");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

const roomLabel = document.getElementById("roomLabel");
const currentUser = document.getElementById("currentUser");
const logoutBtn = document.getElementById("logoutBtn");

const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

let authUser = null;
let roomId = "";

function getDisplayName(user) {
  return user?.full_name || user?.username || "";
}

function sanitize(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function appendMessage({ sender, content, created_at, type = "other" }) {
  const item = document.createElement("div");
  item.className = `message-item ${type}`;

  if (type === "system") {
    item.innerHTML = `<span>${sanitize(content)}</span>`;
  } else {
    const time = created_at
      ? new Date(created_at).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    item.innerHTML = `
      <span class="meta">${sanitize(sender)} - ${time}</span>
      <span>${sanitize(content)}</span>
    `;
  }

  messagesEl.appendChild(item);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadCurrentUser() {
  const res = await fetch("/auth/me");
  const payload = await res.json();

  if (!payload.user) {
    window.location.href = "/dang-nhap?redirect=%2Fchat";
    return false;
  }

  authUser = payload.user;
  accountName.textContent = getDisplayName(authUser);
  currentUser.textContent = getDisplayName(authUser);
  adminDashboardBtn.classList.toggle("hidden", authUser.role !== "admin");
  return true;
}

async function loadRooms() {
  try {
    const res = await fetch("/rooms");
    if (!res.ok) throw new Error("Không thể tải danh sách phòng.");

    const payload = await res.json();
    const rooms = payload.rooms || [];

    roomsList.innerHTML = "";

    rooms.forEach((room) => {
      const option = document.createElement("option");
      option.value = room.id;
      option.label = room.room_name;
      roomsList.appendChild(option);
    });

    if (!roomInput.value && rooms.length > 0) {
      roomInput.value = rooms[0].id;
    }
  } catch (error) {
    loginError.textContent = "Không tải được danh sách phòng.";
  }
}

async function loadHistory(room) {
  messagesEl.innerHTML = "";

  try {
    const res = await fetch(`/messages/${encodeURIComponent(room)}`);
    if (!res.ok) throw new Error("Không thể tải lịch sử chat.");

    const data = await res.json();
    data.forEach((msg) => {
      appendMessage({
        sender: msg.sender,
        content: msg.content,
        created_at: msg.created_at,
        type: msg.sender === getDisplayName(authUser) ? "mine" : "other",
      });
    });
  } catch (error) {
    appendMessage({
      content: "Không tải được lịch sử tin nhắn.",
      type: "system",
    });
  }
}

function joinChat() {
  const roomValue = roomInput.value.trim();

  if (!roomValue) {
    loginError.textContent = "Vui lòng nhập mã phòng.";
    return;
  }

  loginError.textContent = "";

  socket.emit("join_room", { roomId: roomValue }, async (response) => {
    if (!response || !response.ok) {
      loginError.textContent = response?.error || "Không thể vào phòng chat.";
      return;
    }

    roomId = response.room.id;
    roomLabel.textContent = response.room.room_name || roomId;
    currentUser.textContent = response.user?.full_name || response.user?.username || getDisplayName(authUser);

    loginScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");

    await loadHistory(roomId);
    messageInput.focus();
  });
}

function logoutChat({ notifyServer = true, notice = "" } = {}) {
  if (notifyServer && roomId) {
    socket.emit("leave_room");
  }

  roomId = "";
  messagesEl.innerHTML = "";
  messageInput.value = "";

  chatScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  loginError.textContent = notice;
}

async function logoutAccount(redirectTo = "/dang-nhap") {
  try {
    await fetch("/auth/logout", { method: "POST" });
  } finally {
    window.location.href = redirectTo;
  }
}

loginBtn.addEventListener("click", joinChat);

roomInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinChat();
});

logoutBtn.addEventListener("click", () => logoutChat());
accountLogoutBtn.addEventListener("click", () => logoutAccount());

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const content = messageInput.value.trim();
  if (!content || !roomId) return;

  socket.emit("send_message", {
    roomId,
    content,
  });

  messageInput.value = "";
  messageInput.focus();
});

socket.on("receive_message", (msg) => {
  appendMessage({
    sender: msg.sender,
    content: msg.content,
    created_at: msg.created_at,
    type: msg.sender === getDisplayName(authUser) ? "mine" : "other",
  });
});

socket.on("system_message", ({ message }) => {
  appendMessage({
    content: message,
    type: "system",
  });
});

socket.on("room_deleted", async ({ roomId: deletedRoomId, message }) => {
  if (deletedRoomId !== roomId) {
    return;
  }

  await loadRooms();
  logoutChat({
    notifyServer: false,
    notice: message || "Phòng đã bị xóa bởi admin.",
  });
});

socket.on("force_logout", async ({ message, redirectTo }) => {
  await fetch("/auth/logout", { method: "POST" });
  window.location.href = `${redirectTo || "/dang-nhap"}?message=${encodeURIComponent(message || "Phiên đăng nhập đã hết hạn.")}`;
});

async function bootstrap() {
  const hasUser = await loadCurrentUser();
  if (!hasUser) {
    return;
  }

  await loadRooms();
}

bootstrap();

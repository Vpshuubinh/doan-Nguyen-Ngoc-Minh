const adminIdentity = document.getElementById("adminIdentity");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");
const userNotice = document.getElementById("userNotice");
const usersTableBody = document.getElementById("usersTableBody");
const usersPagination = document.getElementById("usersPagination");

const PAGE_SIZE = 10;
const REFRESH_INTERVAL_MS = 5000;

let currentAdminId = null;
let allUsers = [];
let currentPage = 1;
let realtimeTimer = null;

function sanitize(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showNotice(message, type) {
  userNotice.textContent = message;
  userNotice.className = `admin-notice ${type}`;
}

function hideNotice() {
  userNotice.className = "admin-notice hidden";
  userNotice.textContent = "";
}

function getTotalPages() {
  return Math.max(1, Math.ceil(allUsers.length / PAGE_SIZE));
}

function renderPagination() {
  const totalPages = getTotalPages();

  if (!allUsers.length) {
    usersPagination.innerHTML = "";
    return;
  }

  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return `
      <button
        type="button"
        class="ghost-btn admin-page-btn ${page === currentPage ? "active" : ""}"
        data-page="${page}"
      >
        ${page}
      </button>
    `;
  }).join("");

  usersPagination.innerHTML = `
    <div class="admin-pagination-summary">
      Trang ${currentPage}/${totalPages} • Tổng ${allUsers.length} user
    </div>
    <div class="admin-pagination-controls">
      <button type="button" class="ghost-btn admin-page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Trang trước</button>
      ${pageButtons}
      <button type="button" class="ghost-btn admin-page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Trang sau</button>
    </div>
  `;
}

function renderUsers() {
  if (!allUsers.length) {
    usersTableBody.innerHTML = `<tr><td colspan="7" class="admin-empty">Chưa có user nào.</td></tr>`;
    usersPagination.innerHTML = "";
    return;
  }

  const totalPages = getTotalPages();
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedUsers = allUsers.slice(startIndex, startIndex + PAGE_SIZE);

  usersTableBody.innerHTML = paginatedUsers.map((user, index) => `
    <tr>
      <td>${startIndex + index + 1}</td>
      <td><strong>${sanitize(user.username)}</strong></td>
      <td>${sanitize(user.email || "--")}</td>
      <td><span class="status-pill ${user.status === "online" ? "online" : "offline"}">${sanitize(user.status)}</span></td>
      <td>${sanitize(user.current_room || "--")}</td>
      <td>
        <label class="role-select-wrap">
          <select class="role-select" data-role-user="${user.id}" ${user.id === currentAdminId ? "disabled" : ""}>
            <option value="user" ${user.role === "user" ? "selected" : ""}>USER</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>ADMIN</option>
          </select>
        </label>
      </td>
      <td>
        <div class="admin-table-actions">
          <button type="button" class="ghost-btn" data-toggle-user="${user.id}" data-next-active="${user.is_active ? "0" : "1"}">${user.is_active ? "Khóa" : "Mở khóa"}</button>
          ${user.role === "admin" ? "" : `<button type="button" class="ghost-btn danger-btn" data-delete-user="${user.id}">Xóa</button>`}
        </div>
      </td>
    </tr>
  `).join("");

  renderPagination();
}

async function fetchAdminMe() {
  const res = await fetch("/admin/me");
  const payload = await res.json();

  if (!res.ok || !payload.user) {
    window.location.href = "/admin/login";
    return null;
  }

  adminIdentity.textContent = `Đăng nhập với ${payload.user.username} (${payload.user.email})`;
  currentAdminId = payload.user.id;
  return payload.user;
}

async function loadUsers({ showLoading = true, preserveNotice = true } = {}) {
  if (showLoading) {
    usersTableBody.innerHTML = `<tr><td colspan="7" class="admin-empty">Đang tải danh sách user...</td></tr>`;
  }

  if (!preserveNotice) {
    hideNotice();
  }

  try {
    const res = await fetch("/admin/users");
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || "Không thể tải danh sách user.");
    }

    allUsers = payload.users || [];
    renderUsers();
  } catch (error) {
    usersTableBody.innerHTML = `<tr><td colspan="7" class="admin-empty">${sanitize(error.message)}</td></tr>`;
    usersPagination.innerHTML = "";
    showNotice(error.message, "error");
  }
}

async function toggleUserStatus(userId, isActive) {
  try {
    const res = await fetch(`/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || "Không thể cập nhật user.");
    }

    showNotice(payload.message, "success");
    await loadUsers({ showLoading: false });
  } catch (error) {
    showNotice(error.message, "error");
  }
}

async function updateUserRole(userId, role) {
  try {
    const res = await fetch(`/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || "Không thể cập nhật role user.");
    }

    showNotice(payload.message, "success");
    await loadUsers({ showLoading: false });
  } catch (error) {
    showNotice(error.message, "error");
    await loadUsers({ showLoading: false });
  }
}

async function deleteUser(userId) {
  if (!window.confirm("Bạn chắc chắn muốn xóa user này?")) {
    return;
  }

  try {
    const res = await fetch(`/admin/users/${userId}`, { method: "DELETE" });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || "Không thể xóa user.");
    }

    showNotice(payload.message, "success");
    await loadUsers({ showLoading: false });
  } catch (error) {
    showNotice(error.message, "error");
  }
}

function startRealtimeRefresh() {
  if (realtimeTimer) {
    clearInterval(realtimeTimer);
  }

  realtimeTimer = setInterval(() => {
    loadUsers({ showLoading: false, preserveNotice: true });
  }, REFRESH_INTERVAL_MS);
}

refreshUsersBtn.addEventListener("click", async () => {
  await loadUsers({ showLoading: false, preserveNotice: false });
});

usersTableBody.addEventListener("click", async (event) => {
  const toggleButton = event.target.closest("[data-toggle-user]");
  if (toggleButton) {
    await toggleUserStatus(Number(toggleButton.dataset.toggleUser), toggleButton.dataset.nextActive === "1");
    return;
  }

  const deleteButton = event.target.closest("[data-delete-user]");
  if (deleteButton) {
    await deleteUser(Number(deleteButton.dataset.deleteUser));
  }
});

usersTableBody.addEventListener("change", async (event) => {
  const roleSelect = event.target.closest("[data-role-user]");
  if (!roleSelect) {
    return;
  }

  await updateUserRole(Number(roleSelect.dataset.roleUser), roleSelect.value);
});

usersPagination.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-page]");
  if (!pageButton || pageButton.disabled) {
    return;
  }

  currentPage = Number(pageButton.dataset.page);
  renderUsers();
});

adminLogoutBtn.addEventListener("click", async () => {
  await fetch("/admin/logout", { method: "POST" });
  window.location.href = "/admin/login";
});

window.addEventListener("beforeunload", () => {
  if (realtimeTimer) {
    clearInterval(realtimeTimer);
  }
});

async function bootstrap() {
  const adminUser = await fetchAdminMe();
  if (!adminUser) return;
  await loadUsers();
  startRealtimeRefresh();
}

bootstrap();

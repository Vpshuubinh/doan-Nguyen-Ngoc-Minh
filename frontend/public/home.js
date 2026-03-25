const guestActions = document.getElementById("guestActions");
const accountActions = document.getElementById("accountActions");
const homeAccountName = document.getElementById("homeAccountName");
const homeAdminBtn = document.getElementById("homeAdminBtn");
const homeLogoutBtn = document.getElementById("homeLogoutBtn");

function getDisplayName(user) {
  return user?.full_name || user?.username || "";
}

async function loadHomeSession() {
  try {
    const res = await fetch("/auth/me");
    const payload = await res.json();
    const user = payload.user;

    if (!user) {
      guestActions.classList.remove("hidden");
      accountActions.classList.add("hidden");
      return;
    }

    homeAccountName.textContent = getDisplayName(user);
    homeAdminBtn.classList.toggle("hidden", user.role !== "admin");

    guestActions.classList.add("hidden");
    accountActions.classList.remove("hidden");
  } catch (error) {
    guestActions.classList.remove("hidden");
    accountActions.classList.add("hidden");
  }
}

homeLogoutBtn?.addEventListener("click", async () => {
  try {
    await fetch("/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/";
  }
});

loadHomeSession();

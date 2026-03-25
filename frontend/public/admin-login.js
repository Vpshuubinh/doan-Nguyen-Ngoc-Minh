const adminLoginForm = document.getElementById("adminLoginForm");
const adminLoginMessage = document.getElementById("adminLoginMessage");

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const login = document.getElementById("adminLoginInput").value.trim();
  const password = document.getElementById("adminPasswordInput").value.trim();

  try {
    const res = await fetch("/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ login, password }),
    });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || "Không thể đăng nhập admin.");
    }

    window.location.href = "/admin/dashboard";
  } catch (error) {
    adminLoginMessage.textContent = error.message;
  }
});

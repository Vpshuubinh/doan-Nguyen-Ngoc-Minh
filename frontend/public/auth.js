const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");
const authMode = document.body.dataset.authMode;

function getRedirectPath(defaultPath) {
  const params = new URLSearchParams(window.location.search);
  return params.get("redirect") || defaultPath;
}

function showAuthMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#dc2626" : "#166534";
}

const initialMessage = new URLSearchParams(window.location.search).get("message");
if (initialMessage) {
  showAuthMessage(initialMessage, false);
}

async function handleLogin(event) {
  event.preventDefault();

  const login = document.getElementById("loginInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

  try {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ login, password }),
    });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || "Không thể đăng nhập.");
    }

    window.location.href = getRedirectPath("/chat");
  } catch (error) {
    showAuthMessage(error.message, true);
  }
}

async function handleRegister(event) {
  event.preventDefault();

  const fullName = document.getElementById("fullNameInput").value.trim();
  const username = document.getElementById("usernameInput").value.trim();
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value.trim();

  try {
    const res = await fetch("/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fullName, username, email, password }),
    });
    const payload = await res.json();

    if (!res.ok) {
      throw new Error(payload.error || "Không thể đăng ký.");
    }

    showAuthMessage(payload.message || "Đăng ký thành công.", false);
    setTimeout(() => {
      window.location.href = "/";
    }, 800);
  } catch (error) {
    showAuthMessage(error.message, true);
  }
}

authForm.addEventListener("submit", (event) => {
  if (authMode === "register") {
    handleRegister(event);
    return;
  }

  handleLogin(event);
});

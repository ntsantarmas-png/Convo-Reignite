// ===================== Users Panel (CSS Controlled Version) =====================
// File: usersPanel.js

console.log("✅ usersPanel.js loaded");

const usersPanel = document.querySelector("#usersPanel");
const usersToggleBtn = document.getElementById("usersToggleBtn");

if (!usersPanel || !usersToggleBtn) {
  console.warn("⚠️ Missing DOM elements for Users Panel setup");
}

export function initUsersPanel() {
  console.log("🏁 initUsersPanel() called");

  if (!usersPanel || !usersToggleBtn) return;

  usersToggleBtn.addEventListener("click", () => {
    const isVisible = usersPanel.classList.toggle("visible");

    if (isVisible) {
      console.log("👥 Users panel opened");
    } else {
      console.log("👤 Users panel closed");
    }
  });
}

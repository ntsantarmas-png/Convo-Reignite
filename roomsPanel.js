// ===================== Rooms Panel (Setup) =====================
// File: roomsPanel.js

console.log("✅ roomsPanel.js loaded");

// === Επιλογή στοιχείων DOM ===
const roomsPanel = document.querySelector(".panel.left");
const roomsToggleBtn = document.getElementById("roomsToggleBtn");

// === Έλεγχος ύπαρξης στοιχείων ===
if (!roomsPanel || !roomsToggleBtn) {
  console.warn("⚠️ Rooms Panel elements not found in DOM");
}

// === Toggle εμφάνισης panel ===
export function initRoomsPanel() {
  console.log("🏁 initRoomsPanel() called");

  if (!roomsPanel || !roomsToggleBtn) return;

  roomsToggleBtn.addEventListener("click", () => {
    const visible = roomsPanel.classList.toggle("visible");
    console.log(visible ? "📂 Rooms panel opened" : "📁 Rooms panel closed");
  });
}

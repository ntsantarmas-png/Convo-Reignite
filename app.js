// ============================================================================
// Convo — Clean Base (No Rooms) — STEP 2
// Purpose: Firebase init + Auth State watcher
// ============================================================================
import "./firebaseInit.js";
import { watchAuthState } from "./authState.js";
import {
  registerUser,
  loginUser,
  loginGuest,
  logoutUser
} from "./authActions.js";
import { initMessagesListener } from "./chatMessages.js";
import { setupPresence } from "./presence.js";
import { initUsersList } from "./usersList.js";
import { setTypingState, watchTyping } from "./typing.js";
import { initRoomsPanel } from "./roomsPanel.js";
import { initUsersPanel } from "./usersPanel.js";
import { auth } from "./firebaseInit.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, onChildAdded } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { db } from "./firebaseInit.js";
import { remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";




console.log("🚀 Convo Step 2 loaded");

// === Start watching auth state ===
watchAuthState();
setupPresence();
initUsersList();
initRoomsPanel();
initUsersPanel();


// === Start listening for chat messages ===
initMessagesListener();


// ===================== BASIC UI LOGIC (kept from Step 1) =====================

// ——— Auto-grow textarea (basic) ———
const msgInput = document.getElementById('messageInput');
if (msgInput){
  const base = 40, max = 140;
  msgInput.style.height = base + 'px';
  msgInput.addEventListener('input', () => {
    msgInput.style.height = base + 'px';
    msgInput.style.height = Math.min(msgInput.scrollHeight, max) + 'px';
  });
}


// ===================== AUTH BUTTON EVENTS =====================
document.getElementById("registerBtn")?.addEventListener("click", registerUser);
document.getElementById("loginBtn")?.addEventListener("click", loginUser);
document.getElementById("guestBtn")?.addEventListener("click", loginGuest);
document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);


function isAdminDisplayName(name){
  if (!name) return false;
  const n = name.toLowerCase();
  return n === "mysteryman" || n.includes("admin");
}

onAuthStateChanged(auth, (user) => {
  const btn = document.getElementById("clearChatBtn");
  if (!btn) return;
  if (user && isAdminDisplayName(user.displayName)) {
    btn.classList.remove("hidden");
  } else {
    btn.classList.add("hidden");
  }
});
// ============================================================================
// ADMIN — SYSTEM LOGS (MysteryMan only, UI Base)
// ============================================================================

const systemBtn = document.getElementById("systemBtn");
const systemModal = document.getElementById("systemModal");
const closeSystemBtn = document.getElementById("closeSystemBtn");

onAuthStateChanged(auth, (user) => {
  if (!systemBtn) return;
  if (user && user.displayName?.toLowerCase() === "mysteryman") {
    systemBtn.classList.remove("hidden");
  } else {
    systemBtn.classList.add("hidden");
    systemModal.classList.add("hidden");
  }
});

systemBtn?.addEventListener("click", () => {
  systemModal.classList.remove("hidden");
});

closeSystemBtn?.addEventListener("click", () => {
  systemModal.classList.add("hidden");
});

// Κλείσιμο με click έξω από το modal
systemModal?.addEventListener("click", (e) => {
  if (e.target === systemModal) systemModal.classList.add("hidden");
});
// ============================================================================
// SYSTEM LOGS — Realtime Fetch (Step 2)
// ============================================================================


const logsContainer = document.querySelector("#systemModal .modal-content");

function renderLogEntry(data) {
  const log = data.val();
  if (!log) return;

  const time = new Date(log.timestamp || Date.now()).toLocaleString("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const el = document.createElement("div");
  el.classList.add("log-entry");
  el.innerHTML = `
    <div><strong>${time}</strong> — <span>${log.action || "unknown action"}</span></div>
    <div class="muted">by: ${log.by || "unknown"}</div>
  `;
logsContainer.prepend(el);
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

export function initSystemLogsListener() {
  const logsRef = ref(db, "adminLogs");
  onChildAdded(logsRef, renderLogEntry);
  console.log("🧠 Listening to adminLogs...");
}

// Ξεκίνημα listener μόνο αν είσαι MysteryMan
onAuthStateChanged(auth, (user) => {
  if (user && user.displayName?.toLowerCase() === "mysteryman") {
    initSystemLogsListener();
  }
});
// ============================================================================
// SYSTEM LOGS — Clear Button (MysteryMan only)
// ============================================================================


const clearLogsBtn = document.getElementById("clearLogsBtn");

clearLogsBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user || user.displayName?.toLowerCase() !== "mysteryman") return;
  await remove(ref(db, "adminLogs"));
  document.querySelector("#systemModal .modal-content").innerHTML =
    `<p class="muted">📜 Δεν υπάρχουν logs.</p>`;
});

// ============================================================================
// Convo — Clean Base (No Rooms) — STEP 2
// Purpose: Firebase init + Auth State watcher
// ============================================================================
//  APP.JS — MAIN SCRIPT (Convo Clean Base)
//  All Firebase + Local Module Imports (merged and ordered)
// ============================================================================

// === Core Firebase ===
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  ref,
  onChildAdded,
  onChildChanged,
  push,
  remove,
  serverTimestamp,
  update
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// === Local Firebase Init ===
import { db, auth } from "./firebaseInit.js";

// === Auth & State Management ===
import { watchAuthState } from "./authState.js";
import { registerUser, loginUser, loginGuest, logoutUser } from "./authActions.js";

// === Core Chat Modules ===
import { initMessagesListener } from "./chatMessages.js";
import { setupPresence } from "./presence.js";
import { initUsersList } from "./usersList.js";
import { setTypingState, watchTyping } from "./typing.js";
import { initRoomsPanel } from "./roomsPanel.js";
import { initUsersPanel } from "./usersPanel.js";

// ============================================================================
// END OF IMPORTS — BEGIN APP LOGIC BELOW
// ============================================================================



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
// === Create filter buttons (Step 9 Part G) ===
const filterBar = document.getElementById("systemLogsFilter");
if (filterBar && !filterBar.hasChildNodes()) {
  filterBar.innerHTML = `
    <button class="filter-btn active" data-type="all">All</button>
    <button class="filter-btn" data-type="ban">Ban</button>
    <button class="filter-btn" data-type="kick">Kick</button>
    <button class="filter-btn" data-type="delete">Delete</button>
  `;
}
// === Filtering logic (Step 9 Part G) ===
let currentFilter = "all";
const listEl = document.getElementById("systemLogsList");

filterBar?.addEventListener("click", (e) => {
  if (!e.target.matches(".filter-btn")) return;

  // Αλλαγή ενεργού κουμπιού
  document.querySelectorAll(".filter-btn").forEach((btn) =>
    btn.classList.remove("active")
  );
  e.target.classList.add("active");

  // Ενημέρωση φίλτρου
  currentFilter = e.target.dataset.type;

  // Επανεμφάνιση logs με βάση το φίλτρο
  renderLogs();
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


const logsContainer = document.getElementById("systemLogsList");

function renderLogEntry(data) {
  const log = data.val();
  if (!log) return;

  const type = log.type || "other";
  const color =
    type === "ban"
      ? "#ff4d4d"
      : type === "kick"
      ? "#ffb84d"
      : type === "delete"
      ? "#2d8cff"
      : "#aaa";

  const time = new Date(log.createdAt || Date.now()).toLocaleString("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const el = document.createElement("div");
  el.classList.add("log-item");
  el.dataset.type = type; // 👈 σημαντικό
  el.innerHTML = `
    <div><strong style="color:${color}">${type.toUpperCase()}</strong> — <span>${log.action || log.type || "unknown"}</span></div>
    <div class="muted">by: ${log.adminName || log.by || "unknown"}</div>
    <div class="muted small">${time}</div>
  `;
  logsContainer.prepend(el);
  logsContainer.scrollTop = logsContainer.scrollHeight;
}


export function initSystemLogsListener() {
  const logsRef = ref(db, "adminLogs");
  onChildAdded(logsRef, renderLogEntry);
  console.log("🧠 Listening to adminLogs...");
}
// === Απόδοση logs με βάση το φίλτρο ===
function renderLogs() {
  const allLogs = document.querySelectorAll(".log-item");
  allLogs.forEach((item) => {
    const type = item.dataset.type;
    item.style.display =
      currentFilter === "all" || currentFilter === type ? "" : "none";
  });
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
// ============================================================================
// ADMIN MENU (Fixed Version)
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  const adminMenuBtn = document.getElementById("adminMenuBtn");
  if (!adminMenuBtn) return;

  // === Εμφάνιση κουμπιού μόνο για MysteryMan ===
  onAuthStateChanged(auth, (user) => {
    if (user && user.uid === "LNT3cUi6sUPW3I1FCGSZMJVAymv1") {
      adminMenuBtn.classList.remove("hidden");
    } else {
      adminMenuBtn.classList.add("hidden");
    }
  });

  // === Άνοιγμα / Κλείσιμο Admin Menu Modal ===
  adminMenuBtn.addEventListener("click", () => {
    const existing = document.getElementById("adminMenuModal");
    if (existing) {
      existing.remove();
      return;
    }

    const modal = document.createElement("div");
    modal.id = "adminMenuModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <strong>🛠️ Admin Menu</strong>
          <button id="closeAdminMenu" class="btn small ghost">✖</button>
        </div>
        <div class="modal-content">
          <button id="menuClearChatBtn" class="btn danger" style="margin-bottom:8px;">
            🧹 Clear Chat for Everyone
          </button>

          <button id="menuBanUserBtn" class="btn danger" style="margin-bottom:8px;">
            🚫 Ban / Kick User
          </button>

          <p style="opacity:.7;">(More tools coming soon...)</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // === Κλείσιμο modal ===
    document.getElementById("closeAdminMenu").addEventListener("click", () => modal.remove());

    // === CLEAR CHAT inside Admin Menu ===
    const menuClearChatBtn = document.getElementById("menuClearChatBtn");
    menuClearChatBtn.addEventListener("click", () => {
      if (!confirm("⚠️ Clear chat for everyone? This cannot be undone.")) return;
      document.getElementById("clearChatBtn")?.click(); // reuse existing logic
    });

    // === BAN / KICK USER ===
    const menuBanUserBtn = document.getElementById("menuBanUserBtn");
    menuBanUserBtn.addEventListener("click", async () => {
      const targetUid = prompt("🚫 Enter UID of user to ban (kick them out):");
      if (!targetUid) return;
      if (!confirm(`⚠️ Are you sure you want to BAN this user?\n\nUID: ${targetUid}`)) return;

      try {
        await update(ref(db, "users/" + targetUid), { banned: true });
        await push(ref(db, "adminLogs"), {
          type: "ban",
          targetUid,
          adminUid: auth.currentUser.uid,
          adminName: auth.currentUser.displayName || "Admin",
          createdAt: serverTimestamp()
        });
        alert("✅ User has been banned and logged.");
      } catch (err) {
        console.error("Ban error:", err);
        alert("❌ Ban failed — check console.");
      }
    });
  });
});

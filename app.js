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
  update,
  onValue,
  get,
  set
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { initYouTubePanel } from "./youtube.js";

import { off } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
let systemLogsActive = false;

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
import { initUsersPanel } from "./usersPanel.js";

// ============================================================================
// END OF IMPORTS — BEGIN APP LOGIC BELOW
// ============================================================================



console.log("🚀 Convo Step 2 loaded");

// === Start watching auth state ===
watchAuthState();
setupPresence();
initUsersList();
initUsersPanel();
initYouTubePanel();



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

systemBtn?.addEventListener("click", async () => {
  const logsRef = ref(db, "adminLogs");
  off(logsRef); // 🧹 σταματά τυχόν προηγούμενο listener
  console.log("♻️ Old System Logs listener cleared before new open");

  systemModal.classList.remove("hidden");
  document.body.classList.add("modal-open"); // ✅ κλείδωσε το body

  const logsContainer = document.getElementById("systemLogsList");
  if (!logsContainer) return;

  // 1️⃣ Καθάρισε λίστα και φόρτωσε παλιά logs
  logsContainer.innerHTML = "";
  const snap = await get(logsRef);
  const allLogs = [];
  snap.forEach((child) => allLogs.push(child));
  allLogs.reverse().forEach((child) => renderLogEntry(child));

  // 2️⃣ Ενεργοποίησε Realtime Listener (μόνο όταν ανοίγει το modal)
  initSystemLogsListener(); // ✅ ενεργοποιεί realtime μόλις ανοίξει

  console.log("🧠 System Logs ενεργοποιήθηκαν σε realtime χωρίς F5");
});



// === Create filter buttons (Step 9 Part G) ===
const filterBar = document.getElementById("systemLogsFilter");
if (filterBar && !filterBar.hasChildNodes()) {
  filterBar.innerHTML = `
    <button class="filter-btn active" data-type="all">All</button>
    <button class="filter-btn" data-type="ban">Ban</button>
    <button class="filter-btn" data-type="kick">Kick</button>
    <button class="filter-btn" data-type="delete">Delete</button>
  <button class="filter-btn" data-type="mute">Mute</button>

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
  document.body.classList.remove("modal-open");  // ✅ ξεκλείδωσε το body

  const logsRef = ref(db, "adminLogs");
  off(logsRef); // 🧹 σταματά τον listener
  systemLogsActive = false;
  console.log("🧠 System Logs listener σταμάτησε");
});


// Κλείσιμο με click έξω από το modal
systemModal?.addEventListener("click", (e) => {
  if (e.target === systemModal) {
    systemModal.classList.add("hidden");
    document.body.classList.remove("modal-open"); // ✅ ξεκλείδωσε το body όταν κάνεις click έξω
  }
});

// ============================================================================
// SYSTEM LOGS — Realtime Fetch (Step 2)
// ============================================================================


function renderLogEntry(data) {
  const log = data.val();
  if (!log) return;

  // ⬇️ πάντα φρέσκο reference στο container
  const logsContainer = document.getElementById("systemLogsList");
  if (!logsContainer) return;

  const type = log.type || "other";
  const color =
    type === "ban"   ? "#ff4d4d" :
    type === "kick"  ? "#ffb84d" :
    type === "delete"? "#2d8cff" :
    type === "mute"  ? "#ff66cc" : "#aaa";

  const time = new Date(log.createdAt || Date.now()).toLocaleString("el-GR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const target = log.targetName
    ? `<div style="opacity:0.85;">🎯 target: <strong>${log.targetName}</strong></div>` : "";

  const room = log.room
    ? `<div style="opacity:0.7; font-size:13px;">🏠 room: ${log.room}</div>` : "";

  const el = document.createElement("div");
  el.classList.add("log-item");
  el.dataset.type = type;
  el.innerHTML = `
    <div><strong style="color:${color}">${type.toUpperCase()}</strong> — <span>${log.action || log.type || "unknown"}</span></div>
    ${target}
    <div class="muted">by: ${log.adminName || log.by || "unknown"}</div>
    ${log.reason ? `<div class="muted" style="color:#ffa;">📝 reason: ${log.reason}</div>` : ""}
    ${room}
    <div class="muted small">${time}</div>
  `;

  logsContainer.prepend(el);
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

// ============================================================================
// SYSTEM LOGS — Realtime Listener (Fixed Version)
// ============================================================================

export function initSystemLogsListener() {
  // Αν υπάρχει ήδη listener, καθάρισέ τον πρώτα
  const logsRef = ref(db, "adminLogs");
  off(logsRef); // 🧹 καθάρισε όποιον παλιό listener υπάρχει

  // Ενεργοποίησε νέο listener
  onChildAdded(logsRef, (snap) => renderLogEntry(snap));

  console.log("🧠 Listening to adminLogs (single realtime listener active)");
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

// === Ξεκίνημα listener μόνο αν είσαι MysteryMan ===
//onAuthStateChanged(auth, (user) => {
  //if (user && user.displayName?.toLowerCase() === "mysteryman") {
    //initSystemLogsListener();
  //}
//});

// ============================================================================
// SYSTEM LOGS — Clear Button (MysteryMan only)
// ============================================================================


const clearLogsBtn = document.getElementById("clearLogsBtn");

clearLogsBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user || user.displayName?.toLowerCase() !== "mysteryman") return;
  await remove(ref(db, "adminLogs"));
  const list = document.getElementById("systemLogsList");
if (list) {
  list.innerHTML = `<p class="muted">📜 Δεν υπάρχουν logs.</p>`;
}

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
// ============================================================================
// ADMIN — Muted Users Button visibility (Admins only)
// ============================================================================
onAuthStateChanged(auth, (user) => {
  const mutedBtn = document.getElementById("showMutedBtn");
  if (!mutedBtn) return;

  const name = user?.displayName?.toLowerCase() || "";
  const isAdmin = name === "mysteryman" || name.includes("admin");

  if (user && isAdmin) {
    mutedBtn.classList.remove("hidden");
  } else {
    mutedBtn.classList.add("hidden");
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
      <p style="opacity:.7;">(More tools coming soon...)</p>
    </div>
  `;
  document.body.appendChild(modal);

  // === Κλείσιμο modal ===
  document.getElementById("closeAdminMenu")
    ?.addEventListener("click", () => modal.remove());

  // === CLEAR CHAT inside Admin Menu ===
  const menuClearChatBtn = document.getElementById("menuClearChatBtn");
  menuClearChatBtn?.addEventListener("click", () => {
    if (!confirm("⚠️ Clear chat for everyone? This cannot be undone.")) return;
    document.getElementById("clearChatBtn")?.click(); // reuse existing logic
  });

}); // ✅ κλείνει το addEventListener("click", ...)


// === BAN / KICK USER ===
const menuBanUserBtn = document.getElementById("menuBanUserBtn");
if (menuBanUserBtn) {  // ✅ Προστέθηκε έλεγχος ύπαρξης για αποφυγή console error
  menuBanUserBtn.addEventListener("click", async () => {
    const targetUid = await showConvoPrompt("🚫 Enter UID of user to ban:", { placeholder: "User UID..." });
    if (!targetUid) return;

    const confirmBan = await showConvoPrompt(`⚠️ Confirm BAN for UID: ${targetUid}? Type "yes" to proceed:`);
    if (confirmBan?.toLowerCase() !== "yes") return;

    try {
      await update(ref(db, "users/" + targetUid), { banned: true });
      await push(ref(db, "adminLogs"), {
        type: "ban",
        targetUid,
        adminUid: auth.currentUser.uid,
        adminName: auth.currentUser.displayName || "Admin",
        createdAt: serverTimestamp()
      });
      showConvoAlert("✅ User has been banned and logged.");
    } catch (err) {
      console.error("Ban error:", err);
      showConvoAlert("❌ Ban failed — check console.");
    }
  });
} // ✅ τέλος του safety check

}); // ✅ κλείνει το document.addEventListener("DOMContentLoaded")

// ============================================================================
// 🧩 Rooms Panel Toggle
// ============================================================================
const roomsToggleBtn = document.getElementById("roomsToggleBtn");
const roomsPanel = document.getElementById("roomsPanel");

if (roomsToggleBtn && roomsPanel) {
  roomsToggleBtn.classList.remove("hidden"); // δείχνει το κουμπί μετά το login

  roomsToggleBtn.addEventListener("click", () => {
    const visible = roomsPanel.classList.toggle("visible");
    if (visible) {
      console.log("📂 Rooms panel opened");
    } else {
      console.log("📁 Rooms panel closed");
    }
  });
}

// ============================================================================
// 🧩 Convo Bubble Core (Step 1)
// ============================================================================
export function showConvoAlert(message) {
  const overlay = document.getElementById("convoBubbleOverlay");
  const content = document.getElementById("bubbleContent");
  const closeBtn = document.getElementById("bubbleCloseBtn");
  const okBtn = document.getElementById("bubbleOkBtn");

  if (!overlay || !content) return console.warn("⚠️ ConvoBubble missing from DOM");

  // Ενημέρωσε περιεχόμενο
  content.innerHTML = `<div>${message}</div>`;

  // Εμφάνισε bubble
  overlay.classList.remove("hidden");

  // === Συνάρτηση κλεισίματος ===
  function closeBubble() {
    overlay.classList.add("hidden");
    // Καθάρισε όλους τους listeners
    document.removeEventListener("keydown", escListener);
    overlay.removeEventListener("click", outsideClick);
    okBtn?.removeEventListener("click", okClick);
    closeBtn?.removeEventListener("click", closeClick);
  }

  // === Listeners ===
  const escListener = (e) => { if (e.key === "Escape") closeBubble(); };
  const outsideClick = (e) => { if (e.target === overlay) closeBubble(); };
  const okClick = () => closeBubble();
  const closeClick = () => closeBubble();

  document.addEventListener("keydown", escListener);
  overlay.addEventListener("click", outsideClick);
  okBtn?.addEventListener("click", okClick);
  closeBtn?.addEventListener("click", closeClick);
}
window.showConvoAlert = showConvoAlert;

window.showConvoAlert = showConvoAlert;
// ============================================================================
// 🧩 Convo Bubble — Prompt Mode (Smart Version)
// ============================================================================
// 🧩 Convo Bubble — Prompt Mode (fixed)
export function showConvoPrompt(message, options = {}) {   // <== 🔹 Ανοίγει εδώ
  return new Promise((resolve) => {                        // <== 🔹 Ανοίγει Promise

    const overlay = document.getElementById("convoBubbleOverlay");
    const content  = document.getElementById("bubbleContent");
    const closeBtn = document.getElementById("bubbleCloseBtn");
    const okBtn    = document.getElementById("bubbleOkBtn");
    if (!overlay || !content || !okBtn) return resolve(null);

    // περιεχόμενο + (προαιρετικό) input
    const needsInput = /(name|nickname|reason)/i.test(message);

    content.innerHTML = needsInput
      ? `<div style="margin-bottom:8px;">${message}</div>
         <input id="bubbleInput" type="text" placeholder="${options.placeholder || ''}"
                style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:#0c1218;color:#fff;">`
      : `<div>${message}</div>`;

    const input = document.getElementById("bubbleInput") || null;
    overlay.classList.remove("hidden");

    let resolved = false;
    const cleanup = () => {
      document.removeEventListener("keydown", onKey);
      overlay.removeEventListener("click", onOutside);
      closeBtn?.removeEventListener("click", onClose);
      okBtn.removeEventListener("click", onOk);
    };

    const close = (val = null) => {
      if (resolved) return;
      resolved = true;
      overlay.classList.add("hidden");
      cleanup();
      resolve(val);
    };

    const onOk = () => {
      let val = "ok";
      if (input) val = input.value.trim() || "ok";
      close(val);
    };

    const onClose = () => close(null);
    const onOutside = (e) => { if (e.target === overlay) close(null); };
    const onKey = (e) => {
      if (e.key === "Escape") close(null);
      if (e.key === "Enter" && input) {
        e.preventDefault();
        onOk();
      }
    };

    if (input) input.focus(); else okBtn.focus();
    okBtn.addEventListener("click", onOk);
    closeBtn?.addEventListener("click", onClose);
    overlay.addEventListener("click", onOutside);
    document.addEventListener("keydown", onKey);

  });   // <== ✅ Κλείνει το new Promise
}       // <== ✅ Κλείνει τη showConvoPrompt function

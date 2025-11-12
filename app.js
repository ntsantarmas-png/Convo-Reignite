// ============================================================================
// Convo — Clean Base (No Rooms) — STEP 2
// Purpose: Firebase init + Auth State watcher
// ============================================================================
//  APP.JS — MAIN SCRIPT (Convo Clean Base)
//  All Firebase + Local Module Imports (merged and ordered)
// ============================================================================

// ============================================================================
// ⚙️ Core Firebase Imports
// ============================================================================
import { onAuthStateChanged, updateProfile } 
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

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
  set,
  off
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// (προαιρετικό alias για καθαρότητα στα τοπικά off calls)
import { off as dbOff } 
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

import { convoAlert, convoConfirm, convoPrompt } from "./convoAlerts.js";
// ============================================================================
// 🧩 Local Modules & Firebase Init
// ============================================================================
import { db, auth } from "./firebaseInit.js";
import { currentUserData } from "./currentUser.js";
import { watchAuthState } from "./authState.js";
import { registerUser, loginUser, loginGuest, logoutUser } from "./authActions.js";
import { initMessagesListener } from "./chatMessages.js";
import { setupPresence } from "./presence.js";
import { initUsersList } from "./usersList.js";
import { setTypingState, watchTyping } from "./typing.js";
import { initUsersPanel } from "./usersPanel.js";
import { initEmojiPanel } from "./emojiPanel.js";
import { initPrivateTabs } from "./privateTabs.js";
import { initYouTubePanel } from "./youtube.js";
import { sendFriendRequest, removeFriend } from "./friendsManager.js";


// ============================================================================
// 🧠 App State
// ============================================================================
let systemLogsActive = false;



// ============================================================================
// END OF IMPORTS — BEGIN APP LOGIC BELOW
// ============================================================================



console.log("🚀 Convo Step 2 loaded");
// ============================================================
// PREVENT LOGO JUMP (apply auth-active by default until auth loads)
// ============================================================
document.body.classList.add("auth-active");


// === Start watching auth state ===
watchAuthState();
setupPresence();
initUsersList();
initUsersPanel();
//initYouTubePanel();
// ===================== EMOJI PANEL INIT (Safe Load) =====================
let emojiPanelInitialized = false;

onAuthStateChanged(auth, (user) => {
  if (user && !emojiPanelInitialized) {
    initEmojiPanel();
    emojiPanelInitialized = true;
    console.log("😊 Emoji Panel initialized safely");
  }
});




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

// ============================================================================
// 🔧 Admin Tools Visibility (MysteryMan & Admins)
// ============================================================================
onAuthStateChanged(auth, async (user) => {
  // === AUTO ADMIN RESTORE για MysteryMan ===
  if (user && user.displayName && user.displayName.toLowerCase() === "mysteryman") {
    const userRef = ref(db, "users/" + user.uid);
    const snap = await get(userRef);
    const data = snap.val() || {};

    if (data.role !== "admin") {
      await update(userRef, { role: "admin" });
      console.log("🛡️ Auto-restored MysteryMan as admin");
    }
  }

  // === Συνέχεια με τα κανονικά στοιχεία ===
  const name = (currentUserData.displayName || "").toLowerCase();
  const role = currentUserData.role || "";

  const isOwner = name === "mysteryman";
  const isAdmin = isOwner || role === "admin";

  const systemBtn        = document.getElementById("systemBtn");
  const renameBtn        = document.getElementById("renameBtn"); // ✏️ νέο κουμπί
  const showBannedBtn    = document.getElementById("showBannedBtn");
  const showMutedBtn     = document.getElementById("showMutedBtn");
  const clearChatBtn     = document.getElementById("clearChatBtn");
  const clearGuestsBtn   = document.getElementById("clearGuestsBtn");

  // === Απόκρυψη Rename Logs στην Auth Screen ===
  if (!user) {
    renameBtn?.classList.add("hidden");
  }
  // === Owner (MysteryMan) βλέπει ΟΛΑ ===
  if (isOwner) {
    systemBtn?.classList.remove("hidden");
      renameBtn?.classList.remove("hidden"); // ✏️ εμφανίζει το κουμπί Rename Logs
    showBannedBtn?.classList.remove("hidden");
    showMutedBtn?.classList.remove("hidden");
    clearChatBtn?.classList.remove("hidden");
    clearGuestsBtn?.classList.remove("hidden");
    return;
  }

  // === Admins βλέπουν όλα εκτός από System ===
  if (isAdmin) {
    showBannedBtn?.classList.remove("hidden");
    showMutedBtn?.classList.remove("hidden");
    clearChatBtn?.classList.remove("hidden");
    clearGuestsBtn?.classList.remove("hidden");
    systemBtn?.classList.add("hidden");
    return;
  }

  // === Άλλοι χρήστες: κρύψε όλα ===
  [systemBtn, showBannedBtn, showMutedBtn, clearChatBtn, clearGuestsBtn].forEach(el => el?.classList.add("hidden"));
  // === Logout cleanup: απόκρυψη User Manager & κουμπιών ===
  const userManagerModal = document.getElementById("userManagerModal");
  const userManagerBtn   = document.getElementById("userManagerBtn");

  if (!user) {
    // Απόκρυψε όλα τα admin panels
    userManagerModal?.classList.add("hidden");
    document.body.classList.remove("modal-open");

    // Κρύψε τα admin κουμπιά
    userManagerBtn?.classList.add("hidden");
    systemBtn?.classList.add("hidden");
    showBannedBtn?.classList.add("hidden");
    showMutedBtn?.classList.add("hidden");
    clearChatBtn?.classList.add("hidden");
    clearGuestsBtn?.classList.add("hidden");
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
  const isOwner = (currentUserData.displayName || "").toLowerCase() === "mysteryman";
  if (user && isOwner) {
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
    type === "mute"  ? "#ff66cc" :
    type === "rename"? "#7ae4ff" : "#aaa";

  const time = new Date(log.createdAt || Date.now()).toLocaleString("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // === Ειδική εμφάνιση για RENAME ===
  if (type === "rename") {
    const oldName = log.oldName || "Unknown";
    const newName = log.newName || "Unknown";

    const el = document.createElement("div");
    el.classList.add("log-item");
    el.dataset.type = type;
    el.innerHTML = `
      <div><strong style="color:${color}">RENAME</strong> — ${oldName} → <span style="color:#7aff9c;">${newName}</span></div>
      <div class="muted">by: ${log.adminName || log.by || "unknown"}</div>
      <div class="muted small">${time}</div>
    `;

    logsContainer.prepend(el);
    logsContainer.scrollTop = logsContainer.scrollHeight;
    return; // ✅ σταματά εδώ, δεν συνεχίζει στο default layout
  }

  // === Default εμφάνιση για όλα τα υπόλοιπα ===
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


// ============================================================================
// SYSTEM LOGS — Clear Button (MysteryMan only)
// ============================================================================


const clearLogsBtn = document.getElementById("clearLogsBtn");

clearLogsBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  const isOwner = (currentUserData.displayName || "").toLowerCase() === "mysteryman";
  if (!user || !isOwner) return;
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

  const name = (currentUserData.displayName || "").toLowerCase();
  const role = currentUserData.role || "";
  const isAdmin = name === "mysteryman" || role === "admin";

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


// === BAN / KICK / MUTE USER ===
const menuBanUserBtn = document.getElementById("menuBanUserBtn");
if (menuBanUserBtn) {
  menuBanUserBtn.addEventListener("click", async () => {
    const confirmed = await convoConfirm("🚫 Θες σίγουρα να κάνεις BAN τον χρήστη;");

    if (!confirmed) return;

    try {
      await update(ref(db, "users/" + selectedUserUid), { banned: true });
      await push(ref(db, "adminLogs"), {
        type: "ban",
        targetUid: selectedUserUid,
        adminUid: auth.currentUser.uid,
        adminName: currentUserData.displayName || "Admin",
        createdAt: serverTimestamp()
      });

      convoAlert("✅ Ο χρήστης μπανίστηκε επιτυχώς!");

    } catch (err) {
      console.error("Ban error:", err);
convoAlert("❌ Ban failed — check console.");
    }
  });
}


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



// ======================================================
// 🧹 CLEAR GUESTS — Admin Only (MysteryMan)
// ======================================================

const clearGuestsBtn = document.getElementById("clearGuestsBtn");

// === Εμφάνιση κουμπιού μόνο για MysteryMan ===
auth.onAuthStateChanged((user) => {
  if (user && (user.displayName || "").toLowerCase() === "mysteryman") {
    clearGuestsBtn?.classList.remove("hidden");
  } else {
    clearGuestsBtn?.classList.add("hidden");
  }
});

// === Διαγραφή offline Guest χρηστών από /status ===
clearGuestsBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  const confirmClear = confirm("🧹 Θες να καθαρίσεις όλους τους OFFLINE guests;");
  if (!confirmClear) return;

  const usersRef = ref(db, "users");
  const snap = await get(usersRef);

  let deletedCount = 0;

  snap.forEach((child) => {
    const val = child.val() || {};
    const uid = child.key;

    const isOffline = !val.state || val.state === "offline";

    const isGuest =
      val.isAnonymous === true ||
      (val.displayName && val.displayName.toLowerCase().startsWith("guest"));

    if (isOffline && isGuest) {
      remove(ref(db, `users/${uid}`));
      remove(ref(db, `status/${uid}`)); // καθάρισε και από status
      deletedCount++;
    }
  });

convoAlert(`✅ Καθαρίστηκαν ${deletedCount} offline guests.`);

usersMap.clear();
renderList();

});
// ============================================================================
// 🧩 ADMIN TOOL — Rename User (Step 2 Part 2)
// ============================================================================



const renameUserBtn = document.getElementById("renameUserBtn");
if (renameUserBtn) {
  renameUserBtn.addEventListener("click", async () => {
    const currentUser = auth.currentUser;
if (!currentUser) return convoAlert("⚠️ Δεν είσαι συνδεδεμένος.");

if ((currentUserData.displayName || "") !== "MysteryMan") {
  return convoAlert("⛔ Μόνο οι admins μπορούν να μετονομάσουν χρήστες.");

}


    // 1️⃣ Ζήτα UID στόχου
const targetUid = await convoPrompt("🎯 Δώσε το UID του χρήστη που θέλεις να μετονομάσεις:");
    if (!targetUid) return;

    // 2️⃣ Ζήτα νέο nickname
const newName = await convoPrompt("✏️ Γράψε το νέο nickname για αυτόν τον χρήστη:");
    if (!newName || newName.length < 3 || newName.length > 20) {
return convoAlert("⚠️ Το όνομα πρέπει να έχει 3–20 χαρακτήρες.");
    }

    try {
      // === Ενημέρωση DB ===
      await update(ref(db, "users/" + targetUid), { displayName: newName });

      // === Log στο adminLogs ===
      // === Πάρε το παλιό όνομα από τη βάση ===
const oldSnap = await get(ref(db, "users/" + targetUid + "/displayName"));
const oldName = oldSnap.exists() ? oldSnap.val() : "Unknown";

// === Log rename με oldName/newName ===
await push(ref(db, "adminLogs"), {
  type: "rename",
  targetUid,
  oldName,
  newName,
  adminUid: currentUser.uid,
  adminName: currentUser.displayName,
  action: "rename",
  createdAt: serverTimestamp(),
});



      await convoAlert(`✅ Ο χρήστης με UID ${targetUid} μετονομάστηκε σε ${newName}.`);

      console.log("🪶 Rename OK:", targetUid, "→", newName);
    } catch (err) {
      console.error("❌ Rename error:", err);
 convoAlert("❌ Αποτυχία ενημέρωσης: " + err.message);

    }
  });
}
// ===============================================================
// 💬 Private Tabs — Layout Init (Part A.2)
// ===============================================================
initPrivateTabs();

// ============================================================================
// 🚪 Kick Check Listener — πετάει τον χρήστη έξω αν γίνει kick
// ============================================================================


onAuthStateChanged(auth, (user) => {
  if (!user) return;

  // Αφαίρεση παλιού listener για ασφάλεια
  if (window._kickListenerRef) dbOff(window._kickListenerRef);

  // Παρακολούθηση kick state για τον τρέχοντα χρήστη
  const kickRef = ref(db, `v3/rooms/general/kicks/${user.uid}`);
  window._kickListenerRef = kickRef;

  onValue(kickRef, async (snap) => {
  if (snap.exists() && snap.val() === true) {
    convoAlert("👢 Έχεις αποβληθεί προσωρινά από αυτό το room!");


    // 🔹 Σβήσε το kick flag (one-time kick)
    await set(kickRef, null);

    // 🔹 Καθάρισε local state & κάνε reload
    localStorage.removeItem("lastRoom");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }
});

});

// ============================================================================
// 🧹 Fix YouTube Ghost Panel (Login Screen Bug)
// ============================================================================
onAuthStateChanged(auth, (user) => {
  const ytPanel = document.getElementById("youtubePanel");
  const ytIcon  = document.getElementById("youtubeToggle");

  // 🧩 Αν δεν υπάρχει user (Login/Register screen)
  if (!user) {
    if (ytPanel) ytPanel.style.display = "none";
    if (ytIcon) ytIcon.style.display = "none";

    // 🧹 Καθάρισε αποθηκευμένο video & iframe
    localStorage.removeItem("lastYouTubeVideo");
    const iframe = ytPanel?.querySelector("iframe");
    if (iframe) iframe.src = "";

    console.log("🧹 YouTube panel hidden on login screen");
  } else {
    // ✅ Επανέφερε το εικονίδιο μετά το login
    if (ytIcon) ytIcon.style.display = "block";
  }
});
// ============================================================================
// 🫂 FRIEND REQUESTS PANEL — Open / Close Logic (Step 2)
// ============================================================================
const friendReqBtn = document.getElementById("friendReqBtn");
const friendReqPanel = document.getElementById("friendReqPanel");
const closeFriendReqBtn = document.getElementById("closeFriendReqBtn");

// === Εμφάνιση κουμπιού μόνο μετά το login ===
onAuthStateChanged(auth, (user) => {
  if (user) {
    friendReqBtn?.classList.remove("hidden");
  } else {
    friendReqBtn?.classList.add("hidden");
    friendReqPanel?.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
});

// === Άνοιγμα Panel ===
friendReqBtn?.addEventListener("click", () => {
  friendReqPanel?.classList.remove("hidden");
  document.body.classList.add("modal-open");
});

// === Κλείσιμο με ✖ ===
closeFriendReqBtn?.addEventListener("click", () => {
  friendReqPanel?.classList.add("hidden");
  document.body.classList.remove("modal-open");
});

// === Κλείσιμο με click έξω από το box ===
friendReqPanel?.addEventListener("click", (e) => {
  if (e.target === friendReqPanel) {
    friendReqPanel.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
});

// === Κλείσιμο με Esc ===
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !friendReqPanel.classList.contains("hidden")) {
    friendReqPanel.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
});
// ============================================================================
// 🫂 FRIEND REQUESTS — Live List & Notification Dot (Step 3)
// ============================================================================
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  const uid = user.uid;
  const reqRef = ref(db, `friendRequests/${uid}`);

  const listEl = document.getElementById("friendReqList");
  const dotEl = document.getElementById("friendReqDot");

  // Καθάρισε τυχόν προηγούμενο listener
  off(reqRef);

  // 1️⃣ Realtime listener
  onValue(reqRef, (snap) => {
    listEl.innerHTML = "";
    if (!snap.exists()) {
      listEl.innerHTML = `<p class="muted">Δεν υπάρχουν αιτήματα φιλίας.</p>`;
      dotEl.classList.add("hidden");
      return;
    }

    // 2️⃣ Δημιουργία λίστας
    const requests = Object.values(snap.val());
    requests.reverse().forEach((req) => {
      const item = document.createElement("div");
      item.className = "friend-req-item";
      item.innerHTML = `
        <div><strong>${req.fromName}</strong> θέλει να γίνει φίλος σου 💫</div>
        <div class="actions">
          <button class="btn small success" data-uid="${req.fromUid}" data-action="accept">Αποδοχή</button>
          <button class="btn small danger" data-uid="${req.fromUid}" data-action="reject">Απόρριψη</button>
        </div>
      `;
      listEl.prepend(item);
    });

    // 3️⃣ Εμφάνιση κουκίδας ειδοποίησης
    dotEl.classList.remove("hidden");
  });

  // 4️⃣ Click actions (accept / reject)
  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const fromUid = btn.dataset.uid;
    const item = btn.closest(".friend-req-item");

    if (action === "accept") {
      // ➕ Πρόσθεσε αμοιβαία φιλία
      await set(ref(db, `friends/${uid}/${fromUid}`), true);
await set(ref(db, `friends/${fromUid}/${uid}`), true);

      convoAlert("🎉 Αποδέχθηκες το αίτημα!");
    } else {
      convoAlert("🚫 Το αίτημα απορρίφθηκε.");
    }

    // ❌ Αφαίρεσε το αίτημα
    await remove(ref(db, `friendRequests/${uid}/${fromUid}`));

    item.remove();
    if (!listEl.children.length) {
      listEl.innerHTML = `<p class="muted">Δεν υπάρχουν αιτήματα φιλίας.</p>`;
      dotEl.classList.add("hidden");
    }
  });
});



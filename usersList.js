// ============================================================================
// USERS LIST — Step 6A (Role Categories + You Marker)
// ============================================================================
import {
  ref,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onValue,
  get,
  push,
  update,
  set,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { showConvoAlert, showConvoPrompt } from "./app.js";


import { db, auth } from "./firebaseInit.js";
import { watchTyping } from "./typing.js";

const usersListEl = document.getElementById("usersList");
let currentFilter = "all";

const usersCountEl = document.getElementById("usersCount");

// Κρατάμε state τοπικά (uid -> {displayName, state, role})
const usersMap = new Map();
let roomMutes = new Set();

const typingState = new Map();

function isAdminView() {
  const current = auth.currentUser;
  if (!current) return false;
  const role = usersMap.get(current.uid)?.role || "user";
  return role === "admin";
}

function renderList() {
  if (!usersListEl) return;

  const arr = Array.from(usersMap, ([uid, v]) => ({ uid, ...v }));

  
  // === Δημιουργία ομάδων ===
  const groups = { admins: [], vips: [], users: [], offline: [] };

  arr.forEach(u => {
  const name = u.displayName || "Guest";
  const role = (u.role || "user").toString().toLowerCase().trim();
  const isOnline = u.state === "online";
  const isYou = auth.currentUser && u.uid === auth.currentUser.uid;


  if (isOnline) {
    if (role === "admin") {
      groups.admins.push(u.uid);
    } else if (role === "vip") {
      groups.vips.push(u.uid);
    } else {
      groups.users.push(u.uid);
    }
  } else {
    groups.offline.push(u.uid);
  }
});


// === Δημιουργία HTML για κάθε ομάδα ===
const makeSection = (title, css, list) =>
  list.length
    ? `
      <div class="user-group">
        <div class="user-group-title ${css}">${title}</div>
        ${list
          .map(uid => {
            const u = usersMap.get(uid);
            if (!u) return "";

            const badge =
              u.role === "admin"
                ? `<span class="role-badge admin" title="Admin">🛡️</span>`
                : u.role === "vip"
                ? `<span class="role-badge vip" title="VIP">⭐</span>`
                : "";

            // === Mute & Ban icons ===
            const isMutedHere = roomMutes.has(uid);
            const bannedIcon  = u.banned ? `<span class="banned-icon" title="Banned">✋</span>` : "";
            const mutedIcon   = isMutedHere ? `<span class="muted-icon" title="Muted in this room">🔇</span>` : "";

            const isYou = auth.currentUser && uid === auth.currentUser.uid;
            const label = isYou ? `${u.displayName || "Guest"} (You)` : u.displayName || "Guest";

            const isTyping = typingState.get(uid);
            const typingHtml = isTyping ? `<div class="typing-indicator">✏️ Typing...</div>` : "";
            const dotClass = u.state === "online" ? "dot online" : "dot offline";

            return `
              <div class="user-item${isMutedHere ? ' muted' : ''}" data-uid="${uid}">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span class="${dotClass}"></span>
                  <div class="user-name">
                    ${label} ${badge} ${bannedIcon} ${mutedIcon}
                  </div>
                </div>
                ${typingHtml}
              </div>
            `;
          })
          .join("")}
      </div>`
    : "";

  
    // === Νέα διάταξη ===
// Online ρόλοι πρώτοι, offline όλοι στο τέλος
usersListEl.innerHTML =
  makeSection("Admins (Online)", "admin", groups.admins) +
  makeSection("VIPs (Online)", "vip", groups.vips) +
  makeSection("Users (Online)", "user", groups.users) +
  makeSection("Offline", "offline", groups.offline);


  // === Counter ===
  if (usersCountEl)
    usersCountEl.textContent = String(arr.filter(x => x.state === "online").length);
}

// ============================================================================
// INIT LISTENERS
// ============================================================================
export function initUsersList() {
  
  let statusLoaded = false;
let rolesLoaded  = false;

  const statusRef = ref(db, "status");

 onChildAdded(statusRef, snap => {
  const val = snap.val() || {};
  usersMap.set(snap.key, {
    displayName: val.displayName || "Guest",
    state: val.state || "offline",
    role: val.role || "user"
  });

  statusLoaded = true;
  if (statusLoaded && rolesLoaded) renderList();
});


onChildChanged(statusRef, snap => {
  const val = snap.val() || {};
  const uid = snap.key;
  const prev = usersMap.get(uid) || {};

  usersMap.set(uid, {
    displayName: val.displayName || prev.displayName || "Guest",
    state: val.state || prev.state || "offline",
    role: prev.role || "user"
  });

  
  renderList();
});


  onChildRemoved(statusRef, snap => {
    usersMap.delete(snap.key);
    renderList();
  });
// === Listen for roles from /users ===
const usersRef = ref(db, "users");

onChildAdded(usersRef, snap => {
  const val = snap.val() || {};
  const uid = snap.key;

  if (usersMap.has(uid)) {
    const prev = usersMap.get(uid);
    usersMap.set(uid, {
      ...prev,
      displayName: val.displayName || prev.displayName || "Guest",
      role: val.role || prev.role || "user",
      banned: val.banned || false,   // 👈 κόμμα εδώ
      muted: val.muted || false      // 👈 νέο πεδίο
    });
  } else {
    usersMap.set(uid, {
      displayName: val.displayName || "Guest",
      state: "offline",
      role: val.role || "user",
      banned: val.banned || false,   // 👈 κόμμα εδώ
      muted: val.muted || false      // 👈 νέο πεδίο
    });
  }

  rolesLoaded = true;
  if (statusLoaded && rolesLoaded) renderList();
});


onChildChanged(usersRef, snap => {
  const val = snap.val() || {};
  const prev = usersMap.get(snap.key) || {};
  usersMap.set(snap.key, {
    ...prev,
    role: val.role || prev.role || "user",
    banned: val.banned || false,
    muted: val.muted || false
  });
  renderList();
});


// === Final check: make sure both data sets loaded ===
if (!statusLoaded || !rolesLoaded) {
  const checkReady = setInterval(() => {
    if (statusLoaded && rolesLoaded) {
      clearInterval(checkReady);
      renderList();
      console.log("🛡️ Admins synced successfully");
    }
  }, 100);
}

console.log("👥 Users list listener ready");

}
// === Listen per-room mutes (SAFE + Auto-refresh) ===
function listenRoomMutes() {
  const activeRoom = window.currentRoom || localStorage.getItem("lastRoom") || "general";
  const mutesPath = ref(db, `v3/rooms/${activeRoom}/mutes`);

  // Καθάρισε προηγούμενο listener (προληπτικά)
  if (window._mutesUnsubscribe) window._mutesUnsubscribe();

  const unsubscribe = onValue(mutesPath, (snap) => {
    roomMutes = new Set();
    if (snap.exists()) {
  snap.forEach((child) => {
    const val = child.val();
    if (val === true || val?.value === true) {
      roomMutes.add(child.key);
    }
  });
}

    renderList();
  });

  // Αποθήκευση για clean reattach
  window._mutesUnsubscribe = () => unsubscribe();
}

// 🟢 Περιμένουμε λίγο να φορτώσει το currentRoom πριν το πρώτο attach
window.addEventListener("load", () => {
  setTimeout(listenRoomMutes, 1000); // τρέχει 1s μετά τη φόρτωση
});

// 🔁 Όταν αλλάζει room, ξανατρέξε τον listener
window.addEventListener("roomChanged", listenRoomMutes);

// === Typing watcher ===
watchTyping((map) => {
  for (const [uid, val] of map.entries()) {
    typingState.set(uid, val);
  }
  renderList();
});

// ============================================================================
// ADMIN CONTEXT MENU (Step 8 Part A – Clean + Safe Version)
// ============================================================================
const contextMenu = document.createElement("div");
contextMenu.id = "adminContextMenu";
contextMenu.className = "hidden";
contextMenu.innerHTML = `
  <button id="ctxBanUser">🚫 Ban User</button>
  <button id="ctxUnbanUser">✅ Unban User</button>
  <button id="ctxKickUser">👢 Kick User</button>
    <button id="ctxMuteUser">🔇 Mute User</button>
  

`;

document.body.appendChild(contextMenu);

// === Δεξί κλικ μόνο πάνω σε χρήστη (όχι στο background) ===

if (usersListEl) {
  usersListEl.addEventListener("contextmenu", (e) => {
    const item = e.target.closest(".user-item");
    if (!item) return; // ⛔ Αν δεν πάτησες πάνω σε user, μην ανοίγεις menu

    e.preventDefault();

    const currentUser = auth.currentUser;
    const currentUserRole = usersMap.get(currentUser?.uid)?.role || "user";
    const isAdmin = currentUser && currentUserRole === "admin";
    const targetUid = item.dataset.uid;

    if (!isAdmin) return;
    if (currentUser && currentUser.uid === targetUid) return;

    // === Highlight και εμφάνιση menu ===
    document.querySelectorAll(".user-item.highlight").forEach(el => el.classList.remove("highlight"));
    item.classList.add("highlight");

    contextMenu.dataset.uid = targetUid;
    contextMenu.style.display = "flex";
    contextMenu.classList.remove("hidden");

    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    let posX = e.pageX;
    let posY = e.pageY;
    if (posX + menuWidth > screenW) posX = screenW - menuWidth - 10;
    if (posY + menuHeight > screenH) posY = screenH - menuHeight - 10;

    contextMenu.style.left = posX + "px";
    contextMenu.style.top = posY + "px";
  });
}



// === Κλικ εκτός ή Esc => κλείσιμο ===
document.addEventListener("click", (e) => {
  if (!e.target.closest("#adminContextMenu")) {
    contextMenu.classList.add("hidden");
    document.querySelectorAll(".user-item.highlight").forEach(el => el.classList.remove("highlight"));
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    contextMenu.classList.add("hidden");
    document.querySelectorAll(".user-item.highlight").forEach(el => el.classList.remove("highlight"));
  }
});

// ============================================================================
// CONTEXT MENU ACTIONS (Step 8 Part D – Kick User Logic)
// ============================================================================
contextMenu.addEventListener("click", async (e) => {
  const uid = contextMenu.dataset.uid;
  if (!uid) return;

  // === BAN USER ===
if (e.target.id === "ctxBanUser") {
  const resBan = await showConvoPrompt(`⚠️ Θες να κάνεις ban αυτόν τον χρήστη;`);
  if (resBan !== "ok") return;

  // 🔒 Role protection
  if (await isProtectedUser(uid)) {
    showConvoAlert("⛔ Δεν μπορείς να κάνεις ban άλλον admin ή moderator.");
    return;
  }

  try {
    // --- Πάρε αξιόπιστα το displayName ---
    let displayName = usersMap.get(uid)?.displayName;

    // 1) Αν δεν υπάρχει στο usersMap, δοκίμασε από /status
    if (!displayName) {
      const sSnap = await get(ref(db, `status/${uid}/displayName`));
      if (sSnap.exists()) displayName = sSnap.val();
    }
    // 2) Αν πάλι δεν βρεις, δοκίμασε από /users
    if (!displayName) {
      const uSnap = await get(ref(db, `users/${uid}/displayName`));
      if (uSnap.exists()) displayName = uSnap.val();
    }
    if (!displayName) displayName = "Unknown User";

    // ✅ Αποθήκευση banned = true + διασφάλιση του displayName
    await update(ref(db, `users/${uid}`), {
      banned: true,
      displayName
    });

    // ✅ Καταγραφή στο adminLogs με σωστό όνομα
    await push(ref(db, "adminLogs"), {
      type: "ban",
      targetUid: uid,
      targetName: displayName,
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      action: "ban",
      room: "pendingRoomSystem",
      createdAt: serverTimestamp(),
    });

    showConvoAlert(`✅ Ο χρήστης "${displayName}" έγινε ban και καταγράφηκε.`);
  } catch (err) {
    console.error("Ban error:", err);
    showConvoAlert("❌ Αποτυχία ban — δες κονσόλα.");
  }
}



  // === KICK USER (live disconnect) ===
if (e.target.id === "ctxKickUser") {
  console.log("🟡 Kick clicked");

  // === 1 Bubble: Reason input ===
  const reason = await showConvoPrompt("💬 Πληκτρολόγησε reason για kick:", {
  placeholder: "π.χ. spam, toxicity..."
});

  if (!reason) {
    console.warn("⚠️ Kick cancelled (no reason)");
    return;
  }

  const kickReason = reason.trim();

  // 🔒 Προστασία για admins / moderators
  if (await isProtectedUser(uid)) {
    showConvoAlert("⛔ Δεν μπορείς να κάνεις kick άλλον admin ή moderator.");
    return;
  }

  try {
    // === Kick entry στη βάση ===
    await set(ref(db, "kicks/" + uid), {
      kickedBy: auth.currentUser.displayName || "Admin",
      reason: kickReason,
      createdAt: serverTimestamp(),
    });

    // === Καταγραφή στο adminLogs ===
    await push(ref(db, "adminLogs"), {
      type: "kick",
      targetUid: uid,
      targetName: usersMap.get(uid)?.displayName || "Unknown User",
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      action: "kick",
      reason: kickReason,
      room: "pendingRoomSystem",
      createdAt: serverTimestamp(),
    });

    showConvoAlert(`👢 Ο χρήστης έγινε kick.\n📝 Λόγος: ${kickReason}`);
  } catch (err) {
    console.error("Kick error:", err);
    showConvoAlert("❌ Αποτυχία kick — δες κονσόλα.");
  }
}



  
    // === UNBAN USER ===
if (e.target.id === "ctxUnbanUser") {
  const resUnban = await showConvoPrompt(`✅ Θες να κάνεις unban αυτόν τον χρήστη;`);
  if (resUnban !== "ok") return;

  if (await isProtectedUser(uid)) {
    showConvoAlert("⛔ Δεν μπορείς να κάνεις unban άλλον admin ή moderator.");
    return;
  }

  try {
    await update(ref(db, "users/" + uid), { banned: false });

    await push(ref(db, "adminLogs"), {
      type: "unban",
      targetUid: uid,
      targetName: usersMap.get(uid)?.displayName || "Unknown User",
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      action: "unban",
      room: "pendingRoomSystem",
      createdAt: serverTimestamp(),
    });

    showConvoAlert("✅ Ο χρήστης έγινε unban και καταγράφηκε.");
  } catch (err) {
    console.error("Unban error:", err);
    showConvoAlert("❌ Αποτυχία unban — δες κονσόλα.");
  }
}

  // === MUTE USER (Convo Bubble) ===
if (e.target.id === "ctxMuteUser") {
  const confirmMute = await showConvoPrompt(`🔇 Θες να κάνεις mute αυτόν τον χρήστη;`);
  if (confirmMute !== "ok") return;

  const roomName = window.currentRoom || localStorage.getItem("lastRoom") || "general";

  // === γράψε το mute στο Firebase (με set, όχι update) ===
  await set(ref(db, `v3/rooms/${roomName}/mutes/${uid}`), true);

  await push(ref(db, "adminLogs"), {
    type: "mute",
    targetUid: uid,
    targetName: usersMap.get(uid)?.displayName || "Unknown",
    adminUid: auth.currentUser.uid,
    adminName: auth.currentUser.displayName || "Admin",
    action: "mute",
    room: roomName,
    createdAt: serverTimestamp(),
  });

  showConvoAlert(`🔇 Ο χρήστης έγινε mute επιτυχώς.`);
}


// === Helper: Έλεγχος προστατευμένων χρηστών (Admins / VIP / Self) ===
async function isProtectedUser(uid) {
  const current = auth.currentUser;
  if (!current) return false;

  // Μην αφήνεις να κάνει kick/ban τον εαυτό του ή τον MysteryMan
  if (uid === current.uid) return true;
  const target = usersMap.get(uid);
  if (!target) return false;

  const name = (target.displayName || "").toLowerCase();
  return (
    name === "mysteryman" ||
    name.includes("admin") ||
    name.includes("moderator")
  );
}
// ============================================================================
// BANNED USERS
// ============================================================================




// === Elements ===
const bannedBtn = document.getElementById("showBannedBtn");
const bannedModal = document.getElementById("bannedModal");
const bannedList = document.getElementById("bannedUsersList");
const closeBannedBtn = document.getElementById("closeBannedBtn");

// === Open Modal ===
if (bannedBtn) {
  bannedBtn.addEventListener("click", () => {
    bannedModal.classList.remove("hidden");
    loadBannedUsers();
  });
}

// === Close Modal ===
if (closeBannedBtn) {
  closeBannedBtn.addEventListener("click", () => {
    bannedModal.classList.add("hidden");
  });
}

// === Load Banned Users ===
function loadBannedUsers() {
  const usersRef = ref(db, "/users");

  onValue(usersRef, (snap) => {
    bannedList.innerHTML = "";

    if (!snap.exists()) {
      bannedList.innerHTML = "<p class='muted'>⚠️ Δεν βρέθηκαν χρήστες.</p>";
      return;
    }

    let found = false;

    snap.forEach((child) => {
      const user = child.val();
      const uid = child.key;
      console.log("👁️ User check:", uid, "banned =", user.banned, "type =", typeof user.banned);


      // ✅ Αν ο χρήστης είναι banned
      if (user.banned === true || user.banned === "true") {

        found = true;
        const div = document.createElement("div");
        div.className = "banned-item";
        div.innerHTML = `
          <span>🚫 ${user.displayName || "Unknown User"}</span>
          <button data-uid="${uid}" class="unban-btn">Unban</button>
        `;
        bannedList.appendChild(div);
      }
    });

    if (!found) {
      bannedList.innerHTML = "<p class='muted'>✅ Δεν υπάρχουν banned χρήστες.</p>";
    }

    // === Unban click actions ===
    bannedList.querySelectorAll(".unban-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const uid = e.target.dataset.uid;
        const res = await showConvoPrompt(`✅ Θες να κάνεις unban αυτόν τον χρήστη;`);
        if (res !== "ok") return;
        await update(ref(db, `users/${uid}`), { banned: false });
        showConvoAlert("✅ Ο χρήστης έγινε unban.");
          });
    });
  });
} // ✅ κλείνει τη loadBannedUsers

}); // ✅ κλείνει το contextMenu.addEventListener("click", async (e) => { ... })

// ✅ τέλος αρχείου usersList.js
// ============================================================================
// MUTED USERS (New Modal)
// ============================================================================

// === Elements ===
const mutedBtn = document.getElementById("showMutedBtn");
const mutedModal = document.getElementById("mutedModal");
const mutedList = document.getElementById("mutedUsersList");
const closeMutedBtn = document.getElementById("closeMutedBtn");

// === Open Modal ===
if (mutedBtn) {
  mutedBtn.addEventListener("click", () => {
    mutedModal.classList.remove("hidden");
    loadMutedUsers();
  });
}

// === Close Modal ===
if (closeMutedBtn) {
  closeMutedBtn.addEventListener("click", () => {
    mutedModal.classList.add("hidden");
  });
}

// === Load Muted Users (per room) ===
function loadMutedUsers() {
  const room = window.currentRoom || localStorage.getItem("lastRoom") || "general";
  const mutedRef = ref(db, `v3/rooms/${room}/mutes`);

  onValue(mutedRef, (snap) => {
    mutedList.innerHTML = "";

    if (!snap.exists()) {
      mutedList.innerHTML = "<p class='muted'>✅ Δεν υπάρχουν muted χρήστες σε αυτό το room.</p>";
      return;
    }

    snap.forEach((child) => {
      const uid = child.key;
const user = usersMap.get(uid);
const name = user?.displayName || uid;

const div = document.createElement("div");
div.className = "banned-item";
div.innerHTML = `
  <span>🔇 ${name}</span>
  <button data-uid="${uid}" class="unmute-btn">Unmute</button>
`;

      mutedList.appendChild(div);
    });

    mutedList.querySelectorAll(".unmute-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const uid = e.target.dataset.uid;
        const confirmUnmute = await showConvoPrompt(`🔈 Θες να κάνεις unmute αυτόν τον χρήστη;`);
        if (confirmUnmute !== "ok") return;
        await set(ref(db, `v3/rooms/${room}/mutes/${uid}`), null);

        const displayName = usersMap.get(uid)?.displayName || "Unknown User";

await push(ref(db, "adminLogs"), {
  type: "unmute",
  targetUid: uid,
  targetName: displayName,
  adminUid: auth.currentUser.uid,
  adminName: auth.currentUser.displayName || "Admin",
  action: "unmute",
  room,
  createdAt: serverTimestamp(),
});

        showConvoAlert("🔈 Ο χρήστης έγινε unmute.");
      });
    });
  });
}

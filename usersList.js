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


import { db, auth } from "./firebaseInit.js";
import { watchTyping } from "./typing.js";

const usersListEl = document.getElementById("usersList");
const usersCountEl = document.getElementById("usersCount");

// Κρατάμε state τοπικά (uid -> {displayName, state, role})
const usersMap = new Map();
const typingState = new Map();


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
       const badge =
  u.role === "admin"
    ? `<span class="role-badge admin" title="Admin">🛡️</span>`
    : u.role === "vip"
    ? `<span class="role-badge vip" title="VIP">⭐</span>`
    : "";
const bannedIcon = u.banned ? `<span class="banned-icon" title="Banned">✋</span>` : "";
const mutedIcon = u.muted ? `<span class="muted-icon" title="Muted">🔇</span>` : "";


              if (!u) return "";
              const isYou = auth.currentUser && uid === auth.currentUser.uid;
              const label = isYou ? `${u.displayName || "Guest"} (You)` : u.displayName || "Guest";
              const isTyping = typingState.get(uid);
              const typingHtml = isTyping ? `<div class="typing-indicator">✏️ Typing...</div>` : "";
              const dotClass = u.state === "online" ? "dot online" : "dot offline";
              return `
                <div class="user-item" data-uid="${uid}">
                <div class="user-item${u.muted ? ' muted' : ''}" data-uid="${uid}">

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
  <button id="ctxUnmuteUser">🔈 Unmute User</button>

`;

document.body.appendChild(contextMenu);

// === Δεξί κλικ σε όνομα χρήστη (μόνο για Admin + ασφαλή τοποθέτηση) ===
document.addEventListener("contextmenu", (e) => {
  const userItem = e.target.closest(".user-item");
  if (!userItem) return;

  const currentUser = auth.currentUser;
  const currentUserRole = usersMap.get(currentUser?.uid)?.role || "user";

const isAdmin = currentUser && currentUserRole === "admin";
  const targetUid = userItem.dataset.uid;

  if (!isAdmin) return;
  if (currentUser && currentUser.uid === targetUid) return;

  e.preventDefault();

  // === 🔹 Highlight το user-item που έγινε δεξί κλικ ===
  document.querySelectorAll(".user-item.highlight").forEach(el => el.classList.remove("highlight"));
  userItem.classList.add("highlight");

  // === Εμφάνιση menu με ασφαλή τοποθέτηση ===
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


// ============================================================================
// CONTEXT MENU ACTIONS (Step 8 Part E – Role Protection)
// ============================================================================
contextMenu.addEventListener("click", async (e) => {
  if (e.target.tagName !== "BUTTON") return;
  const uid = contextMenu.dataset.uid;
  contextMenu.classList.add("hidden");

  // === Check target role before action ===
  async function isProtectedUser(uid) {
    try {
      const snap = await get(ref(db, "users/" + uid + "/role"));
      const role = snap.val();
      return role === "admin" || role === "mod";
    } catch (err) {
      console.error("Role check error:", err);
      return false;
    }
  }

  // === BAN USER ===
  if (e.target.id === "ctxBanUser") {
    if (!confirm(`⚠️ Ban this user?\n\nUID: ${uid}`)) return;

    // 🔒 Role protection
    if (await isProtectedUser(uid)) {
      alert("⛔ You cannot ban another admin or moderator.");
      return;
    }

    try {
      await update(ref(db, "users/" + uid), { banned: true });

await push(ref(db, "adminLogs"), {
  type: "ban",                   // ή ban, unban, kick
  targetUid: uid,
  targetName: usersMap.get(uid)?.displayName || "Unknown User",
  adminUid: auth.currentUser.uid,
  adminName: auth.currentUser.displayName || "Admin",
  action: "ban",                 // ή unmute, ban, κλπ
  room: "pendingRoomSystem",      // 🏷️ προσωρινό μέχρι να ενεργοποιηθούν τα rooms
  createdAt: serverTimestamp(),
});


      alert("✅ User has been banned and logged.");
    } catch (err) {
      console.error("Ban error:", err);
      alert("❌ Ban failed — check console.");
    }
  }

  // === KICK USER (live disconnect) ===
  if (e.target.id === "ctxKickUser") {
    if (!confirm(`👢 Kick this user (force logout)?\n\nUID: ${uid}`)) return;

    // 🔒 Role protection
    if (await isProtectedUser(uid)) {
      alert("⛔ You cannot kick another admin or moderator.");
      return;
    }

    try {
      await set(ref(db, "kicks/" + uid), {
        kickedBy: auth.currentUser.displayName || "Admin",
        createdAt: serverTimestamp(),
      });

      await push(ref(db, "adminLogs"), {
  type: "kick",                   // ή ban, unban, kick
  targetUid: uid,
  targetName: usersMap.get(uid)?.displayName || "Unknown User",
  adminUid: auth.currentUser.uid,
  adminName: auth.currentUser.displayName || "Admin",
  action: "kick",                 // ή unmute, ban, κλπ
  room: "pendingRoomSystem",      // 🏷️ προσωρινό μέχρι να ενεργοποιηθούν τα rooms
  createdAt: serverTimestamp(),
});


      alert("👢 User has been kicked (they will disconnect now).");
    } catch (err) {
      console.error("Kick error:", err);
      alert("❌ Kick failed — check console.");
    }
  }
    // === UNBAN USER ===
  if (e.target.id === "ctxUnbanUser") {
    if (!confirm(`✅ Unban this user?\n\nUID: ${uid}`)) return;

    if (await isProtectedUser(uid)) {
      alert("⛔ You cannot unban another admin or moderator.");
      return;
    }

    try {
      await update(ref(db, "users/" + uid), { banned: false });

      await push(ref(db, "adminLogs"), {
  type: "unban",                   // ή ban, unban, kick
  targetUid: uid,
  targetName: usersMap.get(uid)?.displayName || "Unknown User",
  adminUid: auth.currentUser.uid,
  adminName: auth.currentUser.displayName || "Admin",
  action: "unban",                 // ή unmute, ban, κλπ
  room: "pendingRoomSystem",      // 🏷️ προσωρινό μέχρι να ενεργοποιηθούν τα rooms
  createdAt: serverTimestamp(),
});

      alert("✅ User has been unbanned and logged.");
    } catch (err) {
      console.error("Unban error:", err);
      alert("❌ Unban failed — check console.");
    }
  }
  // === MUTE USER ===
  if (e.target.id === "ctxMuteUser") {
    if (!confirm(`🔇 Mute this user?\n\nUID: ${uid}`)) return;

    // 🔒 Role protection
    if (await isProtectedUser(uid)) {
      alert("⛔ You cannot mute another admin or moderator.");
      return;
    }

    try {
      await update(ref(db, "users/" + uid), { muted: true });

await push(ref(db, "adminLogs"), {
  type: "mute",                   // ή ban, unban, kick
  targetUid: uid,
  targetName: usersMap.get(uid)?.displayName || "Unknown User",
  adminUid: auth.currentUser.uid,
  adminName: auth.currentUser.displayName || "Admin",
  action: "mute",                 // ή unmute, ban, κλπ
  room: "pendingRoomSystem",      // 🏷️ προσωρινό μέχρι να ενεργοποιηθούν τα rooms
  createdAt: serverTimestamp(),
});

      alert("🔇 User muted successfully.");
    } catch (err) {
      console.error("Mute error:", err);
      alert("❌ Mute failed — check console.");
    }
  }

  // === UNMUTE USER ===
  if (e.target.id === "ctxUnmuteUser") {
    if (!confirm(`🔈 Unmute this user?\n\nUID: ${uid}`)) return;

    if (await isProtectedUser(uid)) {
      alert("⛔ You cannot unmute another admin or moderator.");
      return;
    }

    try {
      await update(ref(db, "users/" + uid), { muted: false });

await push(ref(db, "adminLogs"), {
  type: "mute",                   // ή ban, unban, kick
  targetUid: uid,
  targetName: usersMap.get(uid)?.displayName || "Unknown User",
  adminUid: auth.currentUser.uid,
  adminName: auth.currentUser.displayName || "Admin",
  action: "unmute",                 // ή unmute, ban, κλπ
  room: "pendingRoomSystem",      // 🏷️ προσωρινό μέχρι να ενεργοποιηθούν τα rooms
  createdAt: serverTimestamp(),
});

      alert("🔈 User unmuted successfully.");
    } catch (err) {
      console.error("Unmute error:", err);
      alert("❌ Unmute failed — check console.");
    }
  }

}); // ✅ <--- Κλείνει σωστά το event listener

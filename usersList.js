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
  remove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

import { convoAlert, convoConfirm, convoPrompt } from "./convoAlerts.js";
import { showFriendProfileExpanded } from "./profileModal.js";

import { db, auth } from "./firebaseInit.js";
import { getUserAvatarHTML } from "./avatarSystem.js";
import { openPrivateChat } from "./privateTabs.js";

import { watchTyping } from "./typing.js";
import { currentUserData } from "./currentUser.js";


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
  // === Έλεγχος κατάστασης ===
const state = (u.state || "").toLowerCase();
const isOnline = state === "online" || state.startsWith("away");

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

// === Δημιουργία section που δείχνει ΠΑΝΤΑ header + counter ===
const makeSection = (title, css, list, count) => `
  <div class="user-group">
    <div class="user-group-title ${css}">${title} (${count})</div>
    ${
      list
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
// === Status Dot Color Logic ===
let dotColor = "#999"; // default grey
let dotTitle = "offline";

if (u.state === "online") {
  dotColor = "#4ade80"; // 🟢
  dotTitle = "online";
} else if (u.state?.toLowerCase().startsWith("away")) {
  dotColor = "#ffb347"; // 🟠
  dotTitle = u.state;   // π.χ. away — coffee
} else if (u.state === "offline") {
  dotColor = "#ef4444"; // 🔴
  dotTitle = "offline";
}

// === Tooltip πάνω στην τελίτσα ===
const dotHTML = `
  <span 
    class="status-dot" 
    style="background-color:${dotColor};" 
    title="${dotTitle}">
  </span>`;

            return `
  <div class="user-item${isMutedHere ? ' muted' : ''}" data-uid="${uid}">
    <div style="display:flex; align-items:center; gap:6px; position:relative;">
      ${getUserAvatarHTML(u)}
${dotHTML}
      <div class="user-name-role">
  <div class="user-name-row">
    <span class="user-label">${label}</span>
    ${badge} ${bannedIcon} ${mutedIcon}
  </div>
  <div class="user-status-text ${u.state?.split(" ")[0] || "offline"}">
    ${u.state || "offline"}
  </div>
</div>



      <!-- 💬 Private Chat button (εμφανίζεται σε hover) -->
      <button class="private-chat-btn hidden" data-uid="${uid}" data-name="${u.displayName || "User"}">💬</button>
    </div>
    ${typingHtml}
  </div>
`;

        })
        .join("")}
  </div>`; // ✅ Κλείσιμο template literal και map


  
    // === Νέα διάταξη ===
usersListEl.innerHTML =
  makeSection("ADMINS",  "admin",   groups.admins,  groups.admins.length) +
  makeSection("VIPS",    "vip",     groups.vips,    groups.vips.length)   +
  makeSection("USERS",   "user",    groups.users,   groups.users.length)  +
  makeSection("OFFLINE", "offline", groups.offline, groups.offline.length);


  // === Counter ===
  if (usersCountEl)
    usersCountEl.textContent = String(arr.filter(x => x.state === "online").length);
}

// ============================================================================
// 💬 Hover + Click για Private Chat
// ============================================================================
if (usersListEl) {
  // Εμφάνιση κουμπιού μόνο σε hover
  usersListEl.addEventListener("mouseover", (e) => {
    const item = e.target.closest(".user-item");
    if (!item) return;
    const btn = item.querySelector(".private-chat-btn");
    if (btn) btn.classList.remove("hidden");
  });

  usersListEl.addEventListener("mouseout", (e) => {
    const item = e.target.closest(".user-item");
    if (!item) return;
    const btn = item.querySelector(".private-chat-btn");
    if (btn) btn.classList.add("hidden");
  });

  // Click → άνοιγμα DM
  usersListEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".private-chat-btn");
    if (!btn) return;

    const targetUid = btn.dataset.uid;
    const targetName = btn.dataset.name;
    if (!targetUid || targetUid === auth.currentUser.uid) return;

    await openPrivateChat(targetUid, targetName);
  });
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
  const uid = snap.key;

  // 🔹 Πάρε πρώτα τυχόν ρόλο που έχει ήδη από /users
  const prev = usersMap.get(uid) || {};
  const mergedRole = prev.role || val.role || "user";

  usersMap.set(uid, {
    displayName: val.displayName || prev.displayName || "Guest",
    status: val.state || "offline",
    role: mergedRole,
    banned: prev.banned || false,
    muted: prev.muted || false
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
  status: val.status || val.state || prev.state || "offline",

  role: prev.role || val.role || "user"  // ✅ κρατά πάντα το σωστό role από /users
});
// =====================================================
// 🔵 Presence Listener — track online/offline live
// =====================================================
const statusRef = ref(db, "status");

onValue(statusRef, (snap) => {
  const allStatus = snap.val() || {};

  // Ενημέρωσε τον usersMap με τα νέα states
  Object.keys(allStatus).forEach((uid) => {
    const st = allStatus[uid];

    if (!usersMap.has(uid)) return;

    const prev = usersMap.get(uid);

    usersMap.set(uid, {
      ...prev,
      status: st.state || st.status || "offline",
      lastChanged: st.lastChanged || prev.lastChanged || 0,
    });
  });

  renderList();
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
      status: "offline",
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
    // ✅ ενημερώνουμε πλέον και το displayName
    displayName: val.displayName || prev.displayName || "Guest",
    role: val.role || prev.role || "user",
    banned: val.banned || false,
    muted: val.muted || false
  });

  console.log("🔄 User changed live:", snap.key, val.displayName);
  renderList();
});

// ============================================================
// 🔁 Step 14 — Live Status Updates (online / away / offline)
// ============================================================
const usersMainRef = ref(db, "users");

if (!window._usersStatusListenerBound) {
  window._usersStatusListenerBound = true;

  onChildChanged(usersMainRef, (snap) => {
    const uid = snap.key;
    const val = snap.val() || {};

    if (usersMap.has(uid)) {
      const prev = usersMap.get(uid);
      usersMap.set(uid, {
        ...prev,
        status: val.status || prev.state || "offline",
        displayName: val.displayName || prev.displayName,
        role: val.role || prev.role,
      });
    }

    renderList(); // 🔄 Ανανεώνει άμεσα την εμφάνιση (τελίτσα, όνομα, ρόλο)
  });
}


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
  <hr>
  <button id="ctxViewProfile">👤 Προβολή προφίλ</button>

<button id="ctxBanToggle" data-action="ban">🚫 Ban User</button>

  <button id="ctxKickUser">👢 Kick User</button>
    <button id="ctxMuteToggle" data-action="mute">🔇 Mute User</button>

  <button id="ctxChangeRole">🧠 Change Role</button>
  <hr>
 

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

// === BAN/UNBAN: δυναμική ετικέτα ===
const banBtn = contextMenu.querySelector("#ctxBanToggle");
if (banBtn) {
  const isBanned =
    usersMap.get(targetUid)?.banned === true ||
    usersMap.get(targetUid)?.banned === "true";

  banBtn.textContent = isBanned ? "✅ Unban User" : "🚫 Ban User";
  banBtn.dataset.action = isBanned ? "unban" : "ban";
}

    // === Φίλος ή όχι; Εμφάνισε σωστό κουμπί ===
const currentUid = auth.currentUser?.uid;
const friendsRef = ref(db, `friends/${currentUid}/${targetUid}`); // ✅ σωστό global path



get(friendsRef).then((snap) => {
  const isFriend = snap.exists();
  contextMenu.querySelector("#ctxAddFriend").classList.toggle("hidden", isFriend);
  contextMenu.querySelector("#ctxRemoveFriend").classList.toggle("hidden", !isFriend);
});

// === MUTE/UNMUTE: δυναμική ετικέτα ===
const muteBtn = contextMenu.querySelector("#ctxMuteToggle");
if (muteBtn) {
  const isMuted =
    usersMap.get(targetUid)?.muted === true ||
    usersMap.get(targetUid)?.muted === "true" ||
    roomMutes.has(targetUid);

  muteBtn.textContent = isMuted ? "🔈 Unmute User" : "🔇 Mute User";
  muteBtn.dataset.action = isMuted ? "unmute" : "mute";
}


// 🔒 Απόκρυψη admin-only κουμπιών για μη-admin
["#ctxBanToggle","#ctxKickUser","#ctxMuteToggle","#ctxChangeRole"]

  .forEach(sel => contextMenu.querySelector(sel)?.classList.toggle("hidden", !isAdmin));



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
// ✅ Αποφυγή διπλής ενεργοποίησης context menu actions
if (window._ctxMenuFixApplied) console.log("⚠️ ContextMenu already applied");
window._ctxMenuFixApplied = true;


if (!window._ctxMenuBound) {
  window._ctxMenuBound = true;

  contextMenu.addEventListener("click", async (e) => {
    const uid = contextMenu.dataset.uid;
    if (!uid) return;
    const me = auth.currentUser;
const isAdmin = usersMap.get(me?.uid)?.role === "admin";
const adminOnlyIds = ["ctxBanUser","ctxUnbanUser","ctxKickUser","ctxMuteUser","ctxUnmuteUser","ctxChangeRole"];

// ⛔ Αν δεν είσαι admin, αγνόησε κλικ σε admin-only επιλογές
if (adminOnlyIds.includes(e.target.id) && !isAdmin) return;

// ⛔ Μπλοκάρεις ενέργειες πάνω στον εαυτό σου (friend και admin)
if (me && me.uid === uid) return;


// === 👤 VIEW PROFILE ===
if (e.target.id === "ctxViewProfile") {
  contextMenu.classList.add("hidden"); // κλείσε το μενού
  const targetUid = contextMenu.dataset.uid;
  if (!targetUid) return;

  // 🔹 Φέρε δεδομένα χρήστη από /users/{uid}
  try {
    const snap = await get(ref(db, "users/" + targetUid));
    const userData = snap.val() || {};
    showFriendProfileExpanded(userData, targetUid);
  } catch (err) {
    console.error("Profile load error:", err);
    convoAlert("❌ Σφάλμα κατά τη φόρτωση προφίλ.");
  }
  return;
}


    // === BAN / UNBAN (merged logic) ===
if (e.target.id === "ctxBanToggle") {
  const action = e.target.dataset.action; // "ban" | "unban"

  // 🚫 Προστασία για owner και admins (μόνο στο ban)
  if (action === "ban") {
    if (uid === "LNT3cUi6sUPW3I1FCGSZMJVAymv1") {
      convoAlert("⛔ Δεν μπορείς να κάνεις ban τον owner (MysteryMan).");
      return;
    }
    if (await isProtectedUser(uid)) {
      convoAlert("⛔ Δεν μπορείς να κάνεις ban άλλον admin ή moderator.");
      return;
    }
  }

  const ok = await convoConfirm(
    action === "ban"
      ? "🚫 Θες σίγουρα να κάνεις BAN αυτόν τον χρήστη;"
      : "✅ Θες να κάνεις UNBAN αυτόν τον χρήστη;"
  );
  if (!ok) return;

  try {
    const displayName = usersMap.get(uid)?.displayName || "Unknown User";

    await update(ref(db, `users/${uid}`), {
      banned: action === "ban",
      displayName,
    });

    await push(ref(db, "adminLogs"), {
      type: action,
      targetUid: uid,
      targetName: displayName,
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      action,
      room: window.currentRoom || localStorage.getItem("lastRoom") || "system",
      createdAt: serverTimestamp(),
    });

    convoAlert(
      action === "ban"
        ? `✅ Ο χρήστης "${displayName}" έγινε ban.`
        : `✅ Ο χρήστης "${displayName}" έγινε unban.`
    );
  } catch (err) {
    console.error("Ban/Unban error:", err);
  }
}


    // === KICK USER ===
    if (e.target.id === "ctxKickUser") {
      if (uid === "LNT3cUi6sUPW3I1FCGSZMJVAymv1") {
        convoAlert("⛔ Δεν μπορείς να κάνεις kick τον owner (MysteryMan).");
        return;
      }

      const reason = await convoPrompt("💬 Πληκτρολόγησε reason για kick:", { placeholder: "π.χ. spam..." });
      if (!reason) return;

      const kickReason = reason.trim();
      if (await isProtectedUser(uid)) {
        convoAlert("⛔ Δεν μπορείς να κάνεις kick άλλον admin ή moderator.");
        return;
      }

      try {
        await set(ref(db, `kicks/${uid}`), {
          kickedBy: auth.currentUser.displayName || "Admin",
          reason: kickReason,
          createdAt: serverTimestamp(),
        });
        await push(ref(db, "adminLogs"), {
          type: "kick",
          targetUid: uid,
          targetName: usersMap.get(uid)?.displayName || "Unknown User",
          adminUid: auth.currentUser.uid,
          adminName: auth.currentUser.displayName || "Admin",
          action: "kick",
          reason: kickReason,
          room: window.currentRoom || localStorage.getItem("lastRoom") || "system",
          createdAt: serverTimestamp(),
        });
        convoAlert(`👢 Ο χρήστης έγινε kick.\n📝 Λόγος: ${kickReason}`);
      } catch (err) {
        console.error("Kick error:", err);
      }
    }

    // === MUTE / UNMUTE (merged logic) ===
if (e.target.id === "ctxMuteToggle") {
  const action = e.target.dataset.action; // "mute" | "unmute"

  const ok = await convoConfirm(
    action === "mute"
      ? "🔇 Θες σίγουρα να κάνεις MUTE αυτόν τον χρήστη;"
      : "🔈 Θες να κάνεις UNMUTE αυτόν τον χρήστη;"
  );
  if (!ok) return;

  try {
    const displayName = usersMap.get(uid)?.displayName || "Unknown User";
    const roomId = window.currentRoom || localStorage.getItem("lastRoom") || "main";

    // ✅ Ενημέρωση Firebase (mute/unmute στο room)
    if (action === "mute") {
      await update(ref(db, `v3/rooms/${roomId}/mutes/${uid}`), {
        mutedBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } else {
      await remove(ref(db, `v3/rooms/${roomId}/mutes/${uid}`));
    }

    // ✅ Καταγραφή στο adminLogs
    await push(ref(db, "adminLogs"), {
      type: action,
      targetUid: uid,
      targetName: displayName,
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      room: roomId,
      createdAt: serverTimestamp(),
    });
// 🔄 Refresh immediately in UI
if (action === "mute") roomMutes.add(uid);
else roomMutes.delete(uid);
renderList();

    convoAlert(
      action === "mute"
        ? `🔇 Ο χρήστης "${displayName}" έγινε MUTE.`
        : `🔈 Ο χρήστης "${displayName}" έγινε UNMUTE.`
    );
  } catch (err) {
    console.error("Mute/Unmute error:", err);
  }
}

  }); // ✅ Κλείνει το contextMenu.addEventListener
} // ✅ Κλείνει το if (!window._ctxMenuBound)

// === Helper: Προστατευμένοι χρήστες (Admins / VIP / Self) ===
async function isProtectedUser(uid) {
  const current = auth.currentUser;
  if (!current) return false;
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
        const res = await convoPrompt(`✅ Θες να κάνεις unban αυτόν τον χρήστη;`);
        if (res !== "ok") return;
        await update(ref(db, `users/${uid}`), { banned: false });
        convoAlert("✅ Ο χρήστης έγινε unban.");
          });
    });
  });
} // ✅ κλείνει τη loadBannedUsers



// ✅ τέλος αρχείου usersList.js
// ============================================================================
// 🧩 Live Avatar Watcher for User List (Step 5 continuation)
// ============================================================================

(function initUserListAvatarWatcher() {
  const usersRef = ref(db, "users");

  onValue(usersRef, (snapshot) => {
    const usersData = snapshot.val() || {};

    // Βρες όλα τα user items της λίστας
    document.querySelectorAll(".user-item").forEach((item) => {
      const uid = item.dataset.uid;
      if (!uid) return;

      const avatarEl = item.querySelector(".convo-avatar, .convo-avatar-default");
      if (!avatarEl) return;

      const user = usersData[uid];
      if (!user) return;

      const newAvatar = user.avatar;
      const displayName = user.displayName || "User";
      const initials = displayName.charAt(0).toUpperCase();

      // === Fade transition για ομαλή αλλαγή ===
      avatarEl.classList.add("updating");

      setTimeout(() => {
        if (newAvatar) {
          avatarEl.outerHTML = `<img src="${newAvatar}" alt="${displayName}" class="convo-avatar" />`;
        } else {
          avatarEl.outerHTML = `<div class="convo-avatar-default">${initials}</div>`;
        }
      }, 150);
    });
  });

  console.log("🧠 UserList avatar watcher ενεργό!");
})();

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
        const confirmUnmute = await convoConfirm("🔈 Θες σίγουρα να κάνεις UNMUTE αυτόν τον χρήστη;");
if (!confirmUnmute) return;

await set(ref(db, `v3/rooms/${room}/mutes/${uid}`), null);
await update(ref(db, `users/${uid}`), { muted: false }); // ✅ global flag sync




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

        convoAlert("🔈 Ο χρήστης έγινε unmute.");
      });
    });
  });
}
// ============================================================================
// 🔁 Refresh του current user στο local UI (rename / role / status)
// ============================================================================
window.addEventListener("currentUserUpdated", (e) => {
  const updated = e.detail;
  console.log("🔄 currentUserUpdated event:", updated);

  // Ενημέρωσε τον εαυτό σου στο usersMap (ώστε να ξαναγραφτεί σωστά στο DOM)
  if (usersMap.has(updated.uid)) {
    const userData = usersMap.get(updated.uid);
    userData.displayName = updated.displayName;
    userData.role = updated.role;
    userData.online = true;
    usersMap.set(updated.uid, userData);
  } else {
    // Αν δεν υπάρχει, πρόσθεσέ τον (backup για σπάνιες περιπτώσεις)
    usersMap.set(updated.uid, {
      uid: updated.uid,
      displayName: updated.displayName,
      role: updated.role || "user",
      online: true,
    });
  }

  renderList(); // ✅ ανανέωσε αμέσως το DOM
});


// ============================================================================
// 🔁 Force self-refresh όταν αλλάζει currentUserData (rename / role change)
// ============================================================================
window.addEventListener("currentUserUpdated", () => {
  const me = currentUserData;
  console.log("🔁 Self-refresh triggered:", me);

  // Βρες τη γραμμή σου με βάση το κείμενο "(You)"
  const allUserRows = document.querySelectorAll(".user-row");
  allUserRows.forEach((row) => {
    const nameEl = row.querySelector(".user-info strong");
    if (!nameEl) return;

    // Αν είναι ο εαυτός σου
    if (nameEl.textContent.includes("(You)")) {
      nameEl.textContent = `${me.displayName} (You)`;

      // Ενημέρωσε και το badge ρόλου
      const roleEl = row.querySelector(".role");
      if (roleEl) roleEl.textContent = me.role || "user";
    }
  });
});

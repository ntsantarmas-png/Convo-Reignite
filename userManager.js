// ===============================================================
// 🧠 Convo — User Manager (Step 5)
// Purpose: Add role change + admin protection
// ===============================================================

import { auth, db } from "./firebaseInit.js";
import {
  ref,
  get,
  update,
  remove,
  push,
  set,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { convoAlert, convoPrompt } from "./convoAlerts.js";
import { currentUserData } from "./currentUser.js";
import { getUserAvatarHTML } from "./avatarSystem.js";


console.log("⚙️ userManager.js Step 5 loaded");

// === Elements ===
const userManagerBtn = document.getElementById("userManagerBtn");
const userManagerModal = document.getElementById("userManagerModal");
const closeUserManagerBtn = document.getElementById("closeUserManagerBtn");
const userManagerList = document.getElementById("userManagerList");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");
const clearGuestsBtn2 = document.getElementById("clearGuestsBtn2");
const clearChatBtn2   = document.getElementById("clearChatBtn2");
const searchInput = document.getElementById("userSearch");
const tabButtons = document.querySelectorAll("#userTabs .tab-btn");

let allUsers = [];
let currentTab = "all";

// === 1️⃣ Εμφάνιση κουμπιού μόνο για Admins ===
// ✅ Εμφάνιση κουμπιού μόνο για Admins — με live listener
window.addEventListener("currentUserUpdated", (e) => {
  const { displayName = "", role = "" } = e.detail || {};
  const name = displayName.toLowerCase();
  const r = role.toLowerCase();

  const isOwner = name === "mysteryman";
  const isAdmin = isOwner || r === "admin" || name.includes("mystery");

  userManagerBtn?.classList.toggle("hidden", !isAdmin);
});



// === 2️⃣ Άνοιγμα / Κλείσιμο ===
userManagerBtn?.addEventListener("click", () => {
  userManagerModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  loadUsersWithStatus();
});
// === Κλείσιμο με ESC ή click έξω ===
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !userManagerModal.classList.contains("hidden")) {
    userManagerModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
});

document.addEventListener("click", (e) => {
  if (
    !userManagerModal.classList.contains("hidden") &&
    !userManagerModal.contains(e.target) &&
    e.target !== userManagerBtn
  ) {
    userManagerModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
});

closeUserManagerBtn?.addEventListener("click", () => {
  userManagerModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
});
refreshUsersBtn?.addEventListener("click", loadUsersWithStatus);

// === 1️⃣ Refresh ===


// === 2️⃣ Clear Guests ===
clearGuestsBtn2?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  // === Convo Bubble Confirm για Clear Guests ===
let overlay = document.createElement("div");
overlay.className = "convo-overlay";
overlay.innerHTML = `
  <div class="convo-bubble">
    <div class="bubble-header">🧹 Καθαρισμός Guest Χρηστών</div>
    <div class="bubble-content">Θες να διαγράψεις όλους τους <strong>OFFLINE guests</strong> από τη βάση;</div>
    <div class="bubble-buttons">
      <button id="confirmClearGuests" class="btn danger small">Ναι, καθάρισέ τους</button>
      <button id="cancelClearGuests" class="btn small">Ακύρωση</button>
    </div>
  </div>
`;
document.body.appendChild(overlay);

const confirmBtn = overlay.querySelector("#confirmClearGuests");
const cancelBtn = overlay.querySelector("#cancelClearGuests");

const closeOverlay = () => overlay.remove();

confirmBtn.addEventListener("click", async () => {
  const usersRef = ref(db, "users");
  const statusRef = ref(db, "status");
  const [usersSnap, statusSnap] = await Promise.all([get(usersRef), get(statusRef)]);

  const usersData = usersSnap.val() || {};
  const statusData = statusSnap.val() || {};
  let deleted = 0;

  // 🔹 Διαγραφή από users
  for (const uid in usersData) {
    const val = usersData[uid];
    const isGuest =
      val?.isAnonymous ||
      (val?.displayName && val.displayName.toLowerCase().startsWith("guest"));
    const isOffline = val?.state === "offline" || !statusData[uid] || statusData[uid]?.state === "offline";

    if (isGuest && isOffline) {
      await remove(ref(db, `users/${uid}`));
      await remove(ref(db, `status/${uid}`));
      deleted++;
    }
  }

  // 🔹 Διαγραφή orphan guests μόνο στο status (σε περίπτωση που δεν υπάρχουν στο users)
  for (const uid in statusData) {
    const st = statusData[uid];
    if (
      st?.displayName?.toLowerCase().startsWith("guest") &&
      st.state === "offline" &&
      !usersData[uid]
    ) {
      await remove(ref(db, `status/${uid}`));
      deleted++;
    }
  }

  closeOverlay();
  convoAlert(`✅ Καθαρίστηκαν ${deleted} offline guests.`);

  loadUsersWithStatus();
});


cancelBtn.addEventListener("click", closeOverlay);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeOverlay();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeOverlay();
}, { once: true });

  const usersRef = ref(db, "users");
  const snap = await get(usersRef);
  let deleted = 0;

  snap.forEach((child) => {
    const val = child.val() || {};
    const uid = child.key;
    const isOffline = val.state === "offline" || !val.state;
    const isGuest =
      val.isAnonymous ||
      (val.displayName && val.displayName.toLowerCase().startsWith("guest"));

    if (isOffline && isGuest) {
      remove(ref(db, `users/${uid}`));
      remove(ref(db, `status/${uid}`));
      deleted++;
    }
  });

  convoAlert(`✅ Καθαρίστηκαν ${deleted} offline guests.`);
  loadUsersWithStatus();
});


// ============================================================================
// 🧹 CLEAR CHAT per ROOM — Convo Bubble List + OK / Ακύρο
// ============================================================================
clearChatBtn2?.addEventListener("click", async () => {
  const roomsSnap = await get(ref(db, "v3/rooms"));
  const roomsData = roomsSnap.val() || {};

  const roomsList = Object.keys(roomsData).map((id) => {
    const name = roomsData[id]?.name || id;
    return `<li class="room-select-item" data-id="${id}">#${name}</li>`;
  }).join("");

  const overlay = document.createElement("div");
  overlay.className = "convo-overlay";
  overlay.innerHTML = `
    <div class="convo-bubble">
      <div class="bubble-header">🧹 Καθαρισμός Chat Δωματίου</div>
      <div class="bubble-content">
        <p>Επίλεξε ποιο δωμάτιο θέλεις να καθαρίσεις:</p>
        <ul class="room-select-list">${roomsList}</ul>
      </div>
      <div class="bubble-buttons">
        <button id="confirmClearRoom" class="btn danger small">OK</button>
        <button id="cancelClearRoom" class="btn small">Ακύρο</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const listItems = overlay.querySelectorAll(".room-select-item");
  let selectedRoom = null;

  listItems.forEach((item) => {
    item.addEventListener("click", () => {
      listItems.forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      selectedRoom = item.dataset.id;
    });
  });

  const confirmBtn = overlay.querySelector("#confirmClearRoom");
  const cancelBtn = overlay.querySelector("#cancelClearRoom");
  const closeOverlay = () => overlay.remove();

  confirmBtn.addEventListener("click", async () => {
    if (!selectedRoom) {
      convoAlert("⚠️ Επίλεξε πρώτα ένα δωμάτιο!");

      return;
    }

    await remove(ref(db, `v3/messages/${selectedRoom}`));
    closeOverlay();
    convoAlert(`✅ Καθαρίστηκαν όλα τα μηνύματα του #${selectedRoom}`);

  });

  cancelBtn.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOverlay();
  }, { once: true });
});


// === 3️⃣ Load Users ===
async function loadUsersWithStatus() {
  userManagerList.innerHTML = `<p class="muted">⏳ Loading users...</p>`;
  try {
    const [usersSnap, statusSnap] = await Promise.all([
      get(ref(db, "users")),
      get(ref(db, "status")),
    ]);
    const statusData = statusSnap.val() || {};
    const list = [];
    usersSnap.forEach((child) => {
      const data = child.val();
      const uid = child.key;
      const state = statusData[uid]?.state || "offline";
      list.push({ uid, ...data, state });
    });
    allUsers = list;
    updateCounters();
    renderList();
  } catch (err) {
    console.error("❌ loadUsers error:", err);
    userManagerList.innerHTML = `<p class="muted error">❌ Failed to load users.</p>`;
  }
}

// === 4️⃣ Counters ===
function updateCounters() {
  const counts = {
    all: allUsers.length,
    admins: allUsers.filter((u) => (u.role || "").toLowerCase() === "admin").length,
    vips: allUsers.filter((u) => (u.role || "").toLowerCase() === "vip").length,
    guests: allUsers.filter(
      (u) => u.isAnonymous || (u.displayName || "").toLowerCase().startsWith("guest")
    ).length,
    banned: allUsers.filter((u) => u.banned).length,
    muted: allUsers.filter((u) => u.muted).length,
  };
  tabButtons.forEach((btn) => {
    const t = btn.dataset.tab;
    const base = btn.textContent.split("(")[0].trim();
    btn.textContent = `${base} (${counts[t] || 0})`;
  });
}

// === 5️⃣ Render list ===
function renderList() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = allUsers.filter((u) => {
    const role = (u.role || "user").toLowerCase();
    const name = (u.displayName || "").toLowerCase();
    if (currentTab !== "all") {
      if (currentTab === "admins" && role !== "admin") return false;
      if (currentTab === "vips" && role !== "vip") return false;
      if (currentTab === "guests" && !name.startsWith("guest")) return false;
      if (currentTab === "banned" && !u.banned) return false;
      if (currentTab === "muted" && !u.muted) return false;
    }
    return name.includes(q) || role.includes(q);
  });

  if (!filtered.length) {
    userManagerList.innerHTML = `<p class="muted">📭 No users match this filter.</p>`;
    return;
  }

  userManagerList.innerHTML = filtered
    .map((u) => {
      const role = u.role || "user";
      const online = u.state === "online";
      const statusDot = `<span class="dot ${online ? "online" : "offline"}"></span>`;
      const muted = u.muted ? "Unmute" : "Mute";
      const banned = u.banned ? "Unban" : "Ban";
      const isGuest =
        u.isAnonymous || (u.displayName || "").toLowerCase().startsWith("guest");

      return `
  <div class="user-row">
    <div class="user-info">
      ${getUserAvatarHTML(u)}
      <div class="user-name-role">
        <strong class="user-name">${u.displayName || "Unknown"}</strong>
        <span class="role ${role.toLowerCase()}">${role}</span>
      </div>
      <div class="user-status">${statusDot}</div>
    </div>

    <div class="user-actions">
      <button class="btn small" data-action="changerole" data-uid="${u.uid}">🎭 Role</button>
      <button class="btn small" data-action="mute" data-uid="${u.uid}">🔇 ${muted}</button>
      <button class="btn small danger" data-action="ban" data-uid="${u.uid}">🚫 ${banned}</button>
      <button class="btn small" data-action="rename" data-uid="${u.uid}">✏️</button>
      ${
        isGuest
          ? `<button class="btn small danger" data-action="remove" data-uid="${u.uid}">❌</button>`
          : ""
      }
    </div>
  </div>`;

    })
    .join("");

  attachActionListeners();
}

// === 6️⃣ Action Listeners ===
function attachActionListeners() {
  const buttons = userManagerList.querySelectorAll("[data-action]");
  buttons.forEach((btn) =>
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const uid = btn.dataset.uid;
      if (!uid) return;

      switch (action) {
        case "changerole":
          await changeRole(uid);
          break;
        case "mute":
          await toggleMute(uid);
          break;
        case "ban":
          await toggleBan(uid);
          break;
        case "rename":
          await renameUser(uid);
          break;
        case "remove":
          await removeGuest(uid);
          break;
      }
    })
  );
}


// === 7️⃣ Admin Protection Helper (fixed) ===
async function isProtectedUser(uid) {
  const snap = await get(ref(db, `users/${uid}`));
  if (!snap.exists()) return false;

  const data = snap.val();
  const targetName = (data.displayName || "").toLowerCase();
  const targetRole = (data.role || "").toLowerCase();
  const currentName = (currentUserData.displayName || "").toLowerCase();
  const currentUid = auth.currentUser?.uid;

  // 🧱 1. Απόλυτη προστασία για MysteryMan — μόνο άλλοι δεν μπορούν να τον πειράξουν
  if (targetName === "mysteryman" && uid !== currentUid) return true;

  // 🧱 2. Αν είσαι ο MysteryMan, μπορείς να επεξεργαστείς όλους
  if (currentName === "mysteryman") return false;

  // 🧱 3. Οι Admins δεν μπορούν να πειράξουν άλλους Admins εκτός του εαυτού τους
  if (targetRole === "admin" && uid !== currentUid) return true;

  // ✅ Διαφορετικά, επιτρέπεται
  return false;
}



  // === ΝΕΟ Convo-style popup με κουμπιά ===
async function changeRole(uid) {
  if (await isProtectedUser(uid)) {
    return convoAlert("⛔ Δεν μπορείς να αλλάξεις ρόλο σε Admin ή MysteryMan.");

  }

  // === Δώσε νέο ρόλο με Convo bubble κουμπιά ===
  async function showRolePrompt() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.id = "convoBubbleOverlay";

      const box = document.createElement("div");
      box.className = "bubble-box";
      box.innerHTML = `
        <div class="bubble-header">
          <span class="bubble-title">🎭 Δώσε νέο ρόλο</span>
          <button class="bubble-close">×</button>
        </div>
        <div class="bubble-content" style="display:flex; gap:10px; justify-content:center;">
          <button class="role-btn admin">🛡️ Admin</button>
          <button class="role-btn vip">⭐ VIP</button>
          <button class="role-btn user">🪪 User</button>
        </div>
      `;

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // ✖️ Κλείσιμο με Χ ή ESC
      const close = () => {
        overlay.remove();
        resolve(null);
      };
      box.querySelector(".bubble-close").onclick = close;
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      }, { once: true });

      // ✅ Επιλογή ρόλου
      box.querySelectorAll(".role-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const role = btn.classList.contains("admin")
            ? "admin"
            : btn.classList.contains("vip")
            ? "vip"
            : "user";
          overlay.remove();
          resolve(role);
        });
      });
    });
  }

  // ✅ Άνοιξε το popup και πάρε το ρόλο που πάτησε ο admin
  const newRole = await showRolePrompt();
  if (!newRole) return;

  await update(ref(db, `users/${uid}`), { role: newRole.toLowerCase() });
  await push(ref(db, "adminLogs"), {
    type: "role",
    targetUid: uid,
    adminName: currentUserData.displayName || "Admin",
    action: `setRole:${newRole}`,
    createdAt: serverTimestamp(),
  });
  convoAlert(`✅ Role changed to ${newRole}`);

  loadUsersWithStatus();
}

// === 9️⃣ Mute / Ban / Rename / Remove (με προστασία) ===
async function toggleMute(uid) {
  if (await isProtectedUser(uid)) {
    return convoAlert("⛔ Δεν μπορείς να κάνεις mute Admin ή MysteryMan.");

  }

  const snap = await get(ref(db, `users/${uid}`));
  if (!snap.exists()) return;

  const data = snap.val();
  const newState = !data.muted;
  const room = window.currentRoom || localStorage.getItem("lastRoom") || "general";

  try {
    // ✅ Ενημέρωσε και τα δύο paths
    await update(ref(db, `users/${uid}`), { muted: newState });
    await set(ref(db, `v3/rooms/${room}/mutes/${uid}`), newState ? true : null);

    await push(ref(db, "adminLogs"), {
      type: "mute",
      targetUid: uid,
      targetName: data.displayName || "Unknown",
      adminName: currentUserData.displayName || "Admin",
      action: newState ? "mute" : "unmute",
      room,
      createdAt: serverTimestamp(),
    });

    convoAlert(`✅ ${newState ? "Muted" : "Unmuted"} ${data.displayName}`);

    loadUsersWithStatus();
  } catch (err) {
    console.error("Mute toggle error:", err);
    convoAlert("❌ Σφάλμα κατά το mute/unmute — δες κονσόλα.");

  }
}


async function toggleBan(uid) {
  if (await isProtectedUser(uid)) {
    return convoAlert("⛔ Δεν μπορείς να κάνεις ban Admin ή MysteryMan.");

  }
  const snap = await get(ref(db, `users/${uid}`));
  if (!snap.exists()) return;
  const data = snap.val();
  const newState = !data.banned;
  await update(ref(db, `users/${uid}`), { banned: newState });
  await push(ref(db, "adminLogs"), {
    type: "ban",
    targetUid: uid,
    targetName: data.displayName,
adminName: currentUserData.displayName || "Admin",
    action: newState ? "ban" : "unban",
    createdAt: serverTimestamp(),
  });
  convoAlert(`✅ ${newState ? "Banned" : "Unbanned"} ${data.displayName}`);

  loadUsersWithStatus();
}

// ✏️ Rename (auto-refresh without F5)
// ✏️ Rename (sync Auth + DB + live refresh)
async function renameUser(uid) {
  if (await isProtectedUser(uid)) {
    return convoAlert("⛔ Δεν μπορείς να μετονομάσεις Admin ή MysteryMan.");

  }

  const newName = await convoPrompt("✏️ Enter new nickname:");

  if (!newName) return;

// === Πάρε το παλιό όνομα ΠΡΙΝ την αλλαγή ===
const oldSnap = await get(ref(db, `users/${uid}/displayName`));
const oldName = oldSnap.exists() ? oldSnap.val() : "Unknown";

// === Ενημέρωση στη Realtime DB ===
await update(ref(db, `users/${uid}`), { displayName: newName });

// === Αν ο στόχος είναι ο συνδεδεμένος χρήστης, ενημέρωσε και το Auth profile ===
const currentUser = auth.currentUser;
if (currentUser && currentUser.uid === uid) {
  try {
    const { updateProfile } = await import(
      "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js"
    );
    await updateProfile(currentUser, { displayName: newName });
    console.log("✅ Auth profile updated too");
  } catch (err) {
    console.warn("⚠️ updateProfile failed:", err);
  }
}

// === Log rename με παλιό + νέο ===
await push(ref(db, "adminLogs"), {
  type: "rename",
  targetUid: uid,
  oldName,
  newName,
  adminName: currentUserData.displayName || "Admin",
  createdAt: serverTimestamp(),
});


  // === Ενημέρωση λίστας τοπικά ===
  const index = allUsers.findIndex((u) => u.uid === uid);
  if (index !== -1) allUsers[index].displayName = newName;
  renderList();
  updateCounters();

  convoAlert(`✅ Renamed to ${newName}`);

}


async function removeGuest(uid) {
  const confirm = await convoPrompt("❌ Confirm removal? Type 'yes'");

  if (confirm.toLowerCase() !== "yes") return;
  await remove(ref(db, `users/${uid}`));
  await remove(ref(db, `status/${uid}`));
  await push(ref(db, "adminLogs"), {
    type: "remove",
    targetUid: uid,
adminName: currentUserData.displayName || "Admin",
    createdAt: serverTimestamp(),
  });
  convoAlert("✅ Guest removed successfully");

  loadUsersWithStatus();
}

// === 🔟 Tabs & Search ===
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentTab = btn.dataset.tab;
    renderList();
  });
});
searchInput?.addEventListener("input", renderList);

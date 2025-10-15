// ============================================================================
// USERS LIST — Step 6A (Role Categories + You Marker)
// ============================================================================
import {
  ref,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  get
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
console.log("🧩 Current usersMap:", arr);

  // === Δημιουργία ομάδων ===
  const groups = { admins: [], vips: [], users: [], offline: [] };

  arr.forEach(u => {
  const name = u.displayName || "Guest";
  const role = (u.role || "user").toString().toLowerCase().trim();
  const isOnline = u.state === "online";
  const isYou = auth.currentUser && u.uid === auth.currentUser.uid;

  // debug
  console.log("👀 Checking user:", name, "| role:", role, "| state:", u.state);

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
              const isYou = auth.currentUser && uid === auth.currentUser.uid;
              const label = isYou ? `${u.displayName || "Guest"} (You)` : u.displayName || "Guest";
              const isTyping = typingState.get(uid);
              const typingHtml = isTyping ? `<div class="typing-indicator">✏️ Typing...</div>` : "";
              const dotClass = u.state === "online" ? "dot online" : "dot offline";
              return `
                <div class="user-item">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span class="${dotClass}"></span>
                    <div class="user-name">${label}</div>
                  </div>
                  ${typingHtml}
                </div>
              `;
            })
            .join("")}
        </div>`
      : "";

  
  console.log("🧩 Groups summary:", groups);
    usersListEl.innerHTML =
      makeSection("Admins", "admin", groups.admins) +
    makeSection("VIPs", "vip", groups.vips) +
    makeSection("Users", "user", groups.users) +
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

  console.log("🔁 Status update merged:", uid, "| role:", prev.role);
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
      role: val.role || prev.role || "user"
    });
  } else {
    usersMap.set(uid, {
      displayName: val.displayName || "Guest",
      state: "offline",
      role: val.role || "user"
    });
  }

  console.log("🧠 Role merged for:", val.displayName, "→", val.role);
  rolesLoaded = true;
  if (statusLoaded && rolesLoaded) renderList();
});


onChildChanged(usersRef, snap => {
  const val = snap.val() || {};
  const prev = usersMap.get(snap.key) || {};
  usersMap.set(snap.key, { ...prev, role: val.role || "user" });
  renderList();
  console.log("Role updated for:", val.displayName, "→", val.role);

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


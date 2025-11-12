// ===============================================================
// 👤 Convo — profileModal.js (Step 4E)
// Purpose: Add role-based protection (only self-edit allowed)
// ===============================================================
import { onChildAdded } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { auth, db } from "./firebaseInit.js";
import { currentUserData } from "./currentUser.js";
import { ref, update, remove, push, set, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

import { onValue, off } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { convoAlert, convoConfirm, convoPrompt } from "./convoAlerts.js";

import { sendFriendRequest, removeFriend } from "./friendsManager.js";


const profileBtn = document.getElementById("profileBtn");
const OWNER_UID = "LNT3cUi6sUPW3I1FCGSZMJVAymv1"; // MysteryMan

let modalOverlay;

export function initProfileModal() {
  if (!document.getElementById("profileModal")) {
    modalOverlay = document.createElement("div");
    modalOverlay.id = "profileModal";
    modalOverlay.className = "hidden modal-overlay";
    modalOverlay.innerHTML = `
      <div class="modal-box profile-box">
        <div class="modal-header">
          <h3>🧑 Profile</h3>
          <button id="closeProfileBtn" class="icon-btn">✖</button>
        </div>
        <div class="modal-tabs">
  <button class="tab-btn active" id="tabBtnProfile">Profile</button>
  <button class="tab-btn" id="tabBtnFriends">Friends</button>
  <button class="tab-btn" id="tabBtnCoins">Coins</button>
  <button class="tab-btn" id="tabBtnGifts">Gifts</button>
  <button class="tab-btn" id="tabBtnSettings">Settings</button>
</div>

<div class="modal-content">

  <!-- === PROFILE (active) === -->
  <section id="tabProfile">
    <div class="profile-top">
      <div class="profile-avatar" id="profileAvatar"></div>
      <div class="profile-info">
        <div class="profile-name-row">
          <div class="profile-name" id="profileName">–</div>
        </div>
        <div class="profile-role" id="profileRole">–</div>
        <div class="profile-status" id="profileStatus">–</div>
      </div>
    </div>

    <div class="profile-actions">
      <button id="changeAvatarBtn" class="btn small hidden">🖼️ Change Avatar</button>
    </div>
  </section>

  <!-- === FRIENDS === -->
<section id="tabFriends" class="hidden">
  <div id="friendsSection">
    <h4>👥 Φίλοι μου</h4>
    <div id="friendsCount">Σύνολο φίλων: 0</div>

    <ul id="friendsList" class="friends-list"></ul>
    <p id="noFriendsMsg" class="muted">Δεν έχεις προσθέσει ακόμα φίλους.</p>
  </div>
</section>


  <!-- === COINS === -->
  <section id="tabCoins" class="hidden">
    <div class="placeholder">💰 Coins — coming soon</div>
  </section>

 <!-- === GIFTS === -->
<section id="tabGifts" class="hidden">
  <div class="muted" style="margin-bottom:6px">
    🎁 Τα δώρα μου: <span id="myGiftsCount">0</span>
  </div>

  <div id="myGiftsList" class="fp-gifts-list"></div>
  <p id="myGiftsEmpty" class="muted">Δεν έχεις λάβει δώρα ακόμη.</p>
</section>


  <!-- === SETTINGS === -->
  <section id="tabSettings" class="hidden">
  <div class="settings-actions">
    <button id="editNicknameBtn" class="btn small">✏️ Edit Nickname</button>
    <button id="changeRoleBtn" class="btn small admin-only">🛡️ Change Role</button>
    <button id="deleteProfileBtn" class="btn small danger">🚪 Delete Profile</button>
  </div>
</section>


</div>

      </div>
    `;
    document.body.appendChild(modalOverlay);
    // === Tab switching (basic) ===
function switchTab(targetId) {
  const sections = ["tabProfile","tabFriends","tabCoins","tabGifts","tabSettings"];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === targetId) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });

  const btns = [
    ["tabBtnProfile","tabProfile"],
    ["tabBtnFriends","tabFriends"],
    ["tabBtnCoins","tabCoins"],
    ["tabBtnGifts","tabGifts"],
    ["tabBtnSettings","tabSettings"]
  ];
  btns.forEach(([btnId, secId]) => {
    const b = document.getElementById(btnId);
    if (!b) return;
    if (secId === targetId) b.classList.add("active");
    else b.classList.remove("active");
  });
}

document.addEventListener("click", (e) => {
  switch (e.target.id) {
    case "tabBtnProfile":  switchTab("tabProfile");  break;
    case "tabBtnFriends":  switchTab("tabFriends"); loadFriendsList(); break;
case "tabBtnCoins":
  switchTab("tabCoins");
  loadMyCoins(); // 🆕 live coins loader
  break;
    case "tabBtnGifts":    switchTab("tabGifts"); loadMyGifts(); break;

    case "tabBtnSettings": switchTab("tabSettings"); break;
  }
});

  }

  // === Άνοιγμα modal ===
  profileBtn.addEventListener("click", () => {
    updateProfileUI();
    modalOverlay.classList.remove("hidden");
    document.body.classList.add("modal-open");
  });

  // === Κλείσιμο modal ===
  document.addEventListener("click", (e) => {
    if (e.target.id === "closeProfileBtn" || e.target.id === "profileModal") {
      modalOverlay.classList.add("hidden");
      document.body.classList.remove("modal-open");
    }
  });

// === Επεξεργασία avatar ===
document.addEventListener("click", async (e) => {
  if (e.target.id === "changeAvatarBtn") {
    const newURL = await convoPrompt("🖼️ Enter new avatar URL:", currentUserData.avatar || "");

    if (!newURL) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    await update(ref(db, "users/" + uid), { avatar: newURL });
await convoAlert("✅ Avatar updated!");
  }
});


// === Settings buttons (Edit Nickname active) ===
document.addEventListener("click", async (e) => {
  // === ✏️ Edit Nickname ===
  if (e.target.id === "editNicknameBtn") {
  const newName = await convoPrompt("✏️ Νέο nickname:", currentUserData.displayName || "");
  if (!newName) return;

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  try {
    await update(ref(db, "users/" + uid), { displayName: newName });
    await convoAlert("✅ Το nickname άλλαξε σε: " + newName);
    updateProfileUI();
  } catch (err) {
    console.error(err);
    await convoAlert("❌ Σφάλμα κατά την αλλαγή nickname.");
  }
}

  // === 🛡️ Change Role (με Convo κουμπιά) ===
  if (e.target.id === "changeRoleBtn") {
    if (currentUserData.role !== "admin") {
      await convoAlert("⛔ Μόνο admin μπορεί να αλλάξει ρόλο.");


      return;
    }

    const existingPopup = document.getElementById("rolePopup");
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement("div");
    popup.id = "rolePopup";
    popup.className = "convo-popup";
    popup.innerHTML = `
      <div class="popup-inner">
        <h4>🛡️ Επίλεξε νέο ρόλο</h4>
        <div class="popup-buttons">
          <button class="roleChoice" data-role="admin">Admin</button>
          <button class="roleChoice" data-role="vip">VIP</button>
          <button class="roleChoice" data-role="user">User</button>
        </div>
        <button id="closeRolePopup" class="popup-close">✖</button>
      </div>
    `;
    document.body.appendChild(popup);
  }


  // === 🚪 Delete Profile (πραγματική διαγραφή + logout) ===
  if (e.target.id === "deleteProfileBtn") {
  const uid = auth.currentUser?.uid;
  if (!uid) { await convoAlert("❌ Σφάλμα: Δεν εντοπίστηκε ο χρήστης."); return; }

  // 🛡️ Προστασία Owner (MysteryMan): δεν διαγράφεται
  if (uid === OWNER_UID) {
    await convoAlert("⛔ Δεν μπορείς να διαγράψεις τον Owner (MysteryMan).");
    return;
  }

  // Convo-style confirm (fallback σε browser)
  const ok = await convoConfirm("⚠️ Θες σίγουρα να ζητήσεις διαγραφή του προφίλ σου; Θα απαιτείται έγκριση από τον Owner.");
  if (!ok) return;

  try {
    // 📨 Δημιουργία αιτήματος έγκρισης για MysteryMan
    const reqRef = push(ref(db, "adminRequests/deleteProfile"));
    await set(reqRef, {
      uid,
      displayName: currentUserData.displayName || "",
      requestedAt: Date.now(),
      requestedBy: uid,
      status: "pending"
    });

    await convoAlert("📨 Το αίτημα διαγραφής στάλθηκε στον Owner για έγκριση. Θα ενημερωθείς μόλις εγκριθεί.");
    // Δεν κάνουμε διαγραφή / logout εδώ. Περιμένουμε έγκριση.
  } catch (err) {
    console.error(err);
    await convoAlert("❌ Σφάλμα κατά την αποστολή αιτήματος διαγραφής.");
  }
}


});
// === Επιλογή ρόλου από το popup ===
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("roleChoice")) {
    const chosenRole = e.target.dataset.role;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // 🔒 Role lock για Owner: δεν επιτρέπεται αλλαγή από 'admin'
    if (uid === OWNER_UID && chosenRole !== "admin") {
      await convoAlert("🛡️ Ο ρόλος του Owner είναι κλειδωμένος σε 'admin'.");
      document.getElementById("rolePopup")?.remove();
      return;
    }

    try {
      await update(ref(db, "users/" + uid), { role: chosenRole });
      await convoAlert("✅ Ο ρόλος άλλαξε σε: " + chosenRole);
      document.getElementById("rolePopup")?.remove();
      updateProfileUI();
    } catch (err) {
      console.error(err);
      await convoAlert("❌ Σφάλμα κατά την αλλαγή ρόλου.");
    }
  }


  if (e.target.id === "closeRolePopup") {
    document.getElementById("rolePopup")?.remove();
  }
});


// === Εμφάνιση κουμπιού όταν συνδεθεί χρήστης ===
auth.onAuthStateChanged((user) => {
  if (user) profileBtn.classList.remove("hidden");
  else profileBtn.classList.add("hidden");
});
// ===============================================================
// 🎁 Gift Flow v2 — Login Summary (one-time) + Realtime while online
// ===============================================================
let _giftRealtimeOff = null;

auth.onAuthStateChanged(async (user) => {
  // καθάρισμα σε logout
  try {
    if (!user) {
      if (_giftRealtimeOff && typeof _giftRealtimeOff === "function") _giftRealtimeOff();
      _giftRealtimeOff = null;
      return;
    }
  } catch {}

  const uid = user.uid;
  const giftsRef = ref(db, "gifts/" + uid);

  // 1) One-time snapshot στο login → Summary modal (χωρίς spam alerts)
  try {
    const snap = await get(giftsRef);
    const pending = snap.val() || {};
    const entries = Object.entries(pending); // [[giftId, giftData], ...]

    if (entries.length) {
      // δείξε το summary (μία φορά)
      await showGiftSummaryModal(entries);

      // batch move → giftsRead, και cleanup από gifts
      for (const [giftId, g] of entries) {
        const payload = {
          from: g.from || "Κάποιος",
          name: g.name || "🎁 Δώρο",
          icon: g.icon || "🎁",
          sentAt: g.sentAt || Date.now(),
          readAt: Date.now(),
        };
        await set(ref(db, "giftsRead/" + uid + "/" + giftId), payload);
        try { await remove(ref(db, "gifts/" + uid + "/" + giftId)); } catch {}
      }

      // μικρή καθυστέρηση για να φρεσκάρει όμορφα η καρτέλα My Gifts
      setTimeout(() => { try { loadMyGifts(); } catch {} }, 300);
    }
  } catch (err) {
    console.warn("Gift login summary failed:", err);
  }

  // 2) Realtime για νέα δώρα **μετά** το login (όταν είναι ήδη μέσα ο χρήστης)
  const cb = async (snap) => {
    const g = snap.val();
    if (!g) return;

    const from = g.from || "Κάποιος";
    const name = g.name || "🎁 Δώρο";
    // Μικρό Convo-style alert μόνο για **νέα** δώρα ενώ είναι online
    convoAlert(`🎁 Έλαβες νέο δώρο από τον <b>${from}</b>: <br>${name}`);

    // Μεταφορά στο ιστορικό + καθάρισμα
    const giftId = snap.key;
    const payload = {
      from,
      name,
      icon: g.icon || "🎁",
      sentAt: g.sentAt || Date.now(),
      readAt: Date.now(),
    };
    try {
      await set(ref(db, "giftsRead/" + uid + "/" + giftId), payload);
      setTimeout(() => { try { loadMyGifts(); } catch {} }, 300);
      await remove(snap.ref);
    } catch (e) {
      console.warn("Gift move error:", e);
    }
  };

  // αποθηκεύουμε off() ώστε να καθαρίζουμε σε logout
  try {
    onChildAdded(giftsRef, cb);
    _giftRealtimeOff = () => {
      try { off(giftsRef, "child_added", cb); } catch {}
    };
  } catch (err) {
    console.warn("Gift realtime attach failed:", err);
  }
});


// === Update UI ===
async function updateProfileUI() {

  const avatarBox = document.getElementById("profileAvatar");
  const nameEl = document.getElementById("profileName");
  const roleEl = document.getElementById("profileRole");
  const statusEl = document.getElementById("profileStatus");
  const avatarBtn = document.getElementById("changeAvatarBtn");

  if (!avatarBox || !nameEl) return;

  const name = currentUserData.displayName || "Unknown";
  // 🔄 Αν δεν έχει φορτώσει το displayName από currentUserData,
// φέρε το απευθείας από τη βάση (users/{uid})
if (name === "Unknown") {
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      const snap = await get(ref(db, "users/" + uid));
      const data = snap.val();
      if (data && data.displayName) {
        currentUserData.displayName = data.displayName;
        nameEl.textContent = currentUserData.displayName;

      }
    } catch (err) {
      console.warn("⚠️ Fallback name fetch failed:", err);
    }
  }
}

  const role = currentUserData.role || "user";
  const avatar = currentUserData.avatar;
  const online = currentUserData.online;
  const uid = auth.currentUser?.uid || "";
  const isSelf = uid === currentUserData.uid;

  // === Avatar ===
  if (avatar) {
    avatarBox.innerHTML = `<img src="${avatar}" alt="avatar" class="convo-avatar" />`;
  } else {
    const initials = name.charAt(0).toUpperCase();
    avatarBox.innerHTML = `<div class="convo-avatar-default">${initials}</div>`;
  }

  // === Info ===
  nameEl.textContent = name;
  roleEl.textContent = `Role: ${role}`;
  // === Real-time presence check from /status ===

const statusRef = ref(db, "status/" + uid);
onValue(statusRef, (snap) => {
  const state = snap.val()?.state;
  const isOnline = state === "online";
  statusEl.innerHTML = isOnline
    ? `<span class="dot online"></span> Online`
    : `<span class="dot offline"></span> Offline`;
});


  // === Ενεργοποίηση / απόκρυψη κουμπιού Avatar ===
  if (isSelf) avatarBtn.classList.remove("hidden");
  else avatarBtn.classList.add("hidden");
    // === Εμφάνιση κουμπιού "Change Role" μόνο για admin ===
  const roleBtn = document.getElementById("changeRoleBtn");
  if (roleBtn) {
    if (currentUserData.role === "admin") {
      roleBtn.classList.remove("hidden");
    } else {
      roleBtn.classList.add("hidden");
    }
      // === Απόκρυψη "Delete Profile" για τον Owner (MysteryMan) ===
  const delBtn = document.getElementById("deleteProfileBtn");
  if (delBtn) {
    if ((auth.currentUser?.uid || "") === OWNER_UID) {
      delBtn.classList.add("hidden");
    } else {
      delBtn.classList.remove("hidden");
    }
  }

  }

}}

// ===============================================================
// 🎁 Load Gifts (My Profile) — Real-time refresh + Recent on top
// ===============================================================
let _giftsUnsub = null;

function loadMyGifts() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const listEl  = document.getElementById("myGiftsList");
  const emptyEl = document.getElementById("myGiftsEmpty");
  const countEl = document.getElementById("myGiftsCount");
  if (!listEl || !emptyEl || !countEl) return;

  // 🧹 Καθάρισε προηγούμενο listener
  if (_giftsUnsub) {
    _giftsUnsub();
    _giftsUnsub = null;
  }

  const giftsRef = ref(db, "giftsRead/" + uid);

  // 🔄 Ζωντανός listener
  _giftsUnsub = onValue(giftsRef, (snap) => {
    const gifts = snap.val() || {};
    const entries = Object.entries(gifts);

    listEl.innerHTML = "";

    if (!entries.length) {
      emptyEl.classList.remove("hidden");
      countEl.textContent = "0";
      return;
    }

    // 📅 Ταξινόμηση: πιο πρόσφατο επάνω
    entries.sort(([, a], [, b]) => Number(b.sentAt || 0) - Number(a.sentAt || 0));

    countEl.textContent = String(entries.length);
    emptyEl.classList.add("hidden");

    // 🖌️ Render gifts (νεότερα πρώτα)
    for (const [giftId, g] of entries) {
      const icon = g.icon || "🎁";
      const name = g.name || "Gift";
      const from = g.from || "—";
      const ts   = g.sentAt ? tsToLocal(Number(g.sentAt)) : "—";
      const isNew = !g.readAt;

      const item = document.createElement("div");
      item.className = `fp-gift-item ${isNew ? "new-gift" : "old-gift"}`;
      item.innerHTML = `
        <div class="fp-gift-icon">${icon}</div>
        <div class="fp-gift-info">
          <div class="fp-gift-name">${name}${isNew ? ' <span class="gift-dot"></span>' : ""}</div>
          <div class="fp-gift-meta">Από: <span>${from}</span> • <span>${ts}</span></div>
        </div>
      `;

      // ⚡ Νεότερα πρώτα — μπαίνουν στην κορυφή
      listEl.appendChild(item);


      if (isNew) {
        setTimeout(() => {
          update(ref(db, `giftsRead/${uid}/${giftId}`), { readAt: Date.now() });
        }, 1000);
      }
    }
  });
}
// ===============================================================
// 🎁 Load Gifts (Other User Profile) — Live + Recent first
// ===============================================================
function loadUserGifts(uid, listEl, countEl, emptyEl) {
  if (!uid || !listEl || !countEl || !emptyEl) return;

  const giftsRef = ref(db, "giftsRead/" + uid);

  // Καθάρισε προηγούμενα δεδομένα
  listEl.innerHTML = "";
  emptyEl.classList.add("hidden");
  countEl.textContent = "0";

  // 🔄 Ζωντανός listener
  onValue(giftsRef, (snap) => {
    const gifts = snap.val() || {};
    const entries = Object.entries(gifts);

    listEl.innerHTML = "";

    if (!entries.length) {
      emptyEl.classList.remove("hidden");
      countEl.textContent = "0";
      return;
    }

    // 📅 Ταξινόμηση: πιο πρόσφατα επάνω
    entries.sort(([, a], [, b]) => Number(b.sentAt || 0) - Number(a.sentAt || 0));

    countEl.textContent = String(entries.length);
    emptyEl.classList.add("hidden");

    for (const [, g] of entries) {
  const icon = g.icon || "🎁";
  const name = g.name || "Gift";
  const from = g.from || "—";
  const ts = g.sentAt ? tsToLocal(Number(g.sentAt)) : "—";

  const item = document.createElement("div");
  item.className = "fp-gift-item";
  item.innerHTML = `
    <div class="fp-gift-icon">${icon}</div>
    <div class="fp-gift-info">
      <div class="fp-gift-name">${name}</div>
      <div class="fp-gift-meta">Από: <span>${from}</span> • <span>${ts}</span></div>
    </div>
  `;
  listEl.appendChild(item);
}

// 🧭 Smooth scroll στην κορυφή όταν προστεθεί νέο δώρο
setTimeout(() => {
  listEl.scrollTo({ top: 0, behavior: "smooth" });
}, 120);

  });
}


// ===============================================================
// 🪙 Load My Coins (Profile Tab) + Add Demo Button
// ===============================================================
function loadMyCoins() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const section = document.getElementById("tabCoins");
  if (!section) return;

  section.innerHTML = `
    <div class="coins-balance-box">
      <div class="coins-icon">🪙</div>
      <div class="coins-info">
        <div class="coins-label">Current Balance</div>
        <div id="coinsValue" class="coins-value">—</div>
        <div class="coins-note muted">History & transactions — coming soon</div>
      </div>
    </div>

      <button id="addCoinsBtn" class="btn small glow" style="margin-top:10px">➕ Add 10 Coins (Demo)</button>
  `;

  const valueEl = section.querySelector("#coinsValue");
  const coinsRef = ref(db, "coins/" + uid + "/balance");

  // 🔄 Live listener
  onValue(coinsRef, (snap) => {
    const val = snap.val();
    const amount = typeof val === "number" ? val : 0;
    valueEl.textContent = amount.toLocaleString("el-GR");
    valueEl.classList.add("glow-animate");
setTimeout(() => valueEl.classList.remove("glow-animate"), 600);

  });

  // ➕ Demo button: add 10 coins
  section.querySelector("#addCoinsBtn")?.addEventListener("click", async () => {
    try {
      const snap = await get(coinsRef);
      let current = snap.val();
      if (typeof current !== "number") current = 0;

      const newVal = current + 10;
      await set(coinsRef, newVal);
// 🧾 Log transaction
const logRef = push(ref(db, "coinLogs/" + uid));
await set(logRef, {
  type: "add",
  amount: 10,
  note: "Demo add",
  at: Date.now()
  
});

      await convoAlert(`💰 Προστέθηκαν 10 coins! Νέο υπόλοιπο: ${newVal}`);
    } catch (err) {
      console.error("Add coins error:", err);
      await convoAlert("❌ Σφάλμα κατά την προσθήκη coins.");
    }
  });
// ===============================================================
// 🧱 History + Earn Coins — Side by Side Layout
// ===============================================================
const wrap = document.createElement("div");
wrap.className = "coins-wrap";

// === Left: Transaction history ===
const logList = document.createElement("div");
logList.className = "coins-history";
logList.innerHTML = `
  <h4>📜 Ιστορικό κινήσεων</h4>
  <div id="coinsHistoryList" class="muted">Φόρτωση...</div>
`;
wrap.appendChild(logList);

// === Right: Earn box ===
const earnBox = document.createElement("div");
earnBox.className = "earn-coins-box";
earnBox.innerHTML = `
  <h4>💡 Earn</h4>
  <div class="earn-actions-vertical">
  <button id="dailyBonusBtn" class="btn small">🎁 Daily<br>Bonus</button>
  <button id="inviteFriendBtn" class="btn small ghost">👥 Invite<br>Friends</button>
  <button id="watchAdBtn" class="btn small ghost">🎬 Watch<br>Ad</button>
</div>

  <div id="dailyBonusNote" class="muted" style="font-size:13px;margin-top:4px"></div>
`;
wrap.appendChild(earnBox);

section.appendChild(wrap);
// ===============================================================
// 🔄 Load Coins History into the new layout
// ===============================================================
const logsRef = ref(db, "coinLogs/" + uid);
onValue(logsRef, (snap) => {
  const logs = snap.val() || {};
  const entries = Object.entries(logs);

  const historyList = document.getElementById("coinsHistoryList");
  if (!historyList) return;

  if (!entries.length) {
    historyList.innerHTML = "<span class='muted'>Δεν υπάρχουν κινήσεις ακόμη.</span>";
    return;
  }

  // πιο πρόσφατες πρώτα
  entries.sort(([, a], [, b]) => b.at - a.at);

  historyList.innerHTML = entries.slice(0, 10).map(([id, log]) => {
    const sign = log.type === "add" ? "+" : "−";
    const color = log.type === "add" ? "#8fff8f" : "#ff8888";
    const time = new Date(log.at).toLocaleString("el-GR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
    return `<div style="padding:3px 0;color:${color}">
      ${sign}${log.amount} — ${log.note} <span style="color:#999">(${time})</span>
    </div>`;
  }).join("");
});


// === Daily Bonus Logic ===
const dailyBtn = section.querySelector("#dailyBonusBtn");
const note = section.querySelector("#dailyBonusNote");
const bonusRef = ref(db, "coins/" + uid + "/lastBonus");

onValue(bonusRef, (snap) => {
  const last = snap.val();
  if (!last) return;
  const lastDate = new Date(last);
  const today = new Date();
  const sameDay =
    lastDate.getDate() === today.getDate() &&
    lastDate.getMonth() === today.getMonth() &&
    lastDate.getFullYear() === today.getFullYear();
  if (sameDay) {
    dailyBtn.disabled = true;
    note.textContent = "Ήδη πήρες το daily bonus σήμερα!";
  }
});

dailyBtn.addEventListener("click", async () => {
  try {
    const now = Date.now();
    await set(bonusRef, now);

    const coinsRef = ref(db, "coins/" + uid + "/balance");
    const snapCoins = await get(coinsRef);
    let current = snapCoins.val() || 0;
    const newVal = current + 20;
    await set(coinsRef, newVal);

    // log transaction
    const logRef = push(ref(db, "coinLogs/" + uid));
    await set(logRef, {
      type: "add",
      amount: 20,
      note: "Daily Bonus",
      at: now
    });

    await convoAlert("🎉 Πήρες το Daily Bonus +20 coins!");
    dailyBtn.disabled = true;
    note.textContent = "Επανέρχεται αύριο στις 00:00.";
  } catch (err) {
    console.error(err);
    await convoAlert("❌ Σφάλμα κατά την ενέργεια bonus.");
  }
});

// === Placeholder actions ===
section.querySelector("#inviteFriendBtn").addEventListener("click", () => {
  convoAlert("👥 Invite Friend coming soon — +50 coins!");
});
section.querySelector("#watchAdBtn").addEventListener("click", () => {
  convoAlert("🎬 Watch Ad demo — +10 coins feature soon!");
});



}

// ===============================================================
// 👥 Loader για Friends Tab
// ===============================================================
function loadFriendsList() {
  if (window._friendsUnsubscribe) {
  window._friendsUnsubscribe(); // σταματάει τον προηγούμενο listener
  window._friendsUnsubscribe = null;
}

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const listEl = document.getElementById("friendsList");
  const noMsg = document.getElementById("noFriendsMsg");
  const counterEl = document.getElementById("friendsCount");

  if (!listEl || !noMsg) return;
  listEl.innerHTML = "";

  // ✅ Διορθώθηκε path
  const friendsRef = ref(db, `friends/${uid}`);

  window._friendsUnsubscribe = onValue(friendsRef, async (snap) => {

    listEl.innerHTML = "";
    const friends = snap.val();
console.log("👥 Friends snapshot:", friends);

    if (!friends) {
      noMsg.classList.remove("hidden");
      if (counterEl) counterEl.textContent = "Σύνολο φίλων: 0";
      return;
    }

    noMsg.classList.add("hidden");
    let count = 0;

    for (const fid of Object.keys(friends)) {
      count++;

      // Φέρε ζωντανά στοιχεία του φίλου από /users/
      let friendData = {};
      try {
        const snap2 = await get(ref(db, "users/" + fid));
        friendData = snap2.val() || {};
      } catch {}

      const name = friendData.displayName || friends[fid]?.displayName || fid;

      const avatar = friendData.avatar || "";
      const initial = name.charAt(0).toUpperCase();

      const li = document.createElement("li");
      li.className = "friend-item";
      li.dataset.uid = fid; // ✅ ώστε να δουλεύει το δεξί κλικ
      li.innerHTML = `
  <div class="friend-info">
    ${
      avatar
        ? `<img src="${avatar}" class="friend-avatar" />`
        : `<div class="friend-avatar-default">${initial}</div>`
    }
    <div class="friend-text">
  <div class="friend-name-row">
    <span class="status-dot ${friendData.status || "offline"}"></span>
<span class="friend-name" data-fullname="${name}" title="${name}">${name}</span>
  </div>
  <span class="friend-role ${friendData.role || "user"}">${friendData.role || "user"}</span>
</div>

  </div>
  <div class="friend-actions">
    <button class="btn small ghost view-friend" data-uid="${fid}">🔍 Προβολή</button>
    <button class="btn small ghost chat-friend" data-uid="${fid}">💬 Chat</button>
    <button class="btn small red remove-friend" data-uid="${fid}">❌</button>
  </div>
`;

      listEl.appendChild(li);
    }

    if (counterEl) counterEl.textContent = `Σύνολο φίλων: ${count}`;
  });
}
// ===============================================================
// 🤝 Add / Remove Friend Logic
// ===============================================================
document.addEventListener("click", async (e) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

// === ➕ Add Friend ===
if (e.target.classList.contains("add-friend")) {
  const targetUid = e.target.dataset.uid;
  let targetName = e.target.dataset.name || "";

  if (!targetUid || targetUid === uid) return;

  // 🟢 Αν δεν έχουμε όνομα, φέρε το από /users/{targetUid}
  if (!targetName) {
    try {
      const snap = await get(ref(db, "users/" + targetUid));
      const data = snap.val() || {};
      targetName = data.displayName || "Unknown";
    } catch {
      targetName = "Unknown";
    }
  }

  const confirmAdd = await convoConfirm(`➕ Θες να προσθέσεις τον ${targetName} στους φίλους σου;`);
  if (!confirmAdd) return;

  try {
    // ✅ Αποθήκευση στο /friends/{uid}/{targetUid} και στις δύο πλευρές
    await set(ref(db, `friends/${uid}/${targetUid}`), {
      displayName: targetName,
      addedAt: Date.now(),
    });

    await set(ref(db, `friends/${targetUid}/${uid}`), {
      displayName: currentUserData.displayName || "Unknown",
      addedAt: Date.now(),
    });

    await convoAlert(`✅ Πρόσθεσες τον ${targetName} στους φίλους σου!`);
  } catch (err) {
    console.error(err);
    await convoAlert("❌ Σφάλμα κατά την προσθήκη φίλου.");
  }
}

// === ❌ Remove Friend ===
if (e.target.classList.contains("remove-friend")) {
  const targetUid = e.target.dataset.uid;
  if (!targetUid) return;
  const confirmRemove = await convoConfirm("⚠️ Θες σίγουρα να αφαιρέσεις αυτόν τον φίλο;");
  if (!confirmRemove) return;

  try {
    // ✅ Διαγραφή και από τις δύο πλευρές στο /friends/
    await remove(ref(db, `friends/${uid}/${targetUid}`));
    await remove(ref(db, `friends/${targetUid}/${uid}`));
    await convoAlert("🗑️ Ο φίλος αφαιρέθηκε επιτυχώς.");
  } catch (err) {
    console.error(err);
    await convoAlert("❌ Σφάλμα κατά την αφαίρεση φίλου.");
  }
}
});

// ===============================================================
// 🧑 Mini Profile Modal (Step 9C-C — Polish & Role logic)
// ===============================================================
function showMiniProfileModal(userData, fid) {
  document.getElementById("miniProfileModal")?.remove();

  const { displayName, role, avatar, uid } = userData || {};
  const name = displayName || "Unknown";
  const roleClass = role || "user";
  const avatarHTML = avatar
    ? `<img src="${avatar}" alt="avatar" class="mini-prof-avatar" />`
    : `<div class="mini-prof-avatar-default">${name.charAt(0).toUpperCase()}</div>`;

  // === Προσδιορισμός αν βλέπουμε τον εαυτό μας ===
  const currentUid = auth.currentUser?.uid || "";
  const isSelf = fid === currentUid;

  // === Απόκρυψη UID για μη-admin ===
  const uidRow =
    currentUserData.role === "admin"
      ? `<div class="mini-prof-uid">UID: ${fid || uid || "—"}</div>`
      : "";

  // === Απόκρυψη κουμπιού Remove για self-view ===
  const removeBtn = isSelf
    ? ""
    : `<button class="btn small danger remove-friend-mini" data-uid="${fid}">❌ Remove Friend</button>`;

  const modal = document.createElement("div");
  modal.id = "miniProfileModal";
  modal.className = "mini-profile-overlay";
  modal.innerHTML = `
    <div class="mini-profile-box glow-animate">
      <div class="mini-profile-header">
        <h3>👤 Προφίλ Χρήστη</h3>
        <button class="mini-prof-close">✖</button>
      </div>
      <div class="mini-profile-body">
        <div class="mini-prof-top">
          ${avatarHTML}
          <div class="mini-prof-info">
            <div class="mini-prof-name">${name}</div>
            <div class="mini-prof-role ${roleClass}">${roleClass}</div>
            <div class="mini-prof-status">⏳ Checking...</div>
            ${uidRow}
          </div>
        </div>
        <div class="mini-prof-actions">
          <button class="btn small ghost send-dm">💬 Send DM</button>
          ${removeBtn}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".mini-prof-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target.id === "miniProfileModal") modal.remove();
  });
}


// ===============================================================
// 🔍 Προβολή προφίλ — Σύνδεση με Friend Bubble
// ===============================================================
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("view-friend")) return;
  const fid = e.target
    .closest(".friend-bubble")
    ?.querySelector(".remove-friend-bubble")
    ?.dataset.uid;
  if (!fid) return;

  try {
    const snap = await get(child(ref(db), `users/${fid}`));
    const userData = snap.val();
    if (!userData) {
      await convoAlert("❌ Δεν βρέθηκαν δεδομένα χρήστη.");
      return;
    }


    // Προβολή του expanded modal
showFriendProfileExpanded(userData, fid);


  } catch (err) {
    console.error(err);
    await convoAlert("❌ Σφάλμα κατά τη φόρτωση προφίλ.");
  }
});
// ===============================================================
// ⚙️ Mini Profile Modal Logic (Step 9C-B — Status + Buttons)
// ===============================================================
function activateMiniProfileLogic(fid) {
  const statusEl = document.querySelector("#miniProfileModal .mini-prof-status");
  if (!statusEl) return;

  // === Live status ===
  const statusRef = ref(db, "status/" + fid);
  onValue(statusRef, (snap) => {
    const state = snap.val()?.state;
    const isOnline = state === "online";
    statusEl.innerHTML = isOnline
      ? `<span class="dot online"></span> Online`
      : `<span class="dot offline"></span> Offline`;
  });

  // === Κουμπί Remove Friend ===
  document.querySelector(".remove-friend-mini")?.addEventListener("click", async () => {
    const confirmRemove = await convoConfirm("⚠️ Θες σίγουρα να αφαιρέσεις αυτόν τον φίλο;");
    if (!confirmRemove) return;

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

await remove(ref(db, `friends/${uid}/${fid}`));
await remove(ref(db, `friends/${fid}/${uid}`));
      await convoAlert("🗑️ Ο φίλος αφαιρέθηκε επιτυχώς.");
      loadFriendsList();

      document.getElementById("miniProfileModal")?.remove();
      loadFriendsList(); // ανανέωση λίστας
    } catch (err) {
      console.error(err);
      await convoAlert("❌ Σφάλμα κατά την αφαίρεση φίλου.");
    }
  });

  // === Κουμπί Send DM (placeholder) ===
  document.querySelector(".send-dm")?.addEventListener("click", async () => {
    await convoAlert("💬 Σύντομα θα ανοίγει private chat tab με αυτόν τον χρήστη!");
  });
}


// === Auto-init ===
initProfileModal();

// Μικρός helper για ασφαλές local format timestamp → "DD/MM/YYYY, HH:MM"
function tsToLocal(ts) {
  if (!ts || typeof ts !== "number") return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleString("el-GR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

// ===============================================================
// 🧩 Friend Profile Expanded Modal (Step 10A – UI Only)
// ===============================================================
export function showFriendProfileExpanded(userData, fid) {
  document.getElementById("friendProfileModal")?.remove();

  const { displayName, role, avatar } = userData || {};
  const name = displayName || "Unknown";
  const roleClass = role || "user";
  const avatarHTML = avatar
    ? `<img src="${avatar}" alt="avatar" class="friend-profile-avatar" />`
    : `<div class="friend-profile-avatar-default">${name.charAt(0).toUpperCase()}</div>`;

  const modal = document.createElement("div");
  modal.id = "friendProfileModal";
  modal.className = "friend-profile-overlay";
  modal.innerHTML = `
    <div class="friend-profile-box">
      <div class="friend-profile-header">
        <div class="friend-profile-left">
          ${avatarHTML}
          <div class="friend-profile-info">
            <div class="friend-profile-name">${name}</div>
            <div class="friend-profile-role ${roleClass}">${roleClass}</div>
          </div>
        </div>
        <button class="friend-prof-close">✖</button>
      </div>

      <div class="friend-profile-tabs">
  <button class="fp-tab active" data-tab="overview">📄 Overview</button>
  <button class="fp-tab" data-tab="friends">👥 Friends</button>
  <button class="fp-tab" data-tab="mutual">🫂 Mutual</button>
  <button class="fp-tab" data-tab="chat">💬 Chat</button>
  <button class="fp-tab" data-tab="gifts">🎁 Gifts</button>
  <button class="fp-tab" data-tab="more">⚙️ More</button>
</div>


      <div class="friend-profile-content">
        <section class="fp-tab-content" id="fp-overview">
        <div id="fpActionContainer" class="fp-actions"></div>

  <div class="fp-overview-grid">
    <div>
      <div class="muted">Όνομα</div>
      <div id="fpName" class="fp-strong">—</div>
    </div>
    <div>
      <div class="muted">Ρόλος</div>
      <div id="fpRole" class="fp-pill">—</div>
    </div>
    <div>
      <div class="muted">Κατάσταση</div>
      <div id="fpStatus">⏳ Checking...</div>
    </div>
    <div>
      <div class="muted">Joined</div>
      <div id="fpJoined">—</div>
    </div>
    <div>
      <div class="muted">Last seen</div>
      <div id="fpLastSeen">—</div>
    </div>
  </div>
</section>
<section class="fp-tab-content hidden" id="fp-friends">
  <div class="muted" style="margin-bottom:6px">
    Friends: <span id="fpFriendsCount">0</span>
  </div>
  <div id="fpFriendsList" class="fp-friends-list"></div>
  <p id="fpFriendsEmpty" class="muted">Δεν υπάρχουν φίλοι ακόμη.</p>
</section>


        <section class="fp-tab-content hidden" id="fp-mutual">

  <div class="muted" style="margin-bottom:6px">
    Κοινοί φίλοι: <span id="fpMutualCount">0</span>
  </div>
  <div id="fpMutualList" class="fp-mutual-list"></div>
</section>

        <section class="fp-tab-content hidden" id="fp-chat">
          <p>Ιδιωτική συνομιλία (σε επόμενο στάδιο).</p>
        </section>
        <section class="fp-tab-content hidden" id="fp-gifts">
  <div class="muted" style="margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
    <span>🎁 Δώρα: <span id="fpGiftsCount">0</span></span>
    <button id="sendGiftBtn" class="btn small glow">🎁 Send Gift</button>
  </div>

  <div id="fpGiftsList" class="fp-gifts-list"></div>
  <p id="fpGiftsEmpty" class="muted">Δεν υπάρχουν δώρα ακόμη.</p>
</section>


        <section class="fp-tab-content hidden" id="fp-more">
          <p>Περισσότερες επιλογές (report, block, remove).</p>
        </section>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  

  // === Mutuals — live φόρτωση κοινούς φίλους ΜΟΝΟ μία φορά ανά άνοιγμα ===
(function initMutualsOnce(){
  const listEl  = modal.querySelector("#fpMutualList");
  const countEl = modal.querySelector("#fpMutualCount");
  if (!listEl || !countEl) return;

  // για να μην ξανατρέχει αν ξανακλικάρεις το tab στο ίδιο άνοιγμα
  if (modal._mutualsLoaded) return;
  modal._mutualsLoaded = true;

  // UID του τωρινού χρήστη (εσένα)
  const me = (auth && auth.currentUser) ? auth.currentUser.uid : null;
  if (!me) { countEl.textContent = "0"; return; }

  // helpers
  const readFriends = async (uid) => {
const snap = await get(ref(db, "friends/" + uid));
    // Αναμένουμε δομή: users/{uid}/friends/{friendUid}: true
    return Object.keys(snap.val() || {});
  };
  const renderItem = (uid, data) => {
    const name = data?.displayName || "Unknown";
    const ava  = data?.photoURL || "";
    const initial = name?.[0]?.toUpperCase() || "?";

    const item = document.createElement("div");
    item.className = "fp-mutual-item";

    // avatar bubble (URL ή αρχικό)
    const avaEl = document.createElement("div");
    avaEl.className = "ava";
    if (ava) {
      avaEl.style.backgroundImage = `url("${ava}")`;
      avaEl.style.backgroundSize = "cover";
      avaEl.style.backgroundPosition = "center";
      avaEl.textContent = "";
    } else {
      avaEl.textContent = initial;
    }

    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = name;

    item.appendChild(avaEl);
    item.appendChild(nameEl);
listEl.prepend(item);
  };

  // main load
  (async () => {
    try {
      // 1) Πάρε δύο λίστες φίλων
      const [myFriends, targetFriends] = await Promise.all([
        readFriends(me),
        readFriends(fid)
      ]);

      // 2) Υπολόγισε intersection
      const targetSet = new Set(targetFriends);
      const mutual = myFriends.filter((u) => targetSet.has(u));

      // 3) Γέμισε counter
      countEl.textContent = String(mutual.length);

      // 4) Φέρε βασικά στοιχεία κάθε mutual από /users/{uid} και κάνε render
      listEl.innerHTML = "";
      for (const muid of mutual) {
        try {
          const usnap = await get(ref(db, "users/" + muid));
          renderItem(muid, usnap.val() || {});
        } catch {
          renderItem(muid, { displayName: muid });
        }
      }
    } catch (e) {
      // σε αποτυχία δείξε 0 και άφησε τη λίστα κενή
      countEl.textContent = "0";
      listEl.innerHTML = "";
    }
  })();
  // === Friends — live φόρτωση φίλων (μία φορά ανά άνοιγμα) ===
(function initFriendsOnce(){
  // === Gifts — live φόρτωση δώρων (auto-refresh για count) ===
(function initGiftsOnce(){
  const btn = modal.querySelector('.fp-tab[data-tab="gifts"]');
  if (!btn) return;

  let loaded = false;

  // 🎁 Real-time counter update — ακόμα κι αν δεν είναι ανοιχτό το tab
  const countEl = modal.querySelector("#fpGiftsCount");
  if (countEl && fid) {
    const giftsRef = ref(db, "giftsRead/" + fid);
    onValue(giftsRef, (snap) => {
      const gifts = snap.val() || {};
      const count = Object.keys(gifts).length;
      countEl.textContent = String(count);
    });
  }

  // 🔹 Κανονικό load μόνο όταν ο χρήστης ανοίξει το tab "Gifts"
  btn.addEventListener("click", () => {
    if (loaded) return;
    loaded = true;

    const listEl  = modal.querySelector("#fpGiftsList");
    const emptyEl = modal.querySelector("#fpGiftsEmpty");
    const countEl2 = modal.querySelector("#fpGiftsCount");
    if (!listEl || !emptyEl || !countEl2) return;

    loadUserGifts(fid, listEl, countEl2, emptyEl);
  });
})();


  const btn = modal.querySelector('.fp-tab[data-tab="friends"]');
  if (!btn) return;

  // για να μην ξαναφορτώνει στο ίδιο άνοιγμα modal
  let loaded = false;

  btn.addEventListener("click", async () => {
    if (loaded) return;
    loaded = true;

    const listEl  = modal.querySelector("#fpFriendsList");
    const emptyEl = modal.querySelector("#fpFriendsEmpty");
    const countEl = modal.querySelector("#fpFriendsCount");
    if (!listEl || !emptyEl || !countEl) return;

    // reset UI
    listEl.innerHTML = "";
    emptyEl.classList.add("hidden");
    countEl.textContent = "0";

    try {
      // Φέρε τους φίλους του προφίλ που βλέπουμε: friends/{fid}
const snap = await get(ref(db, "friends/" + fid));

      const friendsObj = snap.val() || {};
      const entries = Object.entries(friendsObj); // [[friendUid, info], ...]

      if (!entries.length) {
        emptyEl.classList.remove("hidden");
        countEl.textContent = "0";
        return;
      }

      countEl.textContent = String(entries.length);

      // Render κάθε φίλο (fallback σε /users/{friendUid} αν λείπουν name/avatar)
      for (const [friendUid, info] of entries) {
        let name   = info?.displayName || "";
        let avatar = info?.avatar || "";

        if (!name || !avatar) {
          try {
            const usnap = await get(ref(db, "users/" + friendUid));
            const u = usnap.val() || {};
            if (!name)   name   = u.displayName || friendUid;
            if (!avatar) avatar = u.avatar || "";
          } catch {
            if (!name) name = friendUid;
          }
        }

        const initial = (name?.[0] || "?").toUpperCase();
        const item = document.createElement("div");
        item.className = "fp-friend-item";
        item.dataset.uid = friendUid;

        item.innerHTML = `
          <div class="fp-friend-info">
            ${avatar
              ? `<img src="${avatar}" class="fp-friend-avatar" />`
              : `<div class="fp-friend-avatar-default">${initial}</div>`
            }
            <span class="fp-friend-name">${name}</span>
          </div>
        `;
        listEl.appendChild(item);
      }
    } catch (err) {
      console.error("Friends load error:", err);
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      countEl.textContent = "0";
    }
  });
})();

})();
// === Chat button → DM Integration ===
const chatBtn = modal.querySelector('.fp-tab[data-tab="chat"]');

if (chatBtn) {
  chatBtn.addEventListener("click", async () => {
    try {
      // Κλείσε το modal
      modal.remove();

      // Έλεγξε ότι υπάρχει τρέχων χρήστης
      const me = auth?.currentUser?.uid;
      if (!me) return;

      // Δημιούργησε chatId με τα δύο uid ταξινομημένα (σταθερή σειρά)
      const chatId = ["dm", [me, fid].sort().join("_")].join(":");

      // Κάλεσε helper (αν υπάρχει) ή custom logic για άνοιγμα DM tab
      if (typeof openPrivateChat === "function") {
        openPrivateChat(fid, chatId);
      } else {
        // fallback: προσπάθησε να βρει tab
        const tab = document.querySelector(`[data-chatid="${chatId}"]`);
        if (tab) {
          // Αν υπάρχει → κάνε το active
          document.querySelectorAll(".private-tab.active").forEach(el => el.classList.remove("active"));
          tab.classList.add("active");
        } else {
          // Αν δεν υπάρχει → φτιάξε ένα γρήγορο
          const bar = document.getElementById("privateTabsBar");
          if (bar) {
            const newTab = document.createElement("div");
            newTab.className = "private-tab active";
            newTab.dataset.chatid = chatId;
            newTab.textContent = userData?.displayName || "Private";
            bar.appendChild(newTab);
          }
        }
      }

      // Εστίασε το input
      const input = document.getElementById("messageInput");
      if (input) input.focus();

    } catch (err) {
      console.error("Chat open error:", err);
    }
  });
}
// ===============================================================
// 🎁 Preset Gift List (Step 13A)
// ===============================================================
const CONVO_GIFTS = [
  { name: "🌹 Rose", icon: "🌹", value: 10 },
  { name: "🍫 Chocolate Box", icon: "🍫", value: 15 },
  { name: "🧸 Teddy Bear", icon: "🧸", value: 25 },
  { name: "💎 Diamond", icon: "💎", value: 50 },
  { name: "🎧 Music Pass", icon: "🎧", value: 30 },
  { name: "☕ Coffee", icon: "☕", value: 8 },
  { name: "🎮 Game Token", icon: "🎮", value: 20 },
  { name: "⭐ VIP Star", icon: "⭐", value: 100 }
];


// === 🎁 Send Gift Logic ===
const sendGiftBtn = modal.querySelector("#sendGiftBtn");
if (sendGiftBtn) {
  sendGiftBtn.addEventListener("click", async () => {
  const fromUid = auth.currentUser?.uid;
  if (!fromUid) return;
  if (fromUid === fid) {
    await convoAlert("❌ Δεν μπορείς να στείλεις δώρο στον εαυτό σου!");
    return;
  }

  // === Gift Picker Modal ===
  const giftHtml = CONVO_GIFTS.map(
  (g) => `<button class="gift-choice" data-icon="${g.icon}" data-name="${g.name}" data-value="${g.value}">
      <span class="emoji">${g.icon}</span> ${g.name}
      <span class="gift-value">💰 ${g.value}</span>
    </button>`
).join("");


  const overlay = document.createElement("div");
  overlay.className = "convo-overlay";
  overlay.innerHTML = `
    <div class="convo-bubble">
      <div class="bubble-title">🎁 Επίλεξε δώρο</div>
      <div class="gift-picker">${giftHtml}</div>
      <div class="bubble-buttons">
        <button id="closeGiftPicker" class="btn small red">Άκυρο</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Κλείσιμο picker
  overlay.querySelector("#closeGiftPicker").addEventListener("click", () => overlay.remove());

  // Επιλογή δώρου
  overlay.querySelectorAll(".gift-choice").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const giftName = btn.dataset.name;
      const giftIcon = btn.dataset.icon;
      const giftValue = Number(btn.dataset.value) || 0;


      overlay.remove();
      // === Επιβεβαίωση αποστολής ===
const confirmSend = await showConvoBubbleConfirm(`
  🎁 <strong>Αποστολή δώρου</strong><br><br>
  Θα στείλεις το ${giftIcon} <strong>${giftName}</strong> (${giftValue} coins)<br>
  στον <strong>${userData?.displayName || "χρήστη"}</strong> — συνεχίζουμε;
`);


if (!confirmSend) return;


      try {

  // === 💰 Coins Deduction System ===
const coinsRef = ref(db, "coins/" + fromUid + "/balance");
const snapCoins = await get(coinsRef);
let currentCoins = snapCoins.val();
if (typeof currentCoins !== "number") currentCoins = 0;

if (currentCoins < giftValue) {
  await convoAlert("❌ Δεν έχεις αρκετά coins για αυτό το δώρο!");
  return;
}

// 🔻 Αφαίρεση ποσού
const newBalance = currentCoins - giftValue;
await set(coinsRef, newBalance);
// 🧾 Log transaction
const logRef = push(ref(db, "coinLogs/" + fromUid));
await set(logRef, {
  type: "deduct",
  amount: giftValue,
  note: `Gift: ${giftName}`,
  at: Date.now()
});

// === Αποθήκευση του δώρου στον παραλήπτη ===
const giftRef = push(ref(db, `gifts/${fid}`));
await set(giftRef, {
  name: giftName,
  icon: giftIcon,
  value: giftValue,
  from: currentUserData.displayName || "Unknown",
  fromUid,
  sentAt: Date.now()
});

// ✅ Επιβεβαίωση + εμφάνιση νέου υπολοίπου
await convoAlert(`✅ Έστειλες το ${giftIcon} <b>${giftName}</b>!<br><br>💰 Νέο υπόλοιπο: ${newBalance}`);

} catch (err) {
  console.error("Gift send error:", err);
  await convoAlert("❌ Σφάλμα κατά την αποστολή του δώρου.");
}

    });
  });
});

}


// === Live Overview init (name/role/joined/status/lastSeen) ===
(function initFriendOverview() {
  // DOM refs
  const nameEl   = modal.querySelector("#fpName");
  const roleEl   = modal.querySelector("#fpRole");
  const statusEl = modal.querySelector("#fpStatus");
  const joinedEl = modal.querySelector("#fpJoined");
  const seenEl   = modal.querySelector("#fpLastSeen");

  // 1) Άμεσο fill από τα δεδομένα που ήδη έχουμε (userData)
  const safeName = (userData && userData.displayName) ? userData.displayName : "Unknown";
  const safeRole = (userData && userData.role) ? userData.role : "user";
  if (nameEl) nameEl.textContent = safeName;
  if (roleEl) {
    roleEl.textContent = safeRole;
    roleEl.classList.add(safeRole); // αν έχεις CSS για ρόλους, θα βαφτεί αυτόματα
  }

  // 2) Προσπάθησε να φέρεις joinedAt/createdAt από /users/{fid}
  try {
    const userRef = ref(db, "users/" + fid);
    get(userRef).then((snap) => {
      const u = snap.val() || {};
      const joinedTs = u.joinedAt || u.createdAt || null;
      if (joinedEl) joinedEl.textContent = tsToLocal(joinedTs);
    }).catch(() => {
      if (joinedEl) joinedEl.textContent = "—";
    });
  } catch {
    if (joinedEl) joinedEl.textContent = "—";
  }

  // 3) Live status listener από /status/{fid}
  let statusRefObj = null;
  try {
    statusRefObj = ref(db, "status/" + fid);
    onValue(statusRefObj, (s) => {
      const st = (s && s.val) ? (s.val() || {}) : {};
      const online = st.state === "online";
      if (statusEl) {
        statusEl.innerHTML = online
          ? `<span class="dot online"></span> Online`
          : `<span class="dot offline"></span> Offline`;
      }
      const last = st.last_changed || st.lastChanged || null;
      if (seenEl) seenEl.textContent = online ? "—" : tsToLocal(last);
    });
  } catch {
    if (statusEl) statusEl.textContent = "—";
    if (seenEl)   seenEl.textContent = "—";
  }

  // 4) Καθαρισμός listener όταν κλείνει το modal (χωρίς leaks)
  const cleanup = () => {
    try { if (statusRefObj) off(statusRefObj); } catch {}
    modal.removeEventListener("click", onClose);
  };
  const onClose = (e) => {
    // κλείσιμο είτε με το Χ είτε με click στο overlay
    if (e.target.classList && e.target.classList.contains("friend-prof-close")) { cleanup(); }
    if (e.target && e.target.id === "friendProfileModal") { cleanup(); }
  };
  modal.addEventListener("click", onClose);
})();

  // === Κλείσιμο ===
  modal.querySelector(".friend-prof-close").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target.id === "friendProfileModal") modal.remove();
  });
// === Add / Remove Friend Button logic ===
// === Add / Remove Friend Button logic (Live Update) ===
(async function renderFriendAction() {
  const container = modal.querySelector("#fpActionContainer");
  if (!container) return;

  const me = auth.currentUser?.uid;
  if (!me || me === fid) return;

  const friendRef = ref(db, `friends/${me}/${fid}`);

  // 🔄 Live ενημέρωση κατάστασης φίλου
  onValue(friendRef, (snap) => {
    container.innerHTML = "";

    if (snap.exists()) {
      // ❌ Είναι φίλοι → Αφαίρεση
      const btn = document.createElement("button");
      btn.className = "btn small danger remove-friend";
      btn.textContent = "❌ Αφαίρεση φίλου";
      btn.onclick = async () => removeFriend(fid, name || "Unknown");
      container.appendChild(btn);
    } else {
      // ➕ Δεν είναι φίλοι → Προσθήκη
      const btn = document.createElement("button");
      btn.className = "btn small success add-friend";
      btn.textContent = "➕ Προσθήκη φίλου";
      btn.onclick = async () => sendFriendRequest(fid, name || "Unknown");
      container.appendChild(btn);
    }
  });
})();


  // === Tabs logic ===
  modal.querySelectorAll(".fp-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      modal.querySelectorAll(".fp-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.dataset.tab;
      modal.querySelectorAll(".fp-tab-content").forEach(sec => sec.classList.add("hidden"));
      const active = modal.querySelector(`#fp-${target}`);
      if (active) active.classList.remove("hidden");
    });
  });
}
// ===============================================================
// 💬 Friend Item Click — From Friends Tab inside Expanded Profile (Live Data v2)
// ===============================================================
document.addEventListener("click", async (e) => {
  const item = e.target.closest(".fp-friend-item");
  if (!item) return;

  // Αν υπάρχει ήδη bubble → κλείστο
  document.getElementById("fpFriendBubble")?.remove();

  // === Διαβάζουμε UID ===
  // (θα το περάσουμε τώρα στο render του Friends tab, αλλά fallback αν λείπει)
  const fid = item.dataset.uid;
  if (!fid) {
    console.warn("❌ Missing UID for friend item.");
    return;
  }

  // === Φόρτωσε ζωντανά τα δεδομένα του φίλου ===
  let data = {};
  try {
    const snap = await get(ref(db, "users/" + fid));
    data = snap.val() || {};
  } catch (err) {
    console.error("Load friend data error:", err);
  }

  const name = data.displayName || "Unknown";
  const avatar = data.avatar || "";
  const role = data.role || "user";

  // --- Δημιουργία bubble ---
  const bubble = document.createElement("div");
  bubble.id = "fpFriendBubble";
  bubble.className = "fp-friend-bubble";
  bubble.innerHTML = `
    <div class="fp-friend-bubble-inner">
      <div class="fp-friend-bubble-header">
        ${avatar
          ? `<img src="${avatar}" class="fp-friend-avatar" />`
          : `<div class="fp-friend-avatar-default">${name.charAt(0).toUpperCase()}</div>`}
        <div class="fp-friend-bubble-info">
          <div class="fp-friend-bubble-name">${name}</div>
          <div class="fp-friend-bubble-role">${role}</div>
          <div class="fp-friend-bubble-status muted">⏳ Checking...</div>
        </div>
        <button class="fp-friend-bubble-close">✖</button>
      </div>
      <div class="fp-friend-bubble-actions">
        <button class="btn small ghost view-fp-friend" data-uid="${fid}">🔍 Προβολή</button>
        <button class="btn small ghost chat-fp-friend" data-uid="${fid}">💬 Chat</button>
      </div>
    </div>
  `;
  document.body.appendChild(bubble);

  // === Θέση στο κέντρο ===
  bubble.style.position = "fixed";
  bubble.style.top = "50%";
  bubble.style.left = "50%";
  bubble.style.transform = "translate(-50%, -50%)";

  // === Κλείσιμο bubble ===
  bubble.querySelector(".fp-friend-bubble-close").addEventListener("click", () => bubble.remove());
  document.addEventListener("click", (ev) => {
    if (!bubble.contains(ev.target) && !item.contains(ev.target)) bubble.remove();
  }, { once: true });

  // === Live status από /status/{fid} ===
  try {
    const statusRef = ref(db, "status/" + fid);
    onValue(statusRef, (s) => {
      const st = s.val() || {};
      const online = st.state === "online";
      const statusEl = bubble.querySelector(".fp-friend-bubble-status");
      if (statusEl) {
        statusEl.innerHTML = online
          ? `<span class="dot online"></span> Online`
          : `<span class="dot offline"></span> Offline`;
      }
    });
  } catch (err) {
    console.error("Status check error:", err);
  }

  // === View Profile ===
  bubble.querySelector(".view-fp-friend").addEventListener("click", async () => {
    bubble.remove();
    const snap2 = await get(ref(db, "users/" + fid));
    const data2 = snap2.val() || {};
    showFriendProfileExpanded(data2, fid);
  });

  // === Chat (placeholder) ===
  bubble.querySelector(".chat-fp-friend").addEventListener("click", async () => {
    bubble.remove();
    await convoAlert("💬 Σύντομα θα ανοίγει private chat tab με αυτόν τον χρήστη!");
  });
});


// ===============================================================
// 🧠 Friend List Buttons — View / Chat actions
// ===============================================================
document.addEventListener("click", async (e) => {
  // === 🔍 Προβολή προφίλ ===
  if (e.target.classList.contains("view-friend")) {
    const fid = e.target.dataset.uid;
    if (!fid) return;

    try {
      const snap = await get(ref(db, "users/" + fid));
      const data = snap.val();
      if (!data) {
        await convoAlert("❌ Δεν βρέθηκαν δεδομένα χρήστη.");
        return;
      }

      showFriendProfileExpanded(data, fid);
    } catch (err) {
      console.error("View friend error:", err);
      await convoAlert("❌ Σφάλμα κατά τη φόρτωση προφίλ.");
    }
  }

  // === 💬 Chat (placeholder για τώρα) ===
  if (e.target.classList.contains("chat-friend")) {
    const fid = e.target.dataset.uid;
    if (!fid) return;

    await convoAlert("💬 Σύντομα θα ανοίγει private chat tab με αυτόν τον χρήστη!");
  }
});


// ===============================================================
// 🧩 Load friends automatically after login (safe delay)
// ===============================================================
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  // Περίμενε μέχρι να εμφανιστεί το modal DOM
  const checkReady = setInterval(() => {
    if (document.getElementById("friendsList")) {
      clearInterval(checkReady);
      console.log("🕓 FriendsList ready — loading...");
      loadFriendsList();
    }
  }, 500);
});

// ===============================================================
// 🧩 Step 3 — Universal Modal Close (Esc + click outside)
// ===============================================================
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    // Κλείσιμο Profile Modal
    document.getElementById("profileModal")?.classList.add("hidden");
    document.body.classList.remove("modal-open");

    // Κλείσιμο Friend Profile Expanded
    document.getElementById("friendProfileModal")?.remove();

    // Κλείσιμο Mini Profile
    document.getElementById("miniProfileModal")?.remove();

    // Κλείσιμο Gift Picker (αν υπάρχει)
    document.querySelector(".convo-overlay")?.remove();
  }
});

// Κλείσιμο με click έξω από οποιοδήποτε modal box
document.addEventListener("click", (e) => {
  const profileBox = e.target.closest(".modal-box");
  const friendBox  = e.target.closest(".friend-profile-box");
  const miniBox    = e.target.closest(".mini-profile-box");
  const bubbleBox  = e.target.closest(".convo-bubble");
  // Αν κλικάρεις έξω απ' όλα → κλείσε τα overlay
  if (!profileBox && e.target.id === "profileModal") {
    document.getElementById("profileModal")?.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
  if (!friendBox && e.target.id === "friendProfileModal") {
    document.getElementById("friendProfileModal")?.remove();
  }
  if (!miniBox && e.target.id === "miniProfileModal") {
    document.getElementById("miniProfileModal")?.remove();
  }
  if (!bubbleBox && e.target.classList.contains("convo-overlay")) {
    e.target.remove();
  }
});

// ===============================================================
// 🎁 Auto-load Gifts after Auth ready (fix refresh bug)
// ===============================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Δώσε λίγο χρόνο να χτιστεί το modal
    setTimeout(() => {
      loadMyGifts();
    }, 1200);
  }
});
// ===============================================================
// 🎁 Convo Bubble Confirm (Yes / No) — minimal helper
// ===============================================================
function showConvoBubbleConfirm(html) {
  return new Promise((resolve) => {
    // Overlay
    const overlay = document.createElement("div");
    overlay.className = "convo-overlay"; // ήδη το χρησιμοποιούμε και στο close logic
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.45)";
    overlay.style.zIndex = "9999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    // Bubble
    const box = document.createElement("div");
    box.className = "convo-bubble confirm";
    box.style.maxWidth = "420px";
    box.style.width = "min(92vw, 420px)";
    box.style.background = "rgba(25,25,30,0.95)";
    box.style.border = "1px solid rgba(255,255,255,0.12)";
    box.style.borderRadius = "12px";
    box.style.backdropFilter = "blur(8px)";
    box.style.padding = "16px";
    box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";

    // Header + X
    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.alignItems = "center";
    top.style.marginBottom = "8px";
    const h = document.createElement("div");
    h.innerHTML = "Επιβεβαίωση";
    h.style.fontWeight = "700";
    const x = document.createElement("button");
    x.textContent = "×";
    x.style.fontSize = "18px";
    x.style.color = "#ccc";
    x.style.background = "none";
    x.style.border = "none";
    x.style.cursor = "pointer";
    x.addEventListener("click", () => { cleanup(false); });

    // Message
    const msg = document.createElement("div");
    msg.innerHTML = html;
    msg.style.color = "#ddd";
    msg.style.lineHeight = "1.4";
    msg.style.margin = "6px 0 12px";

    // Actions
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "10px";
    actions.style.justifyContent = "flex-end";

    const yes = document.createElement("button");
    yes.textContent = "✅ Ναι";
    yes.style.padding = "8px 12px";
    yes.style.borderRadius = "8px";
    yes.style.border = "none";
    yes.style.cursor = "pointer";
    yes.style.fontWeight = "700";
    yes.style.background = "linear-gradient(90deg,#ffcc70,#ff8c00)";
    yes.style.color = "#000";

    const no = document.createElement("button");
    no.textContent = "❌ Άκυρο";
    no.style.padding = "8px 12px";
    no.style.borderRadius = "8px";
    no.style.border = "1px solid rgba(255,255,255,0.18)";
    no.style.background = "rgba(255,255,255,0.04)";
    no.style.color = "#ddd";
    no.style.cursor = "pointer";

    yes.addEventListener("click", () => { cleanup(true); });
    no.addEventListener("click",  () => { cleanup(false); });

    // Close with ESC / click outside
    const onKey = (e) => { if (e.key === "Escape") cleanup(false); };
    const onClickOutside = (e) => { if (!box.contains(e.target)) cleanup(false); };

    function cleanup(result) {
      document.removeEventListener("keydown", onKey);
      overlay.removeEventListener("click", onClickOutside);
      overlay.remove();
      resolve(result);
    }

    document.addEventListener("keydown", onKey);
    // μόνο click έξω (όχι μέσα)
    overlay.addEventListener("click", onClickOutside);

    top.appendChild(h);
    top.appendChild(x);
    actions.appendChild(no);
    actions.appendChild(yes);
    box.appendChild(top);
    box.appendChild(msg);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}
// ===============================================================
// 🎁 Gift Summary Modal — Εμφάνιση μόνο στο login (one-time list)
// ===============================================================
async function showGiftSummaryModal(entries) {
  // entries: [[giftId, {name, icon, from, sentAt}], ...]

  // φτιάχνουμε λίστα (νεότερα πρώτα)
  const sorted = [...entries].sort(([,a],[,b]) => Number(b.sentAt || 0) - Number(a.sentAt || 0));

    const giftCount = entries.length;
let titleText =
  giftCount === 1
    ? "🎁 Έχεις 1 νέο δώρο"
    : `🎁 Έχεις ${giftCount} νέα δώρα`;

// ➕ Αν είναι πολλά (>5), προσθέτουμε badge highlight
if (giftCount > 5) {
  titleText += ` <span class="gift-count-badge">${giftCount}</span>`;
}
// 🎁 Load Gifts (My Profile) — Real-time refresh + Recent on top



  const itemsHtml = sorted.map(([, g]) => {
    const icon = g.icon || "🎁";
    const name = g.name || "Gift";
    const from = g.from || "—";
    const ts   = g.sentAt ? tsToLocal(Number(g.sentAt)) : "—";
    return `
      <div class="fp-gift-item">
        <div class="fp-gift-icon">${icon}</div>
        <div class="fp-gift-info">
          <div class="fp-gift-name">${name}</div>
          <div class="fp-gift-meta">Από: <span>${from}</span> • <span>${ts}</span></div>
        </div>
      </div>
    `;
  }).join("");

  // χρησιμοποιούμε τα υπάρχοντα Convo overlay/bubble styles για ομοιομορφία
  const overlay = document.createElement("div");
  overlay.className = "convo-overlay";
  overlay.innerHTML = `
    <div class="convo-bubble" style="max-width:560px;width:min(96vw,560px)">
            <div class="bubble-title">${titleText}</div>

      <div class="muted" style="margin:4px 0 10px">Εμφανίζονται μόνο κατά το login, για να μη σε κουράζουν πολλά “OK”.</div>
      <div class="fp-gifts-list" style="max-height:46vh;overflow:auto">${itemsHtml}</div>
      <div class="bubble-buttons" style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px">
        <button id="giftSummaryClose" class="btn small">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

return new Promise((resolve) => {
  const close = () => {
    overlay.remove();
    window.removeEventListener("keydown", onKey);
    resolve(true);
  };

  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
  window.addEventListener("keydown", onKey);

  overlay.querySelector("#giftSummaryClose")?.addEventListener("click", close);
  // κλείσιμο και με click έξω
  overlay.addEventListener("click", (e) => {
    if (e.target.classList.contains("convo-overlay")) close();
  });
});

}


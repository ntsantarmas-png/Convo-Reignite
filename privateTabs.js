// ===============================================================
// 💬 Convo — Private Tabs System (Part B.1 – Chat ID + DB path)
// ===============================================================

import { db, auth } from "./firebaseInit.js";

import { onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { ref, get, set, child } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { convoAlert } from "./convoAlerts.js";

import { loadPrivateMessages } from "./chatMessages.js";

// === Δημιουργεί σταθερό Chat ID για 2 UIDs ===
export function getPrivateChatId(uid1, uid2) {
  if (!uid1 || !uid2) return null;
  // ταξινόμηση αλφαβητικά για σταθερό ID
  return [uid1, uid2].sort().join("_");
}

// === Ελέγχει αν υπάρχει chat στη DB και το δημιουργεί αν όχι ===
export async function ensurePrivateChatExists(chatId, uid1, uid2) {
  if (!chatId) return null;

  const chatRef = ref(db, "v3/privateChats/" + chatId);
  const snap = await get(chatRef);
  if (!snap.exists()) {
    await set(chatRef, {
      participants: {
        [uid1]: true,
        [uid2]: true
      },
      createdAt: Date.now()
    });
    console.log("🆕 Private chat created:", chatId);
  } else {
    console.log("✅ Private chat exists:", chatId);
  }
  return chatRef;
}

// === Απλό layout test (όπως στο Part A) ===
export function initPrivateTabs() {
  const bar = document.getElementById("privateTabsBar");
  if (!bar) return;

  // 🔹 Απόκρυψε τη μπάρα αν δεν υπάρχουν active private tabs
  bar.innerHTML = "";
  bar.classList.add("hidden");
}


// ===============================================================
// 💬 Open Private Chat (Part B.3 – Create + Show Tab)
// ===============================================================
export async function openPrivateChat(targetUid, targetName) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return alert("Not logged in!");

    // === 1️⃣ Δημιούργησε ή πάρε Chat ID ===
    // ✅ Δημιουργία σταθερού chatId (ίδιο και για τους δύο χρήστες)
const chatId =
  currentUser.uid < targetUid
    ? `${currentUser.uid}_${targetUid}`
    : `${targetUid}_${currentUser.uid}`;

    if (!chatId) return;
    // === Δημιουργία κόμβου στη βάση (αν δεν υπάρχει ακόμα) ===
const chatRef = ref(db, `v3/privateChats/${chatId}`);
const snap = await get(chatRef);
if (!snap.exists()) {
  await set(chatRef, {
    createdAt: Date.now(),
    participants: {
      [currentUser.uid]: true,
      [targetUid]: true
    },
    users: {
      [currentUser.uid]: true,
      [targetUid]: true
    },
    messages: {} // ✅ Δημιουργούμε άδειο node για σωστή δομή
  });
  console.log("🆕 Private chat created (with participants & messages):", chatId);
}




    // === 2️⃣ Δημιούργησε το chat στη DB αν δεν υπάρχει ===
    await ensurePrivateChatExists(chatId, currentUser.uid, targetUid);

    // === 3️⃣ Εμφάνισε τη μπάρα tabs (αν είναι κρυμμένη) ===
    const bar = document.getElementById("privateTabsBar");
    if (!bar) return;
    bar.classList.remove("hidden");

    // === 4️⃣ Έλεγξε αν υπάρχει ήδη tab για αυτό το chat ===
    let existingTab = bar.querySelector(`[data-chatid="${chatId}"]`);
    if (!existingTab) {
      // Δημιουργία νέου tab
      const tab = document.createElement("div");
      tab.className = "private-tab";
      tab.dataset.chatid = chatId;
      tab.dataset.uid = targetUid;
tab.innerHTML = `<span class="tab-label">💬 ${targetName}</span> <span class="tab-close">✕</span>`;
      bar.appendChild(tab);

      // Κλικ στο tab → ενεργοποίηση
      tab.addEventListener("click", () => setActivePrivateTab(chatId));
    // === Close tab με click στο ✕ ===
tab.querySelector(".tab-close").addEventListener("click", (e) => {
  e.stopPropagation(); // μην ενεργοποιήσει το setActive
  closePrivateTab(chatId);
});

    }

    // === Εμφάνισε τη DM Action Bar ===
const dmActionBar = document.getElementById("dmActionBar");
if (dmActionBar) {
  dmActionBar.classList.remove("hidden");
}

    // === 5️⃣ Ενεργοποίησε αυτό το tab ===
    setActivePrivateTab(chatId);
  } catch (err) {
    console.error("❌ openPrivateChat error:", err);
  }
  // 🕓 Ενημέρωσε το lastRead (DM ανοίχτηκε)
  const currentChatId = window.currentPrivateChatId || null;
  if (currentChatId) {
    import("./dmNotifier.js").then(({ updateLastRead }) => {
      updateLastRead(currentChatId);
    });
  }


}



// === Απόκρυψε το DM Action Bar όταν επιστρέφεις στο main chat ===
const messagesSection = document.getElementById("messages");
if (messagesSection) {
  // Ελέγχουμε κάθε φορά που φορτώνεται το main chat αν υπάρχει DM ενεργό
  const observer = new MutationObserver(() => {
    if (!window.currentPrivateChatId && dmActionBar) {
      dmActionBar.classList.add("hidden");
    }
  });
  observer.observe(messagesSection, { childList: true, subtree: false });
}


// === Helper: Ενεργοποίηση tab ===
function setActivePrivateTab(chatId) {
  // 🔹 Όταν ανοίγει private chat → αφαίρεσε active από τα rooms
  document.querySelectorAll(".room-item.active").forEach((el) => {
    el.classList.remove("active");
  });
    const bar = document.getElementById("privateTabsBar");
  const mainChat = document.getElementById("messages");
  if (!bar || !mainChat) return;

  // Αφαίρεσε active από όλα τα tabs
  bar.querySelectorAll(".private-tab").forEach(tab => tab.classList.remove("active"));

  // Ενεργοποίησε το επιλεγμένο tab
  const activeTab = bar.querySelector(`[data-chatid="${chatId}"]`);
  if (activeTab) activeTab.classList.add("active");

  // Εμφάνισε τη μπάρα (αν είναι κρυφή)
  bar.classList.remove("hidden");
  bar.style.display = "flex";

  // Αποθήκευσε το ενεργό DM
  window.currentPrivateChatId = chatId;

  // Καθάρισε το main chat για να εμφανιστεί μόνο το DM
  mainChat.innerHTML = `<p style="opacity:.6;text-align:center;">💬 Opening private chat...</p>`;

  // === Καθάρισε listeners του main chat πριν ανοίξει το DM ===
import("./chatMessages.js").then(async ({ off, ref, db, loadPrivateMessages }) => {
  try {
    // 🔹 Σταμάτα κάθε listener που αφορά το main chat
    off(ref(db, "v3/messages/general"));
    off(ref(db, "v3/messages"));
    console.log("🧹 Stopped main chat listeners before DM load");
  } catch (err) {
    console.warn("⚠️ Cleanup issue stopping main listeners:", err);
  }

  // 🔹 Καθάρισε πλήρως το περιεχόμενο του chat
  const mainChat = document.getElementById("messages");
  if (mainChat) mainChat.innerHTML = `<p style="opacity:.6;text-align:center;">💬 Loading DM...</p>`;

  // 🔹 Φόρτωσε τα DM μηνύματα
  loadPrivateMessages(chatId);
});

  // 🔹 Ενημέρωσε τα labels του DM Action Bar
const user = auth.currentUser;
if (user) {
  const event = new CustomEvent("openDmTab", { detail: { chatId } });
  window.dispatchEvent(event);
}


  console.log("💬 Active Private Chat:", chatId);
} // ✅ Κλείνει σωστά τη setActivePrivateTab

  // ✅ Σβήσε τελίτσα ειδοποίησης όταν ανοίγει αυτό το DM
  if (window.dmNotifDot && !window.dmNotifDot.classList.contains("hidden")) {
    console.log("🧹 Καθάρισμα DM ειδοποίησης για ενεργό chat:", chatId);
    dmNotifDot.style.transition = "opacity 0.25s ease";
    dmNotifDot.style.opacity = "0";
    setTimeout(() => {
      dmNotifDot.classList.add("hidden");
      dmNotifDot.style.opacity = "";
      dmNotifDot.style.transition = "";
    }, 250);
  }

// ✅ Καθάρισε DM ειδοποίηση μόλις ανοίξεις το συγκεκριμένο DM
if (window.dmNotifDot && !window.dmNotifDot.classList.contains("hidden")) {
  console.log("🧹 Καθάρισμα DM ειδοποίησης για ενεργό chat:", chatId);
  window.dmNotifDot.classList.add("hidden");
}

// ============================================================================
// 📝 DM DRAFTS SYSTEM — Αποθήκευση & Επαναφορά ανά Private Chat
// ============================================================================
let dmDrafts = JSON.parse(localStorage.getItem("dmDrafts") || "{}");

// 🔹 Όταν ανοίγει ένα DM tab → φόρτωσε draft
window.addEventListener("openDmTab", (e) => {
  const { chatId } = e.detail || {};
  const msgInput = document.getElementById("messageInput");
  if (!msgInput) return;

  if (chatId && dmDrafts[chatId]) {
    msgInput.value = dmDrafts[chatId];
    msgInput.style.height = "auto";
    msgInput.style.height = msgInput.scrollHeight + "px";
  } else {
    msgInput.value = "";
    msgInput.style.height = "40px";
  }
});

// 🔹 Όταν πληκτρολογείς → αποθήκευσε draft για το ενεργό DM
document.getElementById("messageInput")?.addEventListener("input", () => {
  const activeDm = window.currentPrivateChatId;
  if (!activeDm) return;
  const msgInput = document.getElementById("messageInput");
  if (!msgInput) return;
  dmDrafts[activeDm] = msgInput.value;
  localStorage.setItem("dmDrafts", JSON.stringify(dmDrafts));
});

// 🔹 Όταν στέλνεις μήνυμα → καθάρισε το draft του συγκεκριμένου DM
document.getElementById("messageForm")?.addEventListener("submit", () => {
  const activeDm = window.currentPrivateChatId;
  if (!activeDm) return;
  delete dmDrafts[activeDm];
  localStorage.setItem("dmDrafts", JSON.stringify(dmDrafts));
});

// ===============================================================
// ❌ Close Private Tab + Return to Main Chat
// ===============================================================
function closePrivateTab(chatId) {
    // 🧹 Καθάρισε DM listeners πριν την επιστροφή στο main chat
  import("./chatMessages.js").then(({ off, ref, db }) => {
    if (window.currentPrivateChatId) {
      try {
        off(ref(db, `v3/privateChats/${window.currentPrivateChatId}/messages`));
        console.log("🧹 DM listener cleared for:", window.currentPrivateChatId);
      } catch (err) {
        console.warn("⚠️ Listener cleanup issue:", err);
      }
    }
  });

  const bar = document.getElementById("privateTabsBar");
  const tab = bar?.querySelector(`[data-chatid="${chatId}"]`);
  if (tab) tab.remove();

  // Αν δεν έμεινε κανένα ανοιχτό DM → επιστροφή στο main chat
  const tabsLeft = bar?.querySelectorAll(".private-tab") || [];
  if (tabsLeft.length === 0) {
    bar.style.display = "none";
    window.currentPrivateChatId = null;
    import("./chatMessages.js").then(({ loadRoomMessages }) => {
      loadRoomMessages(localStorage.getItem("lastRoom") || "general");
    });
    // === Απόκρυψε το DM Action Bar όταν δεν υπάρχουν DM ===
const dmActionBar = document.getElementById("dmActionBar");
if (dmActionBar) {
  dmActionBar.classList.add("hidden");
}
console.log("↩️ Returned to main chat");

  } else {
    // Ενεργοποίησε το τελευταίο ανοιχτό DM αν υπάρχει
    const last = tabsLeft[tabsLeft.length - 1];
    const lastId = last.dataset.chatid;
    setActivePrivateTab(lastId);
  }
} // ✅ τέλος closePrivateTab

// ===============================================================
// 🔄 Live Rename Sync (UID-based, real-time update on DM tabs)
// ===============================================================

const usersRef = ref(db, "users");

onValue(usersRef, (snapshot) => {
  const usersData = snapshot.val() || {};
  const tabs = document.querySelectorAll(".private-tab");

  tabs.forEach((tab) => {
    const uid = tab.dataset.uid;
    const user = usersData[uid];
    if (!user) return;

    const labelEl = tab.querySelector(".tab-label");
    if (labelEl && labelEl.textContent.replace("💬 ", "") !== user.displayName) {
      labelEl.textContent = "💬 " + user.displayName;
    }
  });
});



// ===============================================================
// 💬 DM Notifications Dropdown Popup — Convo Style (Auto clear dot)
// ===============================================================
dmNotifBtn?.addEventListener("click", async () => {
  try {
    // ✅ Fade-out Convo style (αν υπάρχει τελίτσα)
    if (dmNotifDot && !dmNotifDot.classList.contains("hidden")) {
      dmNotifDot.style.transition = "opacity 0.25s ease";
      dmNotifDot.style.opacity = "0";
      setTimeout(() => {
        dmNotifDot.classList.add("hidden");
        dmNotifDot.style.opacity = "";
        dmNotifDot.style.transition = "";
      }, 250);
    }

    const user = auth.currentUser;
    if (!user) return;
    const myUid = user.uid;

    // Αν υπάρχει ήδη popup → κλείστο
    let existing = document.getElementById("dmPopup");
    if (existing) {
      existing.remove();
      return;
    }

    // Δημιούργησε το popup
    const popup = document.createElement("div");
    popup.id = "dmPopup";
    popup.className = "dm-popup";
    popup.innerHTML = `<p class="popup-title">📥 Εισερχόμενα DMs</p>
                       <div class="popup-list"><p style="opacity:.6;text-align:center;">Φόρτωση...</p></div>`;
    document.body.appendChild(popup);
// === DM NOTIF CLOSE HANDLERS (Esc / click outside / X button) ===

// 🅧 Κουμπί κλεισίματος πάνω δεξιά
const closeBtn = document.createElement("button");
closeBtn.className = "popup-close";
closeBtn.innerHTML = "×";
closeBtn.addEventListener("click", () => popup.remove());
popup.appendChild(closeBtn);

// ⌨️ Κλείσιμο με ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") popup.remove();
});

// 🖱️ Κλείσιμο με click εκτός popup (εκτός του dmNotifBtn)
setTimeout(() => {
  document.addEventListener(
    "click",
    (e) => {
      if (!popup.contains(e.target) && e.target !== dmNotifBtn) {
        popup.remove();
      }
    },
    { once: true }
  );
}, 100);

    // Θέση κάτω από το κουμπί 💬
    const rect = dmNotifBtn.getBoundingClientRect();
    popup.style.position = "fixed";
    popup.style.top = rect.bottom + 8 + "px";
    popup.style.right = window.innerWidth - rect.right + "px";

    // === Φόρτωση συνομιλιών (Convo-safe — πιο πρόσφατα επάνω) ===
const privChatsRef = ref(db, "v3/privateChats");
const snap = await get(privChatsRef);
const listDiv = popup.querySelector(".popup-list");
listDiv.innerHTML = "";

let found = 0;
const items = []; // προσωρινή λίστα DM items

snap.forEach((chatSnap) => {
  const chatData = chatSnap.val() || {};
  const chatId = chatSnap.key;
  const participants = chatData.participants || chatData.users || {};
  if (!participants[myUid]) return;

  found++;

  const otherUid = Object.keys(participants).find((uid) => uid !== myUid);
  if (!otherUid) return;

  const userRef = ref(db, "users/" + otherUid);
  get(userRef).then((userSnap) => {
    const userData = userSnap.val() || {};
    if (!userSnap.exists()) return;
    const displayName = userData.displayName || "Guest";

    const msgsRef = ref(db, `v3/privateChats/${chatId}/messages`);
    get(msgsRef).then((msgSnap) => {
      let preview = "—";
      msgSnap.forEach((m) => {
        preview = m.val().text || "[media]";
      });

      const item = document.createElement("div");
      item.className = "popup-item";
// === Προεπισκόπηση DM με ώρα και unread dot ===
const lastReadRef = ref(db, `v3/privateChats/${chatId}/lastRead/${myUid}`);
get(lastReadRef).then((lastSnap) => {
  const lastRead = lastSnap.exists() ? lastSnap.val() : 0;
  let latestMsg = null;
  msgSnap.forEach((m) => {
    latestMsg = m.val();
  });

  const msgTime = latestMsg?.createdAt || latestMsg?.timestamp || Date.now();
  const isUnread = msgTime > lastRead;

  // Φόρμα ώρας (π.χ. 22:35 ή 29/10)
  const dateObj = new Date(msgTime);
  const now = new Date();
  const isToday = dateObj.toDateString() === now.toDateString();
  const timeStr = isToday
    ? dateObj.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })
    : `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

  item.className = `popup-item ${isUnread ? "unread" : "read"}`;
  item.innerHTML = `
    <div class="popup-item-top">
      <strong>${displayName}</strong>
      <span class="popup-time">${timeStr}</span>
    </div>
    <div class="popup-preview">
      ${isUnread ? `<span class="popup-dot"></span>` : ""}
      ${preview}
    </div>
  `;
});
      item.addEventListener("click", () => {
        popup.remove();
        import("./privateTabs.js").then(({ openPrivateChat }) => {
          openPrivateChat(otherUid, displayName);
        });
      });

      // 🧠 Αντί να το προσθέσουμε τώρα, το βάζουμε προσωρινά στη λίστα
      items.push(item);
    });
  });
});

// 🕓 Μικρή καθυστέρηση για να ολοκληρωθούν τα async gets
setTimeout(() => {
  if (items.length === 0 && found === 0) {
    listDiv.innerHTML = `<p style="opacity:.6;text-align:center;">Δεν υπάρχουν DMs ακόμα.</p>`;
    return;
  }
  listDiv.innerHTML = "";
  // ➕ Ανάποδη προσθήκη: το πιο πρόσφατο (τελευταίο στο snapshot) μπαίνει πρώτο
  for (let i = items.length - 1; i >= 0; i--) {
    listDiv.appendChild(items[i]);
  }
}, 250);




    if (found === 0) {
      listDiv.innerHTML = `<p style="opacity:.6;text-align:center;">Δεν υπάρχουν DMs ακόμα.</p>`;
    }

    // Κλείσιμο με click έξω
    document.addEventListener(
      "click",
      (e) => {
        if (!popup.contains(e.target) && e.target !== dmNotifBtn) {
          popup.remove();
        }
      },
      { once: true }
    );
  } catch (err) {
    console.error("❌ DM Popup Error:", err);
  }
});

// ===============================================================
// 🫂 FRIEND REQUESTS POPUP — Convo Style (Newest First + Time)
// ===============================================================
const friendReqBtn = document.getElementById("friendReqBtn");
const friendReqDot = document.getElementById("friendReqDot");
// ===============================================================
// 🩸 FRIEND REQUEST DOT — Ενεργοποίηση μόνο με νέα αιτήματα
// ===============================================================
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  const myUid = user.uid;

  const reqRef = ref(db, `friendRequests/${myUid}`);
  const lastOpenedRef = ref(db, `friendReqOpened/${myUid}`);

  const [reqSnap, openedSnap] = await Promise.all([get(reqRef), get(lastOpenedRef)]);
  const lastOpened = openedSnap.exists() ? openedSnap.val() : 0;

  let hasNew = false;
  reqSnap.forEach((child) => {
    const r = child.val();
    if (r.timestamp && r.timestamp > lastOpened) hasNew = true;
  });

  if (hasNew) {
    friendReqDot.classList.remove("hidden");
  } else {
    friendReqDot.classList.add("hidden");
  }
});

friendReqBtn?.addEventListener("click", async () => {
  try {
    // Fade-out τελίτσα αν υπάρχει
    if (friendReqDot && !friendReqDot.classList.contains("hidden")) {
      friendReqDot.style.transition = "opacity 0.25s ease";
      friendReqDot.style.opacity = "0";
      setTimeout(() => {
        friendReqDot.classList.add("hidden");
        friendReqDot.style.opacity = "";
        friendReqDot.style.transition = "";
      }, 250);
    }

    const user = auth.currentUser;
    if (!user) return;
    const myUid = user.uid;
    // 🕓 Ενημέρωση τελευταίου ανοίγματος Friend Requests
const lastOpenedRef = ref(db, `friendReqOpened/${myUid}`);
await set(lastOpenedRef, Date.now());


    // Αν υπάρχει ήδη popup → κλείστο
    let existing = document.getElementById("friendReqPopup");
    if (existing) {
      existing.remove();
      return;
    }

    // Δημιουργία popup
    const popup = document.createElement("div");
    popup.id = "friendReqPopup";
    popup.className = "dm-popup";
    popup.innerHTML = `<p class="popup-title">🫂 Αιτήματα Φιλίας</p>
                       <div class="popup-list"><p style="opacity:.6;text-align:center;">Φόρτωση...</p></div>`;
    document.body.appendChild(popup);

    // ✖️ Κουμπί κλεισίματος
    const closeBtn = document.createElement("button");
    closeBtn.className = "popup-close";
    closeBtn.innerHTML = "×";
    closeBtn.addEventListener("click", () => popup.remove());
    popup.appendChild(closeBtn);

    // Κλείσιμο με ESC / click έξω
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") popup.remove();
    });
    setTimeout(() => {
      document.addEventListener("click", (e) => {
        if (!popup.contains(e.target) && e.target !== friendReqBtn) popup.remove();
      }, { once: true });
    }, 100);

    // Θέση popup κάτω από το 🫂 κουμπί
    const rect = friendReqBtn.getBoundingClientRect();
    popup.style.position = "fixed";
    popup.style.top = rect.bottom + 8 + "px";
    popup.style.right = window.innerWidth - rect.right + "px";

    // === Ανάγνωση friend requests από Firebase ===
    const reqRef = ref(db, `friendRequests/${myUid}`);
    const snap = await get(reqRef);
    const listDiv = popup.querySelector(".popup-list");
    listDiv.innerHTML = "";

    const requests = [];
    snap.forEach((childSnap) => {
      const req = childSnap.val();
      req.uid = childSnap.key;
      requests.push(req);
    });

    // Ταξινόμηση κατά timestamp (νεότερο επάνω)
    requests.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (requests.length === 0) {
      listDiv.innerHTML = `<p style="opacity:.6;text-align:center;">Κανένα αίτημα φιλίας.</p>`;
      return;
    }

    // Δημιουργία entries
    for (const req of requests) {
      const item = document.createElement("div");
      item.className = "popup-item";

      const date = new Date(req.timestamp || Date.now());
      const now = Date.now();
      const isNew = now - (req.timestamp || 0) < 86400000; // < 24h
      const formatted = date.toLocaleString("el-GR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      item.classList.add(isNew ? "unread" : "read");
      item.innerHTML = `
        <div class="popup-item-top">
          <strong>${req.fromName || "Άγνωστος"}</strong>
          <span class="popup-time">${formatted}</span>
        </div>
        <div class="popup-preview">
          ${isNew ? `<span class="popup-dot"></span>` : ""}
          Θέλει να γίνει φίλος σου 🫶
        </div>
      `;

      listDiv.appendChild(item);
    }
  } catch (err) {
    console.error("❌ Friend Request Popup Error:", err);
  }
});

// ===============================================================
// 💬 DM ACTION BAR — Button Functions (Firebase Toggle Edition)
// ===============================================================
const ignoreBtn = document.getElementById("ignoreBtn");
const muteBtn = document.getElementById("muteBtn");
const clearBtn = document.getElementById("clearBtn");
const closeDmBtn = document.getElementById("closeDmBtn");

// === Helper για ενημέρωση label κουμπιών ===
function updateDmButtons(state = {}) {
  ignoreBtn.textContent = state.ignored ? "✅ Unignore" : "🚫 Ignore";
  muteBtn.textContent = state.muted ? "🔔 Unmute" : "🔕 Mute";
}

// === Helper για λήψη & ενημέρωση status από DB ===
async function refreshDmStatus(chatId, uid) {
  const settingsRef = ref(db, `v3/privateChats/${chatId}/settings`);
  const snap = await get(settingsRef);
  const data = snap.val() || {};

  const ignored = !!data.ignoredBy?.[uid];
  const muted = !!data.mutedBy?.[uid];

  updateDmButtons({ ignored, muted });

// === Ενημέρωση DM tab με icons ===
const tabEl = document.querySelector(`[data-chatid="${chatId}"]`);
if (tabEl) {
  let icons = "";
  if (ignored && muted) icons = "🚫🔕";
  else if (ignored) icons = "🚫";
  else if (muted) icons = "🔕";

  // Εμφάνισε τα icons δεξιά από το όνομα
  const existing = tabEl.querySelector(".dm-status-icon");
  if (existing) existing.textContent = icons;
  else {
    const span = document.createElement("span");
    span.className = "dm-status-icon";
    span.textContent = icons;
    span.style.marginLeft = "6px";
    tabEl.appendChild(span);
  }
}


  return { ignored, muted };
}


// === Όταν ανοίγουμε DM tab, ενημερώνουμε τα labels ===
window.addEventListener("openDmTab", async (e) => {
  const { chatId } = e.detail || {};
  const user = auth.currentUser;
  if (!chatId || !user) return;
  await refreshDmStatus(chatId, user.uid);
});

// 🚫 Ignore Toggle
ignoreBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  const chatId = window.currentPrivateChatId;
  if (!user || !chatId) return;

  const settingsRef = ref(db, `v3/privateChats/${chatId}/settings/ignoredBy/${user.uid}`);
  const { ignored } = await refreshDmStatus(chatId, user.uid);
  if (ignored) {
    await set(settingsRef, null);
    convoAlert("✅ Unignored", "Ο χρήστης επανήλθε στα DMs σου.");
  } else {
    await set(settingsRef, true);
    convoAlert("🚫 Ignored", "Αγνόησες προσωρινά αυτό το DM.");
  }
  await refreshDmStatus(chatId, user.uid);
});

// 🔕 Mute Toggle
muteBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  const chatId = window.currentPrivateChatId;
  if (!user || !chatId) return;

  const settingsRef = ref(db, `v3/privateChats/${chatId}/settings/mutedBy/${user.uid}`);
  const { muted } = await refreshDmStatus(chatId, user.uid);
  if (muted) {
    await set(settingsRef, null);
    convoAlert("🔔 Unmuted", "Θα λαμβάνεις ξανά ειδοποιήσεις για αυτό το DM.");
  } else {
    await set(settingsRef, true);
    convoAlert("🔕 Muted", "Αυτό το DM σίγησε προσωρινά.");
  }
  await refreshDmStatus(chatId, user.uid);
});

// 🗑️ Clear (τοπικό)
clearBtn?.addEventListener("click", () => {
  const mainChat = document.getElementById("messages");
  if (mainChat) {
    mainChat.innerHTML = `<p style="opacity:.6;text-align:center;">🗑️ Τα μηνύματα καθαρίστηκαν (μόνο τοπικά).</p>`;
  }
  console.log("🧹 DM messages cleared locally");
});

// ❌ Close — κλείνει το ενεργό DM tab
closeDmBtn?.addEventListener("click", () => {
  if (!window.currentPrivateChatId) return;
  closePrivateTab(window.currentPrivateChatId);
});




// ===============================================================
// 🚪 CLEAR ACTIVE DM TAB όταν μπαίνεις σε room (π.χ. general)
// ===============================================================
window.addEventListener("roomChanged", () => {
  const bar = document.getElementById("privateTabsBar");
  if (!bar) return;
  bar.querySelectorAll(".private-tab.active").forEach(tab => {
    tab.classList.remove("active");
  });
});



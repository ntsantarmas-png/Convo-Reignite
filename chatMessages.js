// ============================================================================
// 💬 CHAT MESSAGES — με υποστήριξη Rooms (Send + Receive)
// ============================================================================
import {
  ref,
  push,
  onChildAdded,
  onChildRemoved,
  serverTimestamp,
  remove,
  set,
  off,
  get
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";



import { auth, db } from "./firebaseInit.js";
import { setTypingState } from "./typing.js";
import { showConvoAlert, showConvoPrompt } from "./app.js";

// ============================================================================
// 🏠 Rooms System — Part B (Setup)
// ============================================================================
let currentRoom = "general";          // προεπιλεγμένο δωμάτιο
let messagesRef = null;               // active reference
let unsubscribe = null;               // για καθάρισμα listener

// === DOM Elements ===
const mainChat = document.getElementById("mainChat");
const messagesDiv = document.getElementById("messages");
const msgForm = document.getElementById("messageForm");
const msgInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearChatBtn");
console.log("🧹 ClearChat button found:", !!clearBtn);

const adminMenu = document.getElementById("adminContextMenu");
let currentMsgEl = null;


// ============================================================================
// 📂 Φόρτωση μηνυμάτων για συγκεκριμένο room
// ============================================================================
export function loadRoomMessages(roomId) {
  // === Εντοπισμός του main chat ===
  const mainChat = document.getElementById("messages");
  if (!mainChat) {
    console.warn("⚠️ mainChat not found yet, retrying...");
    setTimeout(() => loadRoomMessages(roomId), 300);
    return;
  }

  // --- Καθαρισμός παλιού listener ---
  if (messagesRef) off(messagesRef); // σταματάει τον προηγούμενο

  // --- Νέο room ---
  currentRoom = roomId;
  messagesRef = ref(db, `v3/messages/${roomId}`);
  mainChat.innerHTML = `<p style="opacity:0.6;text-align:center;">📂 Loading ${roomId}...</p>`;
  

  // --- Φόρτωση νέων μηνυμάτων ---
  // --- Φόρτωση νέων μηνυμάτων (single source of truth) ---
onChildAdded(messagesRef, renderMessage);
console.log("📡 onChildAdded is active for:", roomId);

// === Όταν ένα μήνυμα διαγραφεί (από admin ή clear) ===

onChildRemoved(messagesRef, (snap) => {
  const msgId = snap.key;
  const el = document.querySelector(`[data-id="${msgId}"]`);
  if (el) el.remove();

  // Αν δεν έμεινε κανένα μήνυμα, δείξε το "empty" hint
  if (!messagesDiv.querySelector(".message")) {
    messagesDiv.innerHTML = `<div class="empty-hint">👋 Καλωσήρθες! Στείλε το πρώτο σου μήνυμα.</div>`;
  }
});

  console.log(`✅ Now viewing room: ${roomId}`);
}


// ============================================================================
// ✉️ Αποστολή μηνύματος στο ενεργό room
// ============================================================================
sendBtn.addEventListener("click", async () => {
  const text = msgInput.value.trim();
  if (!text) return;
  if (!messagesRef) return;

  await push(messagesRef, {
    uid: auth.currentUser?.uid || "guest",
    username: auth.currentUser?.displayName || "Guest",
    text,
    createdAt: serverTimestamp(),
  });

  msgInput.value = "";
  msgInput.focus();
});
// ============================================================================
// 🔁 Room Change Event — Επικοινωνία με Rooms Panel
// ============================================================================
window.addEventListener("roomChanged", (e) => {
  const newRoom = e.detail.roomId;
  console.log("📦 Switching to room:", newRoom);
  
  loadRoomMessages(newRoom);
});

// === Αρχική φόρτωση default room ===
window.addEventListener("load", () => {
  // Ελέγχουμε ότι υπάρχει το mainChat πριν το χρησιμοποιήσουμε
  const mainChat = document.getElementById("mainChat");
  if (!mainChat) {
    console.warn("⚠️ mainChat not found in DOM yet.");
    return;
  }

  loadRoomMessages(currentRoom);
});



// === ENTER to send / SHIFT+ENTER for newline ===
if (msgInput && msgForm) {
  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();         // μην κάνει newline
      msgForm.requestSubmit();    // στείλε το μήνυμα
    }
  });
}

// === Typing indicator updates ===
let typingTimeout;
msgInput.addEventListener("input", () => {
  setTypingState(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTypingState(false), 1500);
});


// === SEND MESSAGE ===
if (msgForm) {
  msgForm.addEventListener("submit", async (e) => {
    e.preventDefault();
  const user = auth.currentUser;   // ✅ μετακινήθηκε εδώ
console.log("🟢 Message submit triggered");
  // === Ban Check (block banned users) ===
  if (user) {
    try {
      const userRef = ref(db, `users/${user.uid}/banned`);
      const snap = await get(userRef);
      const isBanned = snap.exists() && snap.val() === true;

      if (isBanned) {
        showConvoAlert("🚫 Έχεις αποκλειστεί από το chat.");
        msgInput.value = "";
        msgInput.blur();
        return; // ⛔ stop send
      }
    } catch (err) {
      console.error("Ban check error:", err);
    }
  }

    // === Block send for guests ===
// === Block send for guests (Read-Only Mode) ===
if (!user || user.isAnonymous) {
  // Μην επιτρέπεις αποστολή, αλλά χωρίς alert ή redirect
  const msgInput = document.getElementById("messageInput");
  if (msgInput) {
    msgInput.blur();
  }
  return; // ⛔ Stop message send
}



    const text = msgInput.value.trim();
    if (!text) return;

if (!user) return showConvoAlert("⚠️ Δεν είσαι συνδεδεμένος!");
// === Mute Check (Block muted users per room) ===
const roomName = window.currentRoom || localStorage.getItem("lastRoom") || "general";
const muteRef = ref(db, `v3/rooms/${roomName}/mutes/${user.uid}`);
const muteSnap = await get(muteRef);

if (muteSnap.exists()) {
  showConvoAlert("🔇 Είσαι σε mute σε αυτό το δωμάτιο και δεν μπορείς να στείλεις μηνύματα ή emoji.");
  msgInput.value = "";
  msgInput.blur();
  return; // ⛔ Stop message send
}

    try {
      const msgRef = ref(db, `v3/messages/${currentRoom}`);
await push(msgRef, {

  uid: user.uid,
  username: user.displayName || "Guest",
  text,
  createdAt: serverTimestamp(),
});


      msgInput.value = "";
      msgInput.style.height = "40px"; // επαναφορά ύψους
    } catch (err) {
showConvoAlert("❌ Σφάλμα αποστολής: " + err.message);
    }
  });
}

// === RECEIVE MESSAGES (Realtime) ===
// === RECEIVE MESSAGES (Realtime) ===
function renderMessage(data) {
  const msg = data.val();

  // 🔔 ΕΙΔΙΚΟ: System message τύπου "🎵 X ακούει: <link>"
  if (msg.system) {
    const el = document.createElement("div");
    el.classList.add("system-message");

    // Βρες YouTube url και κάνε το "Παίξε το τραγούδι"
    const ytRegex = /(https?:\/\/(?:www\.)?youtu(?:\.be|be\.com)\/[^\s]+)/i;
    const match = (msg.text || "").match(ytRegex);
    if (match) {
      const url = match[1];
      const safe = msg.text.replace(
        url,
        `<a href="#" class="yt-play" data-url="${url}">🎬 Παίξε το τραγούδι</a>`
      );
      el.innerHTML = safe;
    } else {
      el.textContent = msg.text || "";
    }

    // Click -> ενημερώνει το youtube.js να παίξει αυτό το url
    el.addEventListener("click", (e) => {
      const a = e.target.closest(".yt-play");
      if (!a) return;
      e.preventDefault();
      const url = a.dataset.url;
      window.dispatchEvent(new CustomEvent("playYouTubeVideo", { detail: { url } }));
    });

    messagesDiv.appendChild(el);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return; // ✅ τέλειωσε η απόδοση για system message
  }

  // ---- Κανονικό user μήνυμα (όπως πριν) ----
  const el = document.createElement("div");
  el.classList.add("message");

  const name = msg.username || "Guest";
  const text = msg.text || "";
  const time = new Date(msg.createdAt || Date.now()).toLocaleTimeString("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  el.innerHTML = `
    <div class="msg-header">
      <span class="msg-user">${name}</span>
      <span class="msg-time">${time}</span>
    </div>
    <div class="msg-text">${text.replace(/\n/g, '<br>')}</div>
  `;

  // data-ids για admin actions
  el.dataset.id = data.key;
  el.dataset.uid = msg.uid || "";

  // Admin context menu (όπως ήδη είχες)
  el.addEventListener("contextmenu", (e) => {
    console.log("📎 contextmenu fired — isAdmin?", isAdmin(), "displayName:", auth.currentUser?.displayName);
    if (!isAdmin()) return;
    e.preventDefault();
    currentMsgEl = el;
    adminMenu.style.top = e.clientY + "px";
    adminMenu.style.left = e.clientX + "px";
    adminMenu.classList.remove("hidden");
  });

  messagesDiv.appendChild(el);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


export function initMessagesListener(roomId = "general") {
  const msgRef = ref(db, `v3/messages/${roomId}`);
  onChildAdded(msgRef, renderMessage);
  console.log(`📡 Listening for messages in room: ${roomId}`);
}


// ============================================================================
// ADMIN — CLEAR CHAT (Step 1)
// ============================================================================
function isAdmin() {
  const u = auth.currentUser;
  if (!u) return false;
  const name = (u.displayName || "").toLowerCase();
  // προσωρινός κανόνας μέχρι το role persistence
  return name === "mysteryman" || name.includes("admin");
}

if (clearBtn) {
  clearBtn.addEventListener("click", async () => {
    if (!isAdmin()) { showConvoAlert("⛔ Μόνο για Admins."); return; }
const res = await showConvoPrompt(`🧹 Clear all messages για το room ‘${currentRoom}’; Αυτό δεν αναιρείται.`);
if (res !== "ok") return;


    try {
  if (!messagesRef) return;
  await remove(messagesRef);
  addAdminLog(`🧹 Cleared all messages in ${currentRoom}`);
} catch (err) {
  showConvoAlert("❌ Σφάλμα στο clear: " + err.message);
}

  });
}

// === Admin menu click ===
if (adminMenu) {
adminMenu.addEventListener("click", async (e) => {
  let action = e.target.closest("[data-action]")?.dataset.action;
console.log("🧩 Admin menu click:", action);

if (!currentMsgEl) return;

// ❌ βγάλε τη δεύτερη δήλωση — κρατάμε μόνο τη μία
// const action = e.target.dataset.action;  <-- σβήστο

    const msgId = currentMsgEl.dataset.id;
    if (!msgId || !action) return;

    adminMenu.classList.add("hidden");

    // === DELETE MESSAGE ===
    if (action === "delete") {
  const confirmDel = await showConvoPrompt("🗑️ Θες σίγουρα να διαγράψεις αυτό το μήνυμα;");
  if (confirmDel !== "ok") return;

  try {
    await remove(ref(db, `v3/messages/${currentRoom}/${msgId}`));
    addAdminLog(`🗑️ Deleted message in ${currentRoom}`);

    // ✅ Προσθέτουμε έλεγχο εδώ
    if (currentMsgEl) currentMsgEl.remove();

    showConvoAlert("✅ Το μήνυμα διαγράφηκε.");
  } catch (err) {
    console.error("❌ Delete error:", err);
    showConvoAlert("⚠️ Σφάλμα στη διαγραφή — δες κονσόλα.");
  } finally {
    currentMsgEl = null;
  }
}
// === MUTE USER ===
if (action === "mute") {
  console.log("🎯 Action MUTE triggered for:", currentRoom);

  const username = currentMsgEl.querySelector(".msg-user")?.textContent || "Unknown";
  const targetUid = currentMsgEl.dataset.uid || "";
  const confirmMute = await showConvoPrompt(
    `🔇 Θες να κάνεις mute τον χρήστη ${username};`
  );
  if (confirmMute !== "ok") return;

  try {
    // --- γράφουμε στο v3/muted/{roomId}/{uid} ---
    await set(ref(db, `v3/muted/${currentRoom}/${targetUid}`), true);

    // --- log στο adminLogs ---
    await push(ref(db, "adminLogs"), {
      type: "mute",
      targetUid,
      targetName: username,
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      room: currentRoom,
      createdAt: serverTimestamp(),
    });

    showConvoAlert(`🔇 Ο χρήστης ${username} τέθηκε σε mute στο room "${currentRoom}".`);
  } catch (err) {
    console.error("Mute error:", err);
    showConvoAlert("❌ Σφάλμα στο mute — δες κονσόλα.");
  } finally {
    currentMsgEl = null;
  }
}

    
  }); // ✅ Κλείνει το event listener του adminMenu
} // ✅ Κλείνει το if(adminMenu)
  


// ============================================================================
// ADMIN LOG — Helper Function
// ============================================================================
function addAdminLog(action) {
  const u = auth.currentUser;
  if (!u) return;
  const logRef = ref(db, "adminLogs");
  push(logRef, {
    action,
    by: u.displayName || "Unknown",
    timestamp: Date.now(),
  });
}

// === Κλείσιμο του menu όταν κάνεις click έξω ===
document.addEventListener("click", (e) => {
  if (!adminMenu.contains(e.target)) {
    setTimeout(() => {
      adminMenu.classList.add("hidden");
      currentMsgEl = null;
    }, 100); // 🕐 100ms delay so menu actions still register
  }
});

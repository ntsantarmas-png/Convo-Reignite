// ============================================================================
// 💬 CHAT MESSAGES — με υποστήριξη Rooms (Send + Receive)
// ============================================================================
import {
  ref,
  push,
  onChildAdded,
  serverTimestamp,
  remove,
  set,
  off
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

import { auth, db } from "./firebaseInit.js";
import { setTypingState } from "./typing.js";

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
const adminMenu = document.getElementById("adminContextMenu");
let currentMsgEl = null;


// ============================================================================
// 📂 Φόρτωση μηνυμάτων για συγκεκριμένο room
// ============================================================================
export function loadRoomMessages(roomId) {
  // --- Καθαρισμός παλιού listener ---
  if (messagesRef) off(messagesRef); // σταματάει τον προηγούμενο

  // --- Νέο room ---
  currentRoom = roomId;
  messagesRef = ref(db, `v3/messages/${roomId}`);
  mainChat.innerHTML = `<p style="opacity:0.6;text-align:center;">📂 Loading ${roomId}...</p>`;

  // --- Φόρτωση νέων μηνυμάτων ---
  onChildAdded(messagesRef, (snap) => {
    const msg = snap.val();
    if (!msg) return;

    const div = document.createElement("div");
    div.classList.add("message");
    div.innerHTML = `<strong>${msg.username || "Guest"}:</strong> ${msg.text}`;
    mainChat.appendChild(div);
    mainChat.scrollTop = mainChat.scrollHeight;
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

    if (!user) return alert("⚠️ Not logged in!");

    try {
      const msgRef = ref(db, "messages/general");
      await push(msgRef, {
        uid: user.uid,
        username: user.displayName || "Guest",
        text,
        createdAt: serverTimestamp(),
      });

      msgInput.value = "";
      msgInput.style.height = "40px"; // επαναφορά ύψους
    } catch (err) {
      alert("❌ Σφάλμα αποστολής: " + err.message);
    }
  });
}

// === RECEIVE MESSAGES (Realtime) ===
function renderMessage(data) {
  const msg = data.val();
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

  // === Σύνδεση UID Firebase ===
   el.dataset.id = data.key;

  el.addEventListener("contextmenu", (e) => {
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

export function initMessagesListener() {
  const msgRef = ref(db, "messages/general");
  onChildAdded(msgRef, renderMessage);
  console.log("📡 Listening for messages...");
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
    if (!isAdmin()) { alert("⛔ Μόνο για Admins."); return; }
    const ok = confirm("🧹 Clear all messages για το room ‘general’; Αυτό δεν αναιρείται.");
    if (!ok) return;

    try {
      await remove(ref(db, "messages/general"));
      addAdminLog("🧹 Cleared all messages in general");

      // καθάρισε και το UI + επανάφερε το hint
      if (messagesDiv) {
        messagesDiv.innerHTML = `<div class="empty-hint">👋 Καλωσήρθες! Στείλε το πρώτο σου μήνυμα.</div>`;
        messagesDiv.scrollTop = 0;
      }
    } catch (err) {
      alert("❌ Σφάλμα στο clear: " + err.message);
    }
  });
}

// === Admin menu click ===
if (adminMenu) {
  adminMenu.addEventListener("click", async (e) => {
    if (!currentMsgEl) return;
    const msgId = currentMsgEl.dataset.id;
    if (!msgId) return;

    try {
      await remove(ref(db, "messages/general/" + msgId));
addAdminLog("🗑️ Deleted a message");

      currentMsgEl.remove();
    } catch (err) {
      console.error("❌ Delete error:", err);
    } finally {
      adminMenu.classList.add("hidden");
      currentMsgEl = null;
    }
  });
}
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
    adminMenu.classList.add("hidden");
    currentMsgEl = null;
  }
});

// ============================================================================
// CHAT MESSAGES — Step 4 (Send + Receive)
// ============================================================================
import { ref, push, onChildAdded, serverTimestamp, remove, set }
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth, db } from "./firebaseInit.js";
import { setTypingState } from "./typing.js";


// === DOM refs ===
const messagesDiv = document.getElementById("messages");
const msgForm = document.getElementById("messageForm");
const msgInput = document.getElementById("messageInput");
const clearBtn = document.getElementById("clearChatBtn");
const adminMenu = document.getElementById("adminContextMenu");
let currentMsgEl = null;

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
    const text = msgInput.value.trim();
    if (!text) return;

    const user = auth.currentUser;
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

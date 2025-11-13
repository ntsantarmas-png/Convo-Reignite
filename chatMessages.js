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
  get,
  update
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { convoAlert, convoConfirm, convoPrompt } from "./convoAlerts.js";


import { currentUserData } from "./currentUser.js"; // 🔝 πρόσθεσε το στην αρχή του αρχείου (αν δεν υπάρχει)

import { auth, db } from "./firebaseInit.js";
import { getUserAvatarHTML } from "./avatarSystem.js";
import { setTypingState } from "./typing.js";
import { toggleReaction, renderReactions } from "./reactions.js";



import { closeEmojiPanelOnSend } from "./emojiPanel.js";
import { initMentionsPanel } from "./mentionsPanel.js";

// ===============================================================
// 🧩 Live Avatar Refresh — ενημέρωση avatars σε πραγματικό χρόνο
// ===============================================================
import { onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// ============================================================================
// 🔔 Mention Sound Effect
// ============================================================================
function playMentionSound() {
  try {
    const audio = new Audio("/sounds/mention.mp3");
    audio.volume = 0.5; // 🎚️ πιο ήπια ένταση
    audio.play().catch(() => {}); // αγνόησε browser auto-play μπλοκάρισμα
  } catch (err) {
    console.warn("⚠️ Mention sound failed:", err.message);
  }
}

export function initAvatarWatcher() {
  const usersRef = ref(db, "users");

  onValue(usersRef, (snapshot) => {
    const usersData = snapshot.val() || {};
    const allMessages = document.querySelectorAll(".message");

    allMessages.forEach((msg) => {
      const uid = msg.dataset.uid;
      const avatarBox = msg.querySelector(".msg-avatar");
      if (!uid || !avatarBox) return;

      const user = usersData[uid];
      if (!user) return;

      const newAvatar = user.avatar;
      const displayName = user.displayName || "User";
      const initials = displayName.charAt(0).toUpperCase();

      // === Smooth fade transition ===
avatarBox.classList.add("updating");

setTimeout(() => {
  if (newAvatar) {
    avatarBox.innerHTML = `<img src="${newAvatar}" alt="${displayName}" class="convo-avatar" />`;
  } else {
    avatarBox.innerHTML = `<div class="convo-avatar-default">${initials}</div>`;
  }

  avatarBox.classList.remove("updating");
}, 150);

    });
  });

  console.log("🧠 Live avatar watcher ενεργό!");
}


// ============================================================================
// 🏠 Rooms System — Part B (Setup)
// ============================================================================
let currentRoom = "general";          // προεπιλεγμένο δωμάτιο
let messagesRef = null;               // active reference
let unsubscribe = null;               // για καθάρισμα listener

// === Private Chat Support ===
let currentPrivateChatId = null;
let privateMessagesRef = null;

// === DOM Elements ===
const mainChat = document.getElementById("mainChat");
const messagesDiv = document.getElementById("messages");
const newMsgAlert = document.getElementById("newMessageAlert");
const msgForm = document.getElementById("messageForm");
const msgInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
// ===============================================================
// 💬 Initialize Mentions Panel (once)
// ===============================================================
if (msgInput) {
  initMentionsPanel(msgInput);
  console.log("✅ Mentions panel initialized");
}


const clearBtn = document.getElementById("clearChatBtn");
// ===============================================================
// 💬 Reply System — Step 1A (UI state)
// ===============================================================
let replyTarget = null; // αποθηκεύει { id, username, text }
const replyBar = document.createElement("div");
replyBar.id = "replyBar";
replyBar.className = "reply-bar hidden";
replyBar.innerHTML = `
  <div class="reply-info">
    <span id="replyUser"></span>:
    <span id="replyText"></span>
  </div>
  <button id="cancelReplyBtn">✖</button>
`;
msgForm.parentElement.insertBefore(replyBar, msgForm);

// Cancel button
document.getElementById("cancelReplyBtn").addEventListener("click", () => {
  replyTarget = null;
  replyBar.classList.add("hidden");
});
// ===============================================================
// 💫 Reply System — ESC to cancel (Main & DM)
// ===============================================================
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !replyBar.classList.contains("hidden")) {
    replyTarget = null;
    replyBar.classList.add("hidden");

    // optional μικρό animation feedback
    replyBar.animate(
      [
        { opacity: 1 },
        { opacity: 0 }
      ],
      { duration: 150, easing: "ease-out" }
    );
  }
});

replyBar.animate(
  [
    { opacity: 0, transform: "translateY(6px)" },
    { opacity: 1, transform: "translateY(0)" }
  ],
  { duration: 250, easing: "ease-out" }
);

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
// 🛑 Σταμάτα τυχόν DM listener πριν φορτώσει room
if (privateMessagesRef) off(privateMessagesRef);
currentPrivateChatId = null;

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
  // === Ενημέρωσε τη λίστα των rooms για να φανεί ποιο είναι ενεργό ===
document.querySelectorAll(".room-item").forEach(el => {
  el.classList.toggle("active", el.dataset.room === roomId);
});

}
// ============================================================================
// 💬 Φόρτωση Private Chat Μηνυμάτων (με Ignore Filter)
// ============================================================================
export async function loadPrivateMessages(chatId) {
  const mainChat = document.getElementById("messages");
  if (!mainChat) return console.warn("⚠️ mainChat not found for DM.");

  // 🧹 Καθάρισε προηγούμενο listener
  if (privateMessagesRef) off(privateMessagesRef);

  // ✅ Σωστό sync για τρέχον DM
  if (typeof window !== "undefined") window.currentPrivateChatId = null;
  currentPrivateChatId = chatId;
  window.currentPrivateChatId = chatId;
  console.log("💬 Active DM ChatID set:", chatId);

  // 📡 Συνδέσου μόνο στο σωστό path
  privateMessagesRef = ref(db, `v3/privateChats/${chatId}/messages`);
  mainChat.innerHTML = `<p style="opacity:0.6;text-align:center;">💬 Loading private chat...</p>`;

  // === UID του τρέχοντος χρήστη ===
  const user = auth.currentUser;
  if (!user) return;
  const myUid = user.uid;

  // === Έλεγχος Ignore ===
  const ignoreRef = ref(db, `v3/privateChats/${chatId}/settings/ignoredBy/${myUid}`);
  const ignoreSnap = await get(ignoreRef);
  const isIgnoring = ignoreSnap.exists();

  // === Live Mute Sync ===
  const muteRef = ref(db, `v3/privateChats/${chatId}/settings/mutedBy/${myUid}`);
  onValue(muteRef, (snap) => {
    const isMuted = snap.exists();
    window.currentDmMuted = isMuted;
    console.log("🔕 Live mute sync:", chatId, "| Muted:", isMuted);
  });

  // === Listener νέων μηνυμάτων ===
  onChildAdded(privateMessagesRef, (snap) => {
    const msg = snap.val();
    if (!msg) return;

    // 🚫 Αν αγνοώ τον χρήστη και δεν είναι δικό μου μήνυμα → skip
    if (isIgnoring && msg.uid && msg.uid !== myUid) {
      console.log("🚫 Ignored message skipped:", msg.text);
      return;
    }

    // 🚫 Αν για κάποιο λόγο περάσει public message → skip
    if (msg.roomType && msg.roomType !== "dm") {
      console.warn("⚠️ Skipped non-DM message inside DM chat:", msg.text);
      return;
    }

    // ✅ Render μόνο των DM μηνυμάτων
    renderMessage(snap);
  });

  // === Listener για διαγραφή ===
  onChildRemoved(privateMessagesRef, (snap) => {
    const el = document.querySelector(`[data-id="${snap.key}"]`);
    if (el) el.remove();
  });

  // === Auto-scroll στο τέλος ===
  setTimeout(() => {
    const messagesDiv = document.getElementById("messages");
    if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 400);

  console.log("📡 Listening to private chat:", chatId, "| Ignore:", isIgnoring);
}


// ============================================================================
// ✉️ Αποστολή μηνύματος στο ενεργό room
// ============================================================================
//sendBtn.addEventListener("click", async () => {
  //const text = msgInput.value.trim();
  //if (!text) return;
  //if (!messagesRef) return;

  //await push(messagesRef, {
    //uid: auth.currentUser?.uid || "guest",
    //username: auth.currentUser?.displayName || "Guest",
    //text,
    //createdAt: serverTimestamp(),
  //});

  //msgInput.value = "";
  //msgInput.focus();
//});
// ============================================================================
// 🔁 Room Change Event — Επικοινωνία με Rooms Panel
// ============================================================================
window.addEventListener("roomChanged", (e) => {
  const newRoom = e.detail.roomId;
  console.log("📦 Switching to room:", newRoom);
  
  loadRoomMessages(newRoom);
});

// ===============================================================
// 🚀 Wait for userReady before loading chat (single safe run)
// ===============================================================
window.addEventListener("userReady", () => {
  // 🔒 Safety flag – να γίνει μόνο 1 φορά
  if (window.__chatInitialized) {
    console.log("💬 Chat already initialized — skipping duplicate call.");
    return;
  }

  const mainChat = document.getElementById("mainChat");

  if (!mainChat) {
    console.warn("⚠️ mainChat not found in DOM yet — retrying in 200ms...");
    setTimeout(() => window.dispatchEvent(new CustomEvent("chatRetry")), 200);
    return;
  }

  window.__chatInitialized = true;
  console.log("✅ Chat initialized after userReady");
  loadRoomMessages(currentRoom);
});

// ===============================================================
// 🔁 Chat retry event (χωρίς looping userReady)
// ===============================================================
window.addEventListener("chatRetry", () => {
  if (window.__chatInitialized) return;

  const mainChat = document.getElementById("mainChat");
  if (!mainChat) {
    setTimeout(() => window.dispatchEvent(new CustomEvent("chatRetry")), 200);
    return;
  }

  window.__chatInitialized = true;
  console.log("✅ Chat initialized on retry");
  loadRoomMessages(currentRoom);
});
  // ✅ Αν θες, εδώ μπορείς να καλέσεις και άλλα modules:
  // initPresence();
  // initPulse();
  // initRooms();




// === ENTER to send / SHIFT+ENTER for newline + Mentions Safe ===
if (msgInput && msgForm) {
  msgInput.addEventListener("keydown", (e) => {
    const popup = document.querySelector(".mention-popup");
    const popupOpen = popup && popup.style.display !== "none";

    // 🔹 SHIFT + ENTER → νέα γραμμή
    if (e.key === "Enter" && e.shiftKey) {
      return; // επιτρέπει φυσιολογικό newline
    }

    // 🔹 ENTER χωρίς shift
    if (e.key === "Enter" && !e.shiftKey) {
      if (popupOpen) {
        // ✅ αν είναι ανοιχτό το mentions popup → κάνε επιλογή αντί για send
        e.preventDefault();
        const active = popup.querySelector(".mention-item.active");
        if (active) active.click();
        return;
      }

      // ✅ κανονική αποστολή
      e.preventDefault();
      msgForm.requestSubmit();
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
// ============================================================================
// 📝 ROOM DRAFTS SYSTEM — Αποθήκευση & Επαναφορά ανά Room
// ============================================================================
let roomDrafts = JSON.parse(localStorage.getItem("roomDrafts") || "{}");

// 🔹 Φόρτωση draft όταν αλλάζει room
window.addEventListener("roomChanged", (e) => {
  const roomId = e.detail?.roomId || localStorage.getItem("lastRoom") || "general";
  if (!msgInput) return;

  // Αν υπάρχει αποθηκευμένο draft για το room
  if (roomDrafts[roomId]) {
    msgInput.value = roomDrafts[roomId];
    msgInput.style.height = "auto";
    msgInput.style.height = msgInput.scrollHeight + "px";
  } else {
    msgInput.value = "";
    msgInput.style.height = "40px";
  }
});

// 🔹 Αποθήκευση draft κάθε φορά που πληκτρολογείς
msgInput.addEventListener("input", () => {
  // Αν είσαι σε private chat, ΜΗΝ πειράζεις τα room drafts
  if (window.currentPrivateChatId) return;

  const activeRoom = window.currentRoom || localStorage.getItem("lastRoom") || "general";
  roomDrafts[activeRoom] = msgInput.value;
  localStorage.setItem("roomDrafts", JSON.stringify(roomDrafts));
});


// 🔹 Καθάρισε draft όταν σταλεί μήνυμα
msgForm.addEventListener("submit", () => {
  const activeRoom = window.currentRoom || localStorage.getItem("lastRoom") || "general";
  delete roomDrafts[activeRoom];
  localStorage.setItem("roomDrafts", JSON.stringify(roomDrafts));
});


// === SEND MESSAGE ===
if (msgForm) {
  msgForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    closeEmojiPanelOnSend(); // ✅ Κλείσε το emoji panel μετά την αποστολή

  const user = auth.currentUser;   // ✅ μετακινήθηκε εδώ
console.log("🟢 Message submit triggered");
  // === Ban Check (block banned users) ===
  if (user) {
    try {
      const userRef = ref(db, `users/${user.uid}/banned`);
      const snap = await get(userRef);
      const isBanned = snap.exists() && snap.val() === true;

      if (isBanned) {
        convoAlert("🚫 Έχεις αποκλειστεί από το chat.");
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

// ===============================================================
// 🧩 Ενοποιημένο Mentions + Αποστολή Μηνύματος (DM & Rooms)
// ===============================================================

// Αν δεν υπάρχει text, σταμάτα
const text = msgInput.value.trim();
if (!text) return;

// Αν δεν υπάρχει user, σταμάτα
if (!user) return convoAlert("⚠️ Δεν είσαι συνδεδεμένος!");

// === Mute Check (Block muted users per room) ===
const roomName = window.currentRoom || localStorage.getItem("lastRoom") || "general";
const muteRef = ref(db, `v3/rooms/${roomName}/mutes/${user.uid}`);
const muteSnap = await get(muteRef);
if (muteSnap.exists()) {
  convoAlert("🔇 Είσαι σε mute σε αυτό το δωμάτιο και δεν μπορείς να στείλεις μηνύματα ή emoji.");
  msgInput.value = "";
  msgInput.blur();
  return;
}

// ===============================================================
// ✏️ Mentions Detection (Safe για DM και Rooms)
// ===============================================================
const mentionRegex = /@(\w+)/g;
const found = [...text.matchAll(mentionRegex)].map(m => m[1]);
let mentions = [];

if (found.length > 0) {
  try {
    const usersSnap = await get(ref(db, "users"));
    const usersData = usersSnap.val() || {};

    mentions = Object.keys(usersData).filter(uid =>
      found.some(
        n =>
          (usersData[uid].displayName || "").toLowerCase() === n.toLowerCase()
      )
    );

    console.log("🧩 Found mentions:", found);
    console.log("✅ Matched user IDs:", mentions);
  } catch (err) {
    console.error("⚠️ Mention lookup error:", err);
  }
}

// ===============================================================
// 🚀 Ενιαία Αποστολή Μηνύματος (DM ή Room)
// ===============================================================
const isDM = !!window.currentPrivateChatId;
const messageData = {
  uid: user.uid,
  username: currentUserData.displayName || user.displayName || "Guest",
  text,
  createdAt: serverTimestamp(),
  mentions: mentions,
  ...(replyTarget ? { replyTo: replyTarget } : {})
};

if (isDM) {
  // === DM Message ===
  const chatId = window.currentPrivateChatId;
  const msgRef = ref(db, `v3/privateChats/${chatId}/messages`);
  messageData.roomType = "dm";
  messageData.chatId = chatId;
  await push(msgRef, messageData);
  console.log("💬 Sent DM message:", messageData);
} else {
  // === Room Message ===
  const msgRef = ref(db, `v3/messages/${roomName}`);
  messageData.roomType = "room";
  messageData.roomId = roomName;
  await push(msgRef, messageData);
  console.log("💬 Sent Room message:", messageData);
}

// ===============================================================
// ✅ Καθάρισε μετά την αποστολή
// ===============================================================
replyTarget = null;
replyBar.classList.add("hidden");
msgInput.value = "";
msgInput.style.height = "40px";
setTimeout(() => {
  const messagesDiv = document.getElementById("messages");
  if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
}, 300);
// =============================================================
// ⚙️ Command Parser — Part 1 (/me)
// =============================================================
if (text.startsWith("/")) {
  const parts = text.split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ").trim();

  // === /me <κείμενο> ===
  if (command === "/me" && args) {
    const displayName =
      currentUserData?.displayName ||
      auth.currentUser?.displayName ||
      "Κάποιος";
    const actionText = `${displayName} ${args}`;

    // Ενεργό chat target (room ή DM)
    const targetRef = window.currentPrivateChatId
      ? ref(db, `v3/privateChats/${window.currentPrivateChatId}/messages`)
      : ref(db, `v3/messages/${currentRoom}`);

    await push(targetRef, {
      text: actionText,
      system: true,
      type: "action",
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return; // ✅ σταματά εδώ — δεν στέλνει κανονικό μήνυμα
  }
    // === /ban #room <nickname> ===
  if (command === "/ban") {
    if (!isAdmin()) {
      convoAlert("⛔ Μόνο οι admins μπορούν να κάνουν ban χρήστες.");
      return;
    }

    // ➕ Ανάλυση /ban #room <nickname> [reason...]
const parts2 = args.trim().split(" ");
const roomArg = parts2[0];
const nickArg = parts2[1];
const reason = parts2.slice(2).join(" ") || "χωρίς λόγο";


    if (!roomArg || !nickArg || !roomArg.startsWith("#")) {
      convoAlert("❗ Σύνταξη: /ban #room <nickname>");
      return;
    }

    const roomName = roomArg.slice(1); // π.χ. "#general" → "general"

    // ➕ Αναζήτηση UID χρήστη στη λίστα users
    const usersSnap = await get(ref(db, "users"));
    const usersData = usersSnap.val() || {};
    const targetUid = Object.keys(usersData).find(
      (uid) =>
        (usersData[uid].displayName || "").toLowerCase() ===
        nickArg.toLowerCase()
    );

    if (!targetUid) {
      convoAlert(`⚠️ Δεν βρέθηκε χρήστης με όνομα ${nickArg}.`);
      return;
    }

    // 🚫 Μην επιτρέπεις ban στον ίδιο ή στον MysteryMan
    if (
      targetUid === auth.currentUser.uid ||
      targetUid === "LNT3cUi6sUPW3I1FCGSZMJVAymv1"
    ) {
      convoAlert("🚫 Δεν μπορείς να κάνεις ban αυτόν τον χρήστη.");
      return;
    }

    // ➕ Καταχώρηση ban
    await set(ref(db, `v3/rooms/${roomName}/bans/${targetUid}`), true);
// 🔹 Global flag για User Manager
await update(ref(db, `users/${targetUid}`), { banned: true });

    // ➕ Log στο adminLogs
    await push(ref(db, "adminLogs"), {
  type: "ban",
  action: "banUser",
  room: roomName,
  targetUid,
  targetName: nickArg,
  reason, // ➕ προστέθηκε ο λόγος
  adminUid: auth.currentUser.uid,
  adminName: auth.currentUser.displayName || "Admin",
  text: `🚫 ${nickArg} έγινε ban από το room "${roomName}" (λόγος: ${reason})`,
  createdAt: serverTimestamp(),
});


    // ➕ Εμφάνιση στο chat (system message)
    const sysRef = ref(db, `v3/messages/${roomName}`);
    await push(sysRef, {
text: `🚫 ${nickArg} αποκλείστηκε από το room από τον ${auth.currentUser.displayName} (λόγος: ${reason}).`,
      system: true,
      type: "ban",
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }

  // === /kick #room <nickname> [reason...] ===
  if (command === "/kick") {
    if (!isAdmin()) {
      convoAlert("⛔ Μόνο οι admins μπορούν να κάνουν kick χρήστες.");
      return;
    }

    // ➕ Ανάλυση /kick #room <nickname> [reason...]
    const parts3 = args.trim().split(" ");
    const roomArg = parts3[0];
    const nickArg = parts3[1];
    const reason = parts3.slice(2).join(" ") || "χωρίς λόγο";

    if (!roomArg || !nickArg || !roomArg.startsWith("#")) {
      convoAlert("❗ Σύνταξη: /kick #room <nickname>");
      return;
    }

    const roomName = roomArg.slice(1);

    // ➕ Αναζήτηση UID του χρήστη
    const usersSnap = await get(ref(db, "users"));
    const usersData = usersSnap.val() || {};
    const targetUid = Object.keys(usersData).find(
      (uid) =>
        (usersData[uid].displayName || "").toLowerCase() ===
        nickArg.toLowerCase()
    );

    if (!targetUid) {
      convoAlert(`⚠️ Δεν βρέθηκε χρήστης με όνομα ${nickArg}.`);
      return;
    }

    // 🚫 Προστασία MysteryMan και self-kick
    if (
      targetUid === auth.currentUser.uid ||
      targetUid === "LNT3cUi6sUPW3I1FCGSZMJVAymv1"
    ) {
      convoAlert("🚫 Δεν μπορείς να κάνεις kick αυτόν τον χρήστη.");
      return;
    }

    // ➕ Καταχώρηση στο kicks list
    await set(ref(db, `v3/rooms/${roomName}/kicks/${targetUid}`), true);

    // ➕ Log στο adminLogs
    await push(ref(db, "adminLogs"), {
      type: "kick",
      action: "kickUser",
      room: roomName,
      targetUid,
      targetName: nickArg,
      reason,
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      text: `👢 ${nickArg} έγινε kick από το room "${roomName}" (λόγος: ${reason})`,
      createdAt: serverTimestamp(),
    });

    // ➕ System message
    const sysRef = ref(db, `v3/messages/${roomName}`);
    await push(sysRef, {
      text: `👢 ${nickArg} αποβλήθηκε προσωρινά από το room από τον ${auth.currentUser.displayName} (λόγος: ${reason}).`,
      system: true,
      type: "kick",
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }
  // === /mute #room <nickname> [reason...] ===
  if (command === "/mute") {
    if (!isAdmin()) {
      convoAlert("⛔ Μόνο οι admins μπορούν να κάνουν mute χρήστες.");
      return;
    }

    // ➕ Ανάλυση /mute #room <nickname> [reason...]
    const parts4 = args.trim().split(" ");
    const roomArg = parts4[0];
    const nickArg = parts4[1];
    const reason = parts4.slice(2).join(" ") || "χωρίς λόγο";

    if (!roomArg || !nickArg || !roomArg.startsWith("#")) {
      convoAlert("❗ Σύνταξη: /mute #room <nickname>");
      return;
    }

    const roomName = roomArg.slice(1);

    // ➕ Αναζήτηση UID χρήστη
    const usersSnap = await get(ref(db, "users"));
    const usersData = usersSnap.val() || {};
    const targetUid = Object.keys(usersData).find(
      (uid) =>
        (usersData[uid].displayName || "").toLowerCase() ===
        nickArg.toLowerCase()
    );

    if (!targetUid) {
      convoAlert(`⚠️ Δεν βρέθηκε χρήστης με όνομα ${nickArg}.`);
      return;
    }

    // 🚫 Προστασία MysteryMan & self-mute
    if (
      targetUid === auth.currentUser.uid ||
      targetUid === "LNT3cUi6sUPW3I1FCGSZMJVAymv1"
    ) {
      convoAlert("🚫 Δεν μπορείς να κάνεις mute αυτόν τον χρήστη.");
      return;
    }

    // ➕ Καταχώρηση mute
    await set(ref(db, `v3/rooms/${roomName}/mutes/${targetUid}`), true);

    // ➕ Log στο adminLogs
    await push(ref(db, "adminLogs"), {
      type: "mute",
      action: "muteUser",
      room: roomName,
      targetUid,
      targetName: nickArg,
      reason,
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      text: `🔇 ${nickArg} μπήκε σε mute στο "${roomName}" (λόγος: ${reason})`,
      createdAt: serverTimestamp(),
    });

    // ➕ System message
    const sysRef = ref(db, `v3/messages/${roomName}`);
    await push(sysRef, {
      text: `🔇 ${nickArg} μπήκε σε mute από τον ${auth.currentUser.displayName} (λόγος: ${reason}).`,
      system: true,
      type: "mute",
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }
  // === /unmute #room <nickname> ===
  if (command === "/unmute") {
    if (!isAdmin()) {
      convoAlert("⛔ Μόνο οι admins μπορούν να κάνουν unmute χρήστες.");
      return;
    }

    const parts5 = args.trim().split(" ");
    const roomArg = parts5[0];
    const nickArg = parts5[1];

    if (!roomArg || !nickArg || !roomArg.startsWith("#")) {
      convoAlert("❗ Σύνταξη: /unmute #room <nickname>");
      return;
    }

    const roomName = roomArg.slice(1);

    // ➕ Αναζήτηση UID χρήστη
    const usersSnap = await get(ref(db, "users"));
    const usersData = usersSnap.val() || {};
    const targetUid = Object.keys(usersData).find(
      (uid) =>
        (usersData[uid].displayName || "").toLowerCase() ===
        nickArg.toLowerCase()
    );

    if (!targetUid) {
      convoAlert(`⚠️ Δεν βρέθηκε χρήστης με όνομα ${nickArg}.`);
      return;
    }

    // ➕ Διαγραφή από mutes
    await remove(ref(db, `v3/rooms/${roomName}/mutes/${targetUid}`));

    // ➕ Log στο adminLogs
    await push(ref(db, "adminLogs"), {
      type: "mute",
      action: "unmuteUser",
      room: roomName,
      targetUid,
      targetName: nickArg,
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      text: `🔊 ${nickArg} βγήκε από mute στο "${roomName}".`,
      createdAt: serverTimestamp(),
    });

    // ➕ System message
    const sysRef = ref(db, `v3/messages/${roomName}`);
    await push(sysRef, {
      text: `🔊 ${nickArg} βγήκε από mute από τον ${auth.currentUser.displayName}.`,
      system: true,
      type: "unmute",
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }
  // === /announce <μήνυμα> ===
  if (command === "/announce") {
    if (!isAdmin()) {
      convoAlert("⛔ Μόνο οι admins μπορούν να στέλνουν ανακοινώσεις.");
      return;
    }

    const announcement = args.trim();
    if (!announcement) {
      convoAlert("❗ Σύνταξη: /announce <μήνυμα>");
      return;
    }

    const roomName = window.currentRoom || localStorage.getItem("lastRoom") || "general";

    // 🧩 Καταγραφή στο adminLogs
    await push(ref(db, "adminLogs"), {
      type: "announce",
      action: "announceMessage",
      room: roomName,
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      text: `📢 Ανακοίνωση: ${announcement}`,
      createdAt: serverTimestamp(),
    });

    // 💬 System message με highlight
    const sysRef = ref(db, `v3/messages/${roomName}`);
    await push(sysRef, {
      text: `📢 [Announcement] ${announcement}`,
      system: true,
      type: "announce",
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }
  // === /clear #room ===
  if (command === "/clear") {
    if (!isAdmin()) {
      convoAlert("⛔ Μόνο οι admins μπορούν να καθαρίσουν ένα room.");
      return;
    }

    const parts6 = args.trim().split(" ");
    const roomArg = parts6[0];

    if (!roomArg || !roomArg.startsWith("#")) {
      convoAlert("❗ Σύνταξη: /clear #room");
      return;
    }

    const roomName = roomArg.slice(1);

    // ✅ Επιβεβαίωση ασφάλειας
    const confirmClear = await convoConfirm(`🧹 Θες σίγουρα να καθαρίσεις το #${roomName};`);
    if (!confirmClear) return;

    // 🗑️ Διαγραφή όλων των μηνυμάτων στο room
    await remove(ref(db, `v3/messages/${roomName}`));

    // 📜 Log στο adminLogs
    await push(ref(db, "adminLogs"), {
      type: "clear",
      action: "clearRoom",
      room: roomName,
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      text: `🧹 Ο ${auth.currentUser.displayName} καθάρισε το room "${roomName}".`,
      createdAt: serverTimestamp(),
    });

    // 📢 System message (μετά το clear)
    await push(ref(db, `v3/messages/${roomName}`), {
      text: `🧹 Το chat καθαρίστηκε από τον ${auth.currentUser.displayName}.`,
      system: true,
      type: "clear",
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }
  // === /role <nickname> <admin|vip|user> ===
  if (command === "/role") {
    if (!isAdmin()) {
      convoAlert("⛔ Μόνο οι admins μπορούν να αλλάξουν ρόλους.");
      return;
    }

    const parts7 = args.trim().split(" ");
    const nickArg = parts7[0];
    const roleArg = (parts7[1] || "").toLowerCase();

    if (!nickArg || !roleArg) {
      convoAlert("❗ Σύνταξη: /role <nickname> <admin|vip|user>");
      return;
    }

    const validRoles = ["admin", "vip", "user"];
    if (!validRoles.includes(roleArg)) {
      convoAlert("⚠️ Άκυρος ρόλος. Επιτρεπτοί: admin, vip, user.");
      return;
    }

    // ➕ Αναζήτηση UID χρήστη
    const usersSnap = await get(ref(db, "users"));
    const usersData = usersSnap.val() || {};
    const targetUid = Object.keys(usersData).find(
      (uid) =>
        (usersData[uid].displayName || "").toLowerCase() ===
        nickArg.toLowerCase()
    );

    if (!targetUid) {
      convoAlert(`⚠️ Δεν βρέθηκε χρήστης με όνομα ${nickArg}.`);
      return;
    }

    // 🚫 Προστασία MysteryMan
    if (targetUid === "LNT3cUi6sUPW3I1FCGSZMJVAymv1") {
      convoAlert("🛡️ Δεν μπορείς να αλλάξεις ρόλο στον MysteryMan.");
      return;
    }

    // 🔹 Ενημέρωση ρόλου
    await update(ref(db, `users/${targetUid}`), { role: roleArg });

    // 📜 Καταγραφή στο adminLogs
    await push(ref(db, "adminLogs"), {
  type: "role",
  action: "changeRole",
  room: currentRoom || "general",
  targetUid,
  targetName: nickArg,
  newRole: roleArg,
  adminUid: auth.currentUser.uid,
  adminName: auth.currentUser.displayName || "Admin",
  text: `🎭 Ο ${auth.currentUser.displayName} άλλαξε το ρόλο του ${nickArg} σε "${roleArg.toUpperCase()}" στο "${currentRoom || "general"}".`,
  createdAt: serverTimestamp(),
});


    // 💬 System message
    const sysRef = ref(db, `v3/messages/${currentRoom}`);
    let roleIcon = "👤";
    if (roleArg === "admin") roleIcon = "🛡️";
    if (roleArg === "vip") roleIcon = "⭐";

    await push(sysRef, {
      text: `${roleIcon} ${nickArg} έγινε ${roleArg.toUpperCase()} από τον ${auth.currentUser.displayName}.`,
      system: true,
      type: "role",
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }
    // === /whois <nickname> ===
  if (command === "/whois") {
    if (!isAdmin()) {
      convoAlert("⛔ Μόνο οι admins μπορούν να δουν πληροφορίες χρηστών.");
      return;
    }

    const nickArg = args.trim();
    if (!nickArg) {
      convoAlert("❗ Σύνταξη: /whois <nickname>");
      return;
    }

    const usersSnap = await get(ref(db, "users"));
    const usersData = usersSnap.val() || {};
    const targetUid = Object.keys(usersData).find(
      (uid) =>
        (usersData[uid].displayName || "").toLowerCase() ===
        nickArg.toLowerCase()
    );

    if (!targetUid) {
      convoAlert(`⚠️ Δεν βρέθηκε χρήστης με όνομα ${nickArg}.`);
      return;
    }

    const userInfo = usersData[targetUid];
    const name = userInfo.displayName || "—";
    const role = userInfo.role || "user";
    const status = userInfo.status || "unknown";
    const joined = userInfo.joinedAt
      ? new Date(userInfo.joinedAt).toLocaleString("el-GR")
      : "—";
const lastSeen = userInfo.lastSeen
  ? new Date(userInfo.lastSeen).toLocaleString("el-GR")
  : "—";

    // 🧩 Convo Alert εμφάνιση
    convoAlert(
  `📋 <b>Πληροφορίες Χρήστη</b><br>
   👤 <b>Όνομα:</b> ${name}<br>
   🆔 <b>UID:</b> ${targetUid}<br>
   🎭 <b>Ρόλος:</b> ${role.toUpperCase()}<br>
   🌐 <b>Status:</b> ${status}<br>
   🕓 <b>Joined:</b> ${joined}<br>
   👀 <b>Last seen:</b> ${lastSeen}`
);


    // 📜 Log στο adminLogs (προαιρετικό)
    await push(ref(db, "adminLogs"), {
      type: "whois",
      action: "checkUserInfo",
      targetUid,
      targetName: nickArg,
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "Admin",
      text: `👁️ Ο ${auth.currentUser.displayName} έκανε whois στον ${nickArg}.`,
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }
    // === /ping ===
  if (command === "/ping") {
    const start = performance.now();

    // Μικρό delay για ρεαλιστικό αποτέλεσμα
    await new Promise((res) => setTimeout(res, 50));

    const latency = Math.round(performance.now() - start);
    const roomName = currentRoom || "general";

    // 💬 System reply
    const sysRef = ref(db, `v3/messages/${roomName}`);
    await push(sysRef, {
      text: `🏓 Pong! Latency: ${latency} ms`,
      system: true,
      type: "ping",
      createdAt: serverTimestamp(),
    });

    // 📜 Log στο adminLogs (προαιρετικό)
    await push(ref(db, "adminLogs"), {
      type: "ping",
      action: "pingCheck",
      adminUid: auth.currentUser.uid,
      adminName: auth.currentUser.displayName || "User",
      text: `🏓 ${auth.currentUser.displayName} έκανε ping (${latency} ms)`,
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }
  // === /away [status message] ===
  if (command === "/away") {
    const awayMsg = args.trim() || "away";

    // Ενημέρωση στη βάση
    await update(ref(db, `users/${auth.currentUser.uid}`), {
      status: `away — ${awayMsg}`,
      lastSeen: Date.now(),
    });
    // ✅ Ενημέρωσε το global status για το presence
window.currentStatus = `away — ${awayMsg}`;


    // System message
    const sysRef = ref(db, `v3/messages/${currentRoom}`);
    await push(sysRef, {
      text: `☕ ${auth.currentUser.displayName} είναι away — ${awayMsg}`,
      system: true,
      type: "away",
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }

  // === /back ===
  if (command === "/back") {
    await update(ref(db, `users/${auth.currentUser.uid}`), {
      status: "online",
      lastSeen: Date.now(),
    });
window.currentStatus = "online";

    const sysRef = ref(db, `v3/messages/${currentRoom}`);
    await push(sysRef, {
      text: `💬 ${auth.currentUser.displayName} επέστρεψε online.`,
      system: true,
      type: "back",
      createdAt: serverTimestamp(),
    });

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }
  // === /help ===
  if (command === "/help") {
    // Δημιουργία ή επαναχρήση overlay
    let overlay = document.getElementById("convoHelpOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "convoHelpOverlay";
      overlay.className = "convo-overlay";
      overlay.innerHTML = `
        <div class="convo-bubble" style="max-width:430px;max-height:400px;overflow-y:auto;padding:0 20px 16px 20px;border:1px solid rgba(0,255,255,0.25);box-shadow:0 0 12px rgba(0,255,255,0.2);border-radius:14px;background:rgba(20,20,30,0.9);backdrop-filter:blur(8px);">
          <div style="text-align:center;margin:10px 0 6px 0;font-weight:600;color:#00f0ff;font-size:16px;letter-spacing:0.5px;">
            ⚡ Convo Command List ⚡
          </div>
          <div style="height:1px;background:linear-gradient(90deg,rgba(0,255,255,0.2),rgba(255,255,255,0.1),rgba(0,255,255,0.2));margin-bottom:10px;"></div>
          <div id="helpContent" style="white-space:pre-wrap;font-family:'Poppins',sans-serif;font-size:14px;line-height:1.5;color:#eee;"></div>
          <div style="text-align:center;margin-top:10px;">
            <button id="helpOkBtn" class="btn small success" style="margin-bottom:8px;">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    // Κείμενο βοήθειας
    const helpText = `
📖 ΔΙΑΘΕΣΙΜΕΣ ΕΝΤΟΛΕΣ
────────────────────────────
💬 /me <κείμενο>
 Eμφανίζει action message

🏓 /ping
 Ελέγχει latency (ms)

☕ /away [μήνυμα]
 Θέτει κατάσταση σε away

💬 /back
 Επαναφέρει σε online

👁️ /whois <όνομα>
 Πληροφορίες χρήστη

🚫 /ban #room <όνομα> [λόγος]
 Ban χρήστη

👢 /kick #room <όνομα> [λόγος]
 Kick χρήστη

🔇 /mute #room <όνομα> [λόγος]
 Mute χρήστη

🔊 /unmute #room <όνομα>
 Άρση mute

🧹 /clear #room
 Καθαρίζει το chat

🎭 /role <όνομα> <admin|vip|user>
 Αλλάζει ρόλο χρήστη

📢 /announce <μήνυμα>
 Ανακοίνωση admin
────────────────────────────

`;

    document.getElementById("helpContent").textContent = helpText;

    overlay.style.display = "flex";
    document.getElementById("helpOkBtn").onclick = () => {
      overlay.style.display = "none";
    };

    msgInput.value = "";
    msgInput.style.height = "40px";
    return;
  }


  // === Άγνωστη εντολή ===
  convoAlert("❓ Άγνωστη εντολή. Δοκίμασε /me <κείμενο>");
  return;
}


    try {
  const msgRef = window.currentPrivateChatId
    ? ref(db, `v3/privateChats/${window.currentPrivateChatId}/messages`)
    : ref(db, `v3/messages/${currentRoom}`);

  const text = msgInput.value.trim();
  if (!text) return;


} catch (err) {
  convoAlert("❌ Σφάλμα αποστολής: " + err.message);
}

  });
}

// === RECEIVE MESSAGES (Realtime) ===
// === RECEIVE MESSAGES (Realtime) ===
function renderMessage(data) {
  const msg = data.val();
  // =====================================================
// 🚧 CONTEXT FILTER — DM vs ROOM isolation (ΤΕΛΙΚΗ ΛΥΣΗ)
// =====================================================

// 1. Αν είμαι σε DM → δέχομαι ΜΟΝΟ DM messages
if (window.currentPrivateChatId && msg.roomType !== "dm") {
  console.warn("⛔ Skipping ROOM message inside DM:", msg.text);
  return;
}

// 2. Αν είμαι σε ROOM → δέχομαι ΜΟΝΟ ROOM messages
if (!window.currentPrivateChatId && msg.roomType === "dm") {
  console.warn("⛔ Skipping DM message inside ROOM:", msg.text);
  return;
}

    // 🧹 Απόκρυψη YouTube links (τα χειρίζεται το σύστημα ξεχωριστά)
  if (msg.text && msg.text.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i) && !msg.system) {
    console.log("⏭️ Skipping raw YouTube link:", msg.text);
    return;
  }


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

// === Mentions Highlight ===
let finalText = msg.text || "";
const currentUid = auth.currentUser?.uid;

// Αν έχει mentions array
if (msg.mentions && Array.isArray(msg.mentions)) {
  if (msg.mentions.includes(currentUid)) {
    // 🔔 Αν το μήνυμα με αναφέρει → special highlight + ήχος
    finalText = finalText.replace(
      /@(\w+)/g,
      '<span class="mention-self">@$1</span>'
    );
    playMentionSound(); // 🔊
  } else {
    // Για όλους τους άλλους, απλό mention highlight
    finalText = finalText.replace(
      /@(\w+)/g,
      '<span class="mention">@$1</span>'
    );
  }
}

// === Εμφάνιση διαφορετικού περιεχομένου ανά τύπο ===
let contentHtml = "";

if (msg.type === "gifs" || msg.type === "stickers") {
  // 🖼️ Εμφάνισε απευθείας το GIF ή sticker
  contentHtml = `<img src="${msg.gifUrl}" alt="${msg.type}" class="chat-gif" />`;
} else if (msg.text) {
  // 💬 Κανονικό μήνυμα κειμένου ή emoji
  contentHtml = `<div class="msg-text">${finalText.replace(/\n/g, "<br>")}</div>`;
} else {
  // 🚫 Fallback
  contentHtml = `<div class="msg-text">[unsupported message]</div>`;
}

// ===============================================================
// 💬 Reply System — Step 1B (Render reply preview)
// ===============================================================
let replyHtml = "";
if (msg.replyTo) {
  const r = msg.replyTo;
  replyHtml = `
    <div class="reply-preview" data-target="${r.id || ""}">
      <div class="reply-user">↩ ${r.username}</div>
      <div class="reply-text">${r.text || ""}</div>
    </div>
  `;
}



el.innerHTML = `
  <div class="message">
    <div class="msg-avatar">
      ${getUserAvatarHTML({
        displayName: msg.username || name,
        avatar: msg.avatar || "",
        role: msg.role || "user",
        online: msg.online === true || msg.state === "online",
      })}
    </div>
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-user">${name}</span>
        <span class="msg-time">${time}</span>
      </div>
      ${replyHtml}

      ${contentHtml}
    </div>
  </div>
`;
// ===============================================================
// 💬 Reply System — Step 4A (Reply Action Button)
// ===============================================================
const replyBtn = document.createElement("div");
replyBtn.className = "reply-action-btn";
replyBtn.innerHTML = "↩";
replyBtn.title = "Απάντηση";

replyBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  // 💫 mini bounce + glow
  replyBtn.animate(
    [
      { transform: "scale(1)", filter: "drop-shadow(0 0 0 rgba(0,255,255,0))" },
      { transform: "scale(1.3)", filter: "drop-shadow(0 0 8px rgba(0,255,255,0.7))" },
      { transform: "scale(1)", filter: "drop-shadow(0 0 0 rgba(0,255,255,0))" }
    ],
    { duration: 300, easing: "ease-out" }
  );

  const msgId = data.key;
  const username = msg.username || "User";
  const preview = (msg.text || "").slice(0, 60).replace(/\n/g, " ");
  replyTarget = { id: msgId, username, text: preview };

  // ✨ εμφανίσου με slide-in animation
  replyBar.classList.remove("hidden");
  replyBar.animate(
    [
      { opacity: 0, transform: "translateY(10px)" },
      { opacity: 1, transform: "translateY(0)" }
    ],
    { duration: 250, easing: "ease-out" }
  );
// 💡 πρόσθεσε εδώ το glow highlight
replyBar.classList.add("active");
setTimeout(() => replyBar.classList.remove("active"), 800);
  document.getElementById("replyUser").textContent = username;
  document.getElementById("replyText").textContent = `"${preview}"`;
  msgInput.focus();
});


el.appendChild(replyBtn);
// ✨ Fade-out όταν φεύγεις από το μήνυμα (prevent lingering)
el.addEventListener("mouseleave", () => {
  replyBtn.style.opacity = "0";
});


// ===============================================================
// 💬 Reply System — Step 3B (Clickable jump with DM support + Stable Highlight)
// ===============================================================
const replyPreviewEl = el.querySelector(".reply-preview");
console.log("🧩 Found replyPreviewEl?", replyPreviewEl); // <=== βάλε αυτή τη γραμμή

if (replyPreviewEl && replyPreviewEl.dataset.target) {
  replyPreviewEl.addEventListener("click", () => {
    const targetId = replyPreviewEl.dataset.target;
    const searchScope = document.getElementById("messages");
    const targetEl = searchScope.querySelector(`[data-id="${targetId}"] .message`);

console.log("🧭 Reply click:", {
  replyFrom: msg.username,
  replyFromUid: msg.uid,
  targetId,
  targetUid: targetEl?.dataset?.uid,
  targetUser: targetEl?.querySelector(".msg-user")?.textContent
});
console.log("🧱 targetEl DOM:", targetEl?.outerHTML);


    if (!targetEl) {
  // 🕓 Αν δεν βρέθηκε, ξαναπροσπάθησε μετά από 150ms (fallback για admin/self messages)
  setTimeout(() => {
    const retryEl = searchScope.querySelector(`[data-id="${targetId}"]`);
    if (retryEl) {
      retryEl.scrollIntoView({ behavior: "smooth", block: "center" });
      retryEl.classList.add("reply-highlight");
      setTimeout(() => retryEl.classList.remove("reply-highlight"), 1500);
    } else {
      convoAlert("⚠️ Το αρχικό μήνυμα δεν βρέθηκε (ίσως έχει διαγραφεί).");
    }
  }, 150);
  return;
}


    // Scroll στο μήνυμα
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });

    // Καθάρισε τυχόν παλιό highlight
    document.querySelectorAll(".reply-highlight").forEach(el =>
      el.classList.remove("reply-highlight")
    );

    // Εφάρμοσε το νέο highlight
    targetEl.classList.add("reply-highlight");

    // === Σταθεροποίηση highlight ακόμη κι αν γίνει re-render ===
    const observer = new MutationObserver(() => {
      const reTarget = searchScope.querySelector(`[data-id="${targetId}"]`);
      if (reTarget) reTarget.classList.add("reply-highlight");
    });

    observer.observe(searchScope, { childList: true, subtree: true });

    // Ασφαλές κλείσιμο του observer & ομαλό fade out του highlight
    setTimeout(() => {
      observer.disconnect();
      if (targetEl && targetEl.classList.contains("reply-highlight")) {
        targetEl.classList.add("reply-highlight-fade");
        setTimeout(() => targetEl.classList.remove("reply-highlight", "reply-highlight-fade"), 600);
      }
    }, 2000);
  });
}

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

  // === Αν είναι μόνο emoji, κάνε boost ===
if (msg.text && /^[\p{Emoji}\s]+$/u.test(msg.text.trim())) {
  el.classList.add("emoji-only");
}

  // === Smart Scroll Detection ===
const nearBottom =
  messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 100;

  // ===============================================================
// 💖 CONVO REACTIONS (Step 1B integration)
// ===============================================================

// Το id του μηνύματος
const msgId = data.key;

// Δημιούργησε container για reactions
const reactWrap = document.createElement("div");
reactWrap.className = "reactions-wrap";
reactWrap.style.cssText = `
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  margin-top:4px;
  font-size:16px;
`;

// ===============================================================
// 🩵 REACTIONS LIVE LISTENER (Step 1C update)
// ===============================================================
renderReactions(reactWrap, msgId);

// Μικρή Convo bar με 4 default emojis
const quickBar = document.createElement("div");
quickBar.className = "reaction-quickbar";
quickBar.style.cssText = `
  display:flex;
  gap:8px;
  margin-top:4px;
  font-size:18px;
  opacity:0.8;
`;

["❤️","🔥","👍","😂"].forEach((emo) => {
  const btn = document.createElement("span");
  btn.textContent = emo;
  btn.style.cssText = `
    cursor:pointer;
    transition:transform .15s, filter .2s;
    filter:drop-shadow(0 0 4px rgba(0,255,255,0.5));
  `;
  btn.addEventListener("mouseenter",()=>btn.style.transform="scale(1.3)");
  btn.addEventListener("mouseleave",()=>btn.style.transform="scale(1)");
  btn.addEventListener("click", async ()=>{
    await toggleReaction(msgId, emo);
    const rx = await getReactionsForMessage(msgId);
    reactWrap.innerHTML="";
    renderReactions(reactWrap, msgId, rx);
  });
  quickBar.appendChild(btn);
});

// ===============================================================
// 💖 CONVO REACTIONS — Step 1G (Bottom Pop Style)
// ===============================================================
el.querySelector(".msg-body").appendChild(reactWrap);

// Δημιουργία bottom reaction bar (κάτω από το μήνυμα)
const hoverBar = document.createElement("div");
hoverBar.className = "hover-reaction-bar";
hoverBar.style.cssText = `
  position: relative;
  display: flex;
  gap: 8px;
  justify-content: flex-start;
  opacity: 0;
  transform: translateY(4px);
  transition: all .25s ease;
  margin-top: 4px;
  font-size: 18px;
`;

// Τα emoji της μπάρας
["👍","👎","❤️","😂","😡","😢","😮"].forEach((emo)=>{
  const ebtn=document.createElement("span");
  ebtn.textContent=emo;
  ebtn.style.cssText=`
    cursor:pointer;
    transition:transform .2s, filter .2s;
    filter:drop-shadow(0 0 4px rgba(0,255,255,0.35));
  `;
  ebtn.addEventListener("mouseenter",()=>ebtn.style.transform="scale(1.25)");
  ebtn.addEventListener("mouseleave",()=>ebtn.style.transform="scale(1)");
  ebtn.addEventListener("click",async(e)=>{
    e.stopPropagation();
    await toggleReaction(msgId,emo);

    // 💥 Mini pop effect όταν γίνεται click
    ebtn.animate(
      [
        { transform:"scale(1.3)", filter:"drop-shadow(0 0 10px rgba(0,255,255,0.7))" },
        { transform:"scale(1)", filter:"drop-shadow(0 0 4px rgba(0,255,255,0.35))" }
      ],
      { duration:300, easing:"ease-out" }
    );
  });
  hoverBar.appendChild(ebtn);
});

// Τοποθέτησε τη μπάρα κάτω από το bubble
el.querySelector(".msg-body").appendChild(hoverBar);

// Fade-in/out στο hover
el.addEventListener("mouseenter",()=>{
  hoverBar.style.opacity="1";
  hoverBar.style.transform="translateY(0)";
});
el.addEventListener("mouseleave",()=>{
  hoverBar.style.opacity="0";
  hoverBar.style.transform="translateY(4px)";
});
// ===============================================================
// 💬 Reply System — Step 1A (click-to-reply)
// ===============================================================
el.addEventListener("dblclick", (e) => {
  e.stopPropagation();
  const msgId = data.key;
  const username = msg.username || "User";
  const preview = (msg.text || "").slice(0, 60).replace(/\n/g, " ");
  replyTarget = { id: msgId, username, text: preview };
  document.getElementById("replyUser").textContent = username;
  document.getElementById("replyText").textContent = `"${preview}"`;
  replyBar.classList.remove("hidden");
  msgInput.focus();
});
// ===============================================================
// 💫 Reply hover sync (highlight both ends)
// ===============================================================
el.addEventListener("mouseenter", () => {
  const msgId = el.dataset.id;
  if (!msgId) return;

  // Αν κάποιο reply preview δείχνει σε αυτό το id → highlight και εκείνο
  document.querySelectorAll(`.reply-preview[data-target="${msgId}"]`)
    .forEach(p => p.classList.add("reply-linked-hover"));
});
el.addEventListener("mouseleave", () => {
  document.querySelectorAll(".reply-linked-hover")
    .forEach(p => p.classList.remove("reply-linked-hover"));
});

// Προσθήκη νέου μηνύματος
messagesDiv.appendChild(el);

// Αν ο χρήστης είναι κάτω, κάνε auto-scroll. Αν όχι, κράτα τη θέση του.
if (nearBottom) {
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

setTimeout(() => {
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}, 300);

// 🧠 Αν το μήνυμα είναι δικό μου, μην δείχνεις alert
const currentUser = auth.currentUser;
if (currentUser && msg.uid === currentUser.uid) {
  newMsgAlert.classList.add("hidden");
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return; // ❌ σταμάτα εδώ — μην τρέχει ο έλεγχος alert
}

// === Εμφάνιση ειδοποίησης νέων μηνυμάτων όταν δεν είσαι στο κάτω μέρος ===
if (!nearBottom) {
  newMsgAlert.classList.remove("hidden");
} else {
  newMsgAlert.classList.add("hidden");
}

el.classList.add("fade-in");

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
    if (!isAdmin()) {
      convoAlert("⛔ Μόνο για Admins.");
      return;
    }

    const res = await convoPrompt(
      `🧹 Clear all messages για το room ‘${currentRoom}’; Αυτό δεν αναιρείται.`
    );
    if (res !== "ok") return;

    try {
      if (!messagesRef) return;
      await remove(messagesRef);

      // ✅ Αναλυτικό log στο adminLogs (ποιος admin & ποιο room)
      await push(ref(db, "adminLogs"), {
        type: "other",
        action: "clearChat",
        room: currentRoom,
        adminUid: auth.currentUser.uid,
        adminName: auth.currentUser.displayName || "Admin",
        text: `🧹 Cleared all messages in room "${currentRoom}"`,
        createdAt: serverTimestamp(),
      });

      convoAlert(`✅ Τα μηνύματα στο room "${currentRoom}" διαγράφηκαν.`);
    } catch (err) {
      convoAlert("❌ Σφάλμα στο clear: " + err.message);
    }
  });
}

// === Admin menu click ===
if (adminMenu) {
  adminMenu.addEventListener("click", async (e) => {
    let action = e.target.closest("[data-action]")?.dataset.action;
    console.log("🧩 Admin menu click:", action);

    if (!currentMsgEl) return;

    const msgId = currentMsgEl.dataset.id;
    if (!msgId || !action) return;

    adminMenu.classList.add("hidden");

    // === DELETE MESSAGE ===
if (action === "delete") {
  // ✅ Νέα Convo Confirm έκδοση (με κουμπιά Ναι / Όχι)
  const confirmDel = await convoConfirm("🗑️ Θες σίγουρα να διαγράψεις αυτό το μήνυμα;");
  if (!confirmDel) return;




      try {
// 🧩 Αν είμαστε σε DM -> σβήσε από privateChats, αλλιώς από room messages
if (window.currentPrivateChatId) {
  await remove(ref(db, `v3/privateChats/${window.currentPrivateChatId}/messages/${msgId}`));
} else {
  await remove(ref(db, `v3/messages/${currentRoom}/${msgId}`));
}

        // ✅ Αναλυτικό log στο adminLogs (όπως το clearChat)
        await push(ref(db, "adminLogs"), {
          type: "delete",
          action: "deleteMessage",
          room: currentRoom,
          targetUid: currentMsgEl.dataset.uid || "unknown",
          targetName: currentMsgEl.querySelector(".msg-user")?.textContent || "unknown",
          adminUid: auth.currentUser.uid,
          adminName: auth.currentUser.displayName || "Admin",
          text: `🗑️ Deleted a message in room "${currentRoom}"`,
          createdAt: serverTimestamp(),
        });

        if (currentMsgEl) currentMsgEl.remove();
        convoAlert("✅ Το μήνυμα διαγράφηκε και καταγράφηκε στα System Logs.");
      } catch (err) {
        console.error("❌ Delete error:", err);
        convoAlert("⚠️ Σφάλμα στη διαγραφή — δες κονσόλα.");
      } finally {
        currentMsgEl = null;
      }
    }
    

// === MUTE USER ===
if (action === "mute") {
  console.log("🎯 Action MUTE triggered for:", currentRoom);

  const username = currentMsgEl.querySelector(".msg-user")?.textContent || "Unknown";
  const targetUid = currentMsgEl.dataset.uid || "";
  const confirmMute = await convoPrompt(
    `🔇 Θες να κάνεις mute τον χρήστη ${username};`
  );
  if (confirmMute !== "ok") return;

  try {
    // --- γράφουμε στο v3/muted/{roomId}/{uid} ---
await set(ref(db, `v3/rooms/${currentRoom}/mutes/${targetUid}`), true);

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

    convoAlert(`🔇 Ο χρήστης ${username} τέθηκε σε mute στο room "${currentRoom}".`);
  } catch (err) {
    console.error("Mute error:", err);
    convoAlert("❌ Σφάλμα στο mute — δες κονσόλα.");
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
// === Βήμα 3: Κλικ στο bubble — scroll στο τέλος και εξαφάνιση ===
newMsgAlert?.addEventListener("click", () => {
  messagesDiv.scrollTo({
    top: messagesDiv.scrollHeight,
    behavior: "smooth"
  });
  newMsgAlert.classList.add("hidden");
});
// === Auto-start avatar watcher ===
initAvatarWatcher();
// ============================================================================
// 🎞️ Media Send Helper — GIFs / Stickers -> Room ή Private DM
// ============================================================================
export async function sendMediaMessage(type, url) {
  const user = auth.currentUser;
  if (!user) {
    convoAlert("⚠️ Δεν είσαι συνδεδεμένος!");
    return;
  }

  // Στόχος: private DM αν υπάρχει, αλλιώς ενεργό room
  const msgRef = window.currentPrivateChatId
    ? ref(db, `v3/privateChats/${window.currentPrivateChatId}/messages`)
    : ref(db, `v3/messages/${currentRoom}`);

  // Payload για GIF/Sticker
  const payload = {
    uid: user.uid,
    username: currentUserData.displayName || user.displayName || "Guest",
    type,                          // "gifs" | "stickers"
    gifUrl: url,                   // μπορούμε να το λέμε gifUrl και για stickers
    createdAt: serverTimestamp(),
  };

  try {
    await push(msgRef, payload);
  } catch (err) {
    console.error("Media send error:", err);
    convoAlert("❌ Αποτυχία αποστολής media.");
  }
}

// Ευκολία για τα υπόλοιπα modules/UI:
window.sendGif = (url) => sendMediaMessage("gifs", url);
window.sendSticker = (url) => sendMediaMessage("stickers", url);

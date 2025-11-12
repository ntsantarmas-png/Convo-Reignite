// ===============================================================
// 💬 Convo — DM Notifier (v1.0 stable)
// Purpose: Real-time DM dot + lastRead timestamps (safe & async)
// ===============================================================

import { db, auth } from "./firebaseInit.js";
import {
  ref,
  onChildAdded,
  onValue,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const dmNotifDot = document.getElementById("dmNotifDot");

// === Helper: πάρε lastRead timestamp από DB
async function getLastRead(chatId, uid) {
  const refPath = ref(db, `v3/privateChats/${chatId}/lastRead/${uid}`);
  const snap = await get(refPath);
  return snap.exists() ? snap.val() : 0;
}

// === Helper: αποθήκευσε νέο lastRead όταν ανοίγεις το DM
export async function updateLastRead(chatId) {
  const user = auth.currentUser;
  if (!user || !chatId) return;
  const refPath = ref(db, `v3/privateChats/${chatId}/lastRead/${user.uid}`);
  await set(refPath, Date.now());
  console.log("🕓 Updated lastRead for", chatId);
}

// === Ενεργοποίηση listener αφού φορτώσει το Auth ===
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  console.log("👀 DM Notifier active for:", user.displayName);

  const myUid = user.uid;
  const privRef = ref(db, "v3/privateChats");

  onValue(privRef, (snapshot) => {
    const chats = snapshot.val() || {};
    Object.entries(chats).forEach(([chatId, chatData]) => {
      const participants = chatData.participants || chatData.users || {};
      if (!participants[myUid]) return;

      const msgsRef = ref(db, `v3/privateChats/${chatId}/messages`);
      onChildAdded(msgsRef, async (msgSnap) => {
  const msg = msgSnap.val();
  if (!msg) return;
  // === Έλεγχος Ignore πριν κάνει ΟΤΙΔΗΠΟΤΕ ===
  const ignoreRef = ref(db, `v3/privateChats/${chatId}/settings/ignoredBy/${myUid}`);
 const ignoreSnap = await get(ignoreRef);
  const isIgnored = ignoreSnap.exists();
  if (isIgnored) {
    console.log("🚫 DM ignored — aborting notification for:", chatId);
    return;
  }
  const sender = msg.uid || msg.senderId;
  if (!sender || sender === myUid) return;

  // === Έλεγχος Mute ===
  const muteRef = ref(db, `v3/privateChats/${chatId}/settings/mutedBy/${myUid}`);
  const muteSnap = await get(muteRef);
  const isMuted = muteSnap.exists();

  if (isMuted) {
    console.log("🔕 DM muted — skipping notification for:", chatId);
    return; // ❌ μην ανάψεις τελίτσα, μην κάνεις τίποτα
  }
  
  const lastRead = await getLastRead(chatId, myUid);
  const msgTime = msg.timestamp || msg.time || msg.createdAt || Date.now();

  // 🔔 Αν το μήνυμα είναι νεότερο απ’ το lastRead → άναψε τελίτσα
  if (msgTime > lastRead) {
    console.log("🔴 New DM after lastRead:", chatId);
    dmNotifDot?.classList.remove("hidden");
  }
});

    });
  });
});

// === Όταν ανοίγεις DM → ενημέρωσε το lastRead + σβήσε τελίτσα ===
window.addEventListener("openDmTab", (e) => {
  const { chatId } = e.detail || {};
  updateLastRead(chatId);
  if (dmNotifDot && !dmNotifDot.classList.contains("hidden")) {
    dmNotifDot.classList.add("hidden");
    console.log("🧹 Cleared DM dot after open:", chatId);
  }
});

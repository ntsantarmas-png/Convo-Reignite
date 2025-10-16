// ============================================================================
// TYPING SYSTEM — Step 8A (DB updates + listener)
// ============================================================================
import { ref, set, onValue, serverTimestamp } 
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth, db } from "./firebaseInit.js";

const typingMap = new Map(); // τοπικό state

// === Ενεργοποίηση / Απενεργοποίηση typing ===
export function setTypingState(isTyping) {
  const user = auth.currentUser;
  if (!user) return;

  const tRef = ref(db, `typing/${user.uid}`);
  set(tRef, {
    typing: isTyping,
    displayName: user.displayName || "Guest",
    updatedAt: serverTimestamp(),
  });
}

// === Παρακολούθηση typing όλων ===
export function watchTyping(callback) {
  const tRef = ref(db, "typing");
  onValue(tRef, (snap) => {
    const data = snap.val() || {};
    typingMap.clear();
    for (const [uid, val] of Object.entries(data)) {
      typingMap.set(uid, val.typing === true);
    }
    callback(new Map(typingMap));
  });
  console.log("⌨️ Typing watcher ready");
}

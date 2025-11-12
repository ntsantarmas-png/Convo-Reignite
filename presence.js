// ============================================================================
// PRESENCE — Step 5A (Own online/offline status — χωρίς kick disconnect)
// ============================================================================
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  ref, onValue, onDisconnect, serverTimestamp, set
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth, db } from "./firebaseInit.js";
import { convoAlert } from "./convoAlerts.js";
let currentUid = null;

window.currentStatus = "online";

export function setupPresence() {
  // Παρακολουθούμε το auth state
  onAuthStateChanged(auth, (user) => {
    const connectedRef = ref(db, ".info/connected");

    if (user) {
      currentUid = user.uid;
      const statusRef = ref(db, `status/${user.uid}`);
      

      // Όταν υπάρχει σύνδεση στο RTDB
      onValue(connectedRef, (snap) => {
        if (snap.val() === false) return;

        // Στήσε onDisconnect: όταν κλείσει το tab/πέσει η σύνδεση -> offline
        onDisconnect(statusRef).set({
          state: "offline",
          displayName: user.displayName || "Guest",
          lastChanged: serverTimestamp(),
        });
// ============================================================
// 🕓 Step 9B — User LastSeen Fallback (σε disconnect)
// ============================================================
const userRef = ref(db, `users/${user.uid}`);
onDisconnect(userRef).update({
  status: window.currentStatus?.startsWith("away") ? window.currentStatus : "offline",
  lastSeen: serverTimestamp(),
});
// Αν είναι away, μην ξαναγράψεις offline ποτέ
if (window.currentStatus?.startsWith("away")) {
  console.log("⚠️ Away mode active — skip offline write");
  return;
}


// 🧹 Αν είναι Guest, σβήσε πλήρως το /users entry όταν φύγει
if (user.isAnonymous || (user.displayName || "").toLowerCase() === "guest") {
  const userRef = ref(db, `users/${user.uid}`);
  onDisconnect(userRef).remove();
}

        // Δήλωσε άμεσα online
     set(statusRef, {
  state: "online",
  displayName: user.displayName || "Guest",
  lastChanged: serverTimestamp(),
}).then(() => {
  // ✅ Ορίστηκε online
  window.currentStatus = "online";

  // Αν είχαμε away status, ξαναγράψτο για ασφάλεια
  if (window.currentStatus?.startsWith("away")) {
    update(ref(db, `users/${user.uid}`), { status: window.currentStatus });
  }
});

  
      });
    } else {
      // Αν έγινε signOut, μαρκάρουμε τον προηγούμενο ως offline (άμεσο)
      if (currentUid) {
        const prevRef = ref(db, `status/${currentUid}`);
        set(prevRef, {
          state: "offline",
          lastChanged: serverTimestamp(),
        });
      }
      currentUid = null;
    }
  });
}

         
// ============================================================
// 🚀 Wait for userReady before initializing Presence (single run)
// ============================================================
window.addEventListener("userReady", () => {
  if (window.__presenceInitialized) {
    console.log("⚙️ Presence already initialized — skipping duplicate call.");
    return;
  }
  window.__presenceInitialized = true;

  console.log("✅ userReady received → initializing presence...");
  setupPresence();
});

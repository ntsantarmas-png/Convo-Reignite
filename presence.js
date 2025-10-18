// ============================================================================
// PRESENCE — Step 5A (Own online/offline status — χωρίς kick disconnect)
// ============================================================================
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  ref, onValue, onDisconnect, serverTimestamp, set
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth, db } from "./firebaseInit.js";
import { showConvoAlert } from "./app.js"; // βεβαιώσου ότι υπάρχει στην κορυφή του αρχείου
let currentUid = null;

export function setupPresence() {
  // Παρακολουθούμε το auth state
  onAuthStateChanged(auth, (user) => {
    const connectedRef = ref(db, ".info/connected");

    if (user) {
      currentUid = user.uid;
      const statusRef = ref(db, `status/${user.uid}`);
      // === Kick message listener (Convo bubble) ===

const kickRef = ref(db, "kicks/" + user.uid);
onValue(kickRef, (snap) => {
  if (snap.exists()) {
    const val = snap.val();
    const by = val.kickedBy || "Admin";
    const reason = val.reason || "χωρίς λόγο";
    showConvoAlert(`⚠️ Έχεις δεχθεί Kick από τον ${by}\n📝 Λόγος: ${reason}`);
  }
});


      // Όταν υπάρχει σύνδεση στο RTDB
      onValue(connectedRef, (snap) => {
        if (snap.val() === false) return;

        // Στήσε onDisconnect: όταν κλείσει το tab/πέσει η σύνδεση -> offline
        onDisconnect(statusRef).set({
          state: "offline",
          displayName: user.displayName || "Guest",
          lastChanged: serverTimestamp(),
        });

        // Δήλωσε άμεσα online
        set(statusRef, {
          state: "online",
          displayName: user.displayName || "Guest",
          lastChanged: serverTimestamp(),
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

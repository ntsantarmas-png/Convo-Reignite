// ============================================================================
// PRESENCE — Step 5A (Own online/offline status)
// ============================================================================
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  ref, onValue, onDisconnect, serverTimestamp, set
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth, db } from "./firebaseInit.js";

let currentUid = null;

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

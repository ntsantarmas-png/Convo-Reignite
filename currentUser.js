// ===============================================================
// 👤 Convo — currentUser.js (Stable Live Version)
// Purpose: Real-time sync of current user's DB profile (shared ref)
// ===============================================================

import { auth, db } from "./firebaseInit.js";
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, onValue, off, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// 🧩 Δημιουργούμε ένα κοινό object (ίδιο reference παντού)
export const currentUserData = {};
window.currentUserData = currentUserData; // για debug από την κονσόλα

let unsubscribe = null; // για cleanup προηγούμενου listener

onAuthStateChanged(auth, async (user) => { // <-- βάλε async εδώ
  // 🧹 Αν αποσυνδεθεί, καθάρισε τα δεδομένα
  if (!user) {
    for (const k in currentUserData) delete currentUserData[k];
    console.log("👤 currentUserData cleared (logout)");
    if (unsubscribe) unsubscribe();
    return;
  }

  // === Sync Auth DisplayName με DB ===
  try {
    const snap = await get(ref(db, "users/" + user.uid));
    const dbUser = snap.val() || {};
    const dbName = dbUser.displayName || "";
    const authName = user.displayName || "";

    if (dbName && dbName !== authName) {
      await updateProfile(user, { displayName: dbName });
      console.log(`🔄 Synced Auth displayName to DB: ${dbName}`);
    }
  } catch (err) {
    console.warn("⚠️ DisplayName sync error:", err);
  }

  const userRef = ref(db, "users/" + user.uid);

  // 🧩 Σταματάμε οποιονδήποτε προηγούμενο listener
  if (unsubscribe) unsubscribe();
  off(userRef);

  // 🧩 Ενεργοποιούμε νέο listener
  // 🔴 Live listener στο /users/{uid} για να γεμίζει το currentUserData
onValue(userRef, (snap) => {
  const data = snap.val() || {};

  // καθάρισε παλιές τιμές και γέμισε με τις νέες
for (const k in currentUserData) delete currentUserData[k];
Object.assign(currentUserData, data, { uid: user.uid });

// ενημέρωση για όποιο module ενδιαφέρεται (π.χ. profileModal)
window.dispatchEvent(
  new CustomEvent("currentUserUpdated", { detail: { ...currentUserData } })
);

// ✅ Αν έχουμε πλήρη στοιχεία χρήστη, στείλε event "userReady" μία φορά
if (data.displayName && !window.__userReadyOnce) {
  window.__userReadyOnce = true;
  window.dispatchEvent(new Event("userReady"));
  console.log("🚀 userReady event dispatched");
}

console.log("👤 currentUserData updated:", currentUserData);
});

  // ===============================================================
// 🤝 Friends live sync
// ===============================================================
const friendsRef = ref(db, "friends/" + user.uid);
onValue(friendsRef, (snap) => {
  const friendsData = snap.val() || {};
  currentUserData.friends = friendsData;

  // 📢 Ενημέρωση για modules που χρειάζονται τους φίλους
  window.dispatchEvent(
    new CustomEvent("friendsUpdated", { detail: { ...friendsData } })
  );

  console.log("👥 friends updated:", friendsData);
});


  // ✅ Αποθήκευση για πιθανό cleanup
  unsubscribe = () => off(userRef);
});

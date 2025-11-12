// ===============================================================
// 🫂 Convo — Friends Manager (Stable Base)
// Purpose: Handle Add / Remove / Requests logic in one place
// ===============================================================

import { auth, db } from "./firebaseInit.js";
import {
  ref,
  get,
  set,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { convoAlert, convoConfirm } from "./convoAlerts.js";

// ===============================================================
// 📨 Send Friend Request
// ===============================================================
export async function sendFriendRequest(targetUid, targetName) {
  const user = auth.currentUser;
  if (!user) return convoAlert("⚠️ Δεν είσαι συνδεδεμένος.");

  const fromUid = user.uid;
  const fromName = user.displayName || "Χρήστης";

  if (fromUid === targetUid)
    return convoAlert("😅 Δεν μπορείς να στείλεις αίτημα στον εαυτό σου.");

  // ✅ Αν είναι ήδη φίλοι, σταμάτα
  const friendRef = ref(db, `friends/${fromUid}/${targetUid}`);
  const friendSnap = await get(friendRef);
  if (friendSnap.exists()) {
    return convoAlert("🤝 Είστε ήδη φίλοι!");
  }

  // 🚫 Αν υπάρχει ήδη αίτημα
  const reqRef = ref(db, `friendRequests/${targetUid}/${fromUid}`);

  const reqSnap = await get(reqRef);
  if (reqSnap.exists()) {
    return convoAlert("⏳ Έχεις ήδη στείλει αίτημα σε αυτόν τον χρήστη!");
  }

  // ✅ Δημιουργία αιτήματος
  await set(reqRef, {
    fromName,
    fromUid,
    timestamp: Date.now(),
  });

  convoAlert(`🫂 Έστειλες αίτημα φιλίας στον ${targetName}!`);
}

// ===============================================================
// 🫱 Accept / Reject Friend Requests (used by Friend Requests panel)
// ===============================================================
export async function acceptFriendRequest(fromUid, fromName) {
  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;
  await set(ref(db, `friends/${uid}/${fromUid}`), true);
  await set(ref(db, `friends/${fromUid}/${uid}`), true);

await remove(ref(db, `friendRequests/${uid}/${fromUid}`));
  convoAlert(`🎉 Αποδέχθηκες το αίτημα φιλίας του ${fromName}!`);
}

export async function rejectFriendRequest(fromUid, fromName) {
  const user = auth.currentUser;
  if (!user) return;
  const uid = user.uid;

await remove(ref(db, `friendRequests/${uid}/${fromUid}`));

  convoAlert(`🚫 Απέρριψες το αίτημα φιλίας του ${fromName}.`);
}

// ===============================================================
// ❌ Remove Friend (mutual unfriend)
// ===============================================================
export async function removeFriend(targetUid, targetName) {
  const user = auth.currentUser;
  if (!user) return convoAlert("⚠️ Δεν είσαι συνδεδεμένος.");

  const fromUid = user.uid;

  const confirm = await convoConfirm(
    `❌ Θες σίγουρα να αφαιρέσεις τον ${targetName} από τους φίλους σου;`
  );
  if (!confirm) return;

  await remove(ref(db, `friends/${fromUid}/${targetUid}`));
  await remove(ref(db, `friends/${targetUid}/${fromUid}`));

  convoAlert(`👋 Ο ${targetName} αφαιρέθηκε από τη λίστα φίλων σου.`);
}

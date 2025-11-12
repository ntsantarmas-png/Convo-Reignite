// ============================================================================
// AUTH ACTIONS — Step 3 + Display Name Prompt Integration
// ============================================================================
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { ref, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth, db } from "./firebaseInit.js";
import { convoAlert, convoPrompt } from "./convoAlerts.js";


// === REGISTER (Step 1 – Display Name Prompt) ===
export async function registerUser() {
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

  if (!email || !password) {
    convoAlert("⚠️ Συμπλήρωσε όλα τα πεδία!");
    return;
  }

  try {
    // === Δημιουργία λογαριασμού ===
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // === Prompt για Display Name ===
    let displayName = "";
    while (!displayName) {
      const res = await convoPrompt(
        "🎭 Διάλεξε το display name που θα εμφανίζεται στο chat σου!\n(3–20 χαρακτήρες, λατινικά ή ελληνικά)"
      );
      if (!res || res.length < 3 || res.length > 20) {
        await convoAlert("⚠️ Το όνομα πρέπει να έχει 3–20 χαρακτήρες.");
      } else {
        displayName = res.trim();
      }
    }

    // === Ενημέρωση προφίλ στο Auth ===
    await updateProfile(user, { displayName });

    // === Αποθήκευση στη DB ===
    await set(ref(db, "users/" + user.uid), {
      displayName,
      role: "user",
      createdAt: Date.now(),
    });

    // === Επιβεβαίωση ===
    await convoAlert(`✨ Καλωσήρθες, ${displayName}!`);
    console.log("✅ Registered new user:", displayName);
  } catch (err) {
    convoAlert("❌ Σφάλμα εγγραφής: " + err.message);
  }
}

// === LOGIN ===
export async function loginUser() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    convoAlert("⚠️ Συμπλήρωσε και τα δύο πεδία!");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Logged in:", email);
  } catch (err) {
    convoAlert("❌ Σφάλμα σύνδεσης: " + err.message);
  }
}

// === LOGIN AS GUEST ===
export async function loginGuest() {
  try {
    const userCredential = await signInAnonymously(auth);
    console.log("🟢 Guest login:", userCredential.user.uid);
  } catch (err) {
    convoAlert("❌ Guest login error: " + err.message);
  }
}

// === LOGOUT ===
export async function logoutUser() {
  try {
    await signOut(auth);
    console.log("🚪 Logged out");
  } catch (err) {
    convoAlert("❌ Logout error: " + err.message);
  }
}

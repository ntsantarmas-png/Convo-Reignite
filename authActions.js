// ============================================================================
// AUTH ACTIONS — Step 3
// ============================================================================
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { auth } from "./firebaseInit.js";

// === REGISTER ===
export async function registerUser() {
  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;

  if (!username || !email || !password) {
    alert("⚠️ Συμπλήρωσε όλα τα πεδία!");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: username });
    alert(`🎉 Καλωσήρθες, ${username}!`);
  } catch (err) {
    alert("❌ Σφάλμα εγγραφής: " + err.message);
  }
}

// === LOGIN ===
export async function loginUser() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    alert("⚠️ Συμπλήρωσε και τα δύο πεδία!");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Logged in:", email);
  } catch (err) {
    alert("❌ Σφάλμα σύνδεσης: " + err.message);
  }
}

// === LOGIN AS GUEST ===
export async function loginGuest() {
  try {
    const userCredential = await signInAnonymously(auth);
    console.log("🟢 Guest login:", userCredential.user.uid);
  } catch (err) {
    alert("❌ Guest login error: " + err.message);
  }
}

// === LOGOUT ===
export async function logoutUser() {
  try {
    await signOut(auth);
    console.log("🚪 Logged out");
  } catch (err) {
    alert("❌ Logout error: " + err.message);
  }
}

// ===================== WATCH AUTH STATE =====================
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, set, update, onValue, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { db, auth } from "./firebaseInit.js";

export function watchAuthState() {
  const authContainer = document.getElementById("authContainer");
  const chatContainer = document.getElementById("chatContainer");

  // === Unique UID of MysteryMan (admin) ===
  const MYSTERYMAN_UID = "LNT3cUi6sUPW3I1FCGSZMJVAymv1"; // ✅ δικό σου UID

 // ===================== WATCH AUTH STATE =====================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // === AUTO-LOGOUT if banned ===
    const bannedRef = ref(db, "users/" + user.uid + "/banned");
    onValue(bannedRef, (snap) => {
      const banned = snap.val();
      //if (banned === true) {
        //alert("🚫 You have been banned from Convo.");
        //signOut(auth);
      //} 
      // === AUTO-LOGOUT if kicked ===
const kickRef = ref(db, "kicks/" + user.uid);
onValue(kickRef, (snap) => {
  if (snap.exists()) {
    alert("👢 You have been kicked by an admin.");
    signOut(auth);
    // Διαγραφή για να μη γίνει repeat αν ξαναμπεί
    remove(kickRef);
  }
});

    });

    // === Εμφάνιση κουμπιών panels μετά το login ===
    document.getElementById("roomsToggleBtn")?.classList.remove("hidden");
    document.getElementById("usersToggleBtn")?.classList.remove("hidden");
    document.getElementById("logoutBtn")?.classList.remove("hidden");

    // === Όταν κάνουμε login ή register, ανοίγουμε αυτόματα τα panels ===
    document.getElementById("roomsPanel")?.classList.remove("hidden");
    document.getElementById("roomsPanel")?.classList.add("visible");

    // ✨ Μικρό delay για σωστό layout στο usersPanel
    document.getElementById("usersPanel")?.classList.remove("hidden");
    document.getElementById("usersPanel")?.classList.add("visible");

    // === Guest Read-Only Mode (Part A) ===
const msgInput = document.getElementById("msgInput");
const sendBtn  = document.getElementById("sendBtn");

   console.log("👤 Logged in as:", user.email || user.displayName);
authContainer.classList.add("hidden");
chatContainer.classList.remove("hidden");
document.body.classList.remove("auth-active");

// === Guest Read-Only UI Mode (Step 6 – Part A) ===
// === Guest Read-Only UI Mode (Step 6 – Part A) ===
setTimeout(() => {
  const msgInput = document.getElementById("messageInput"); // ✅ σωστό id
  const sendBtn  = document.getElementById("sendBtn");
  if (!msgInput || !sendBtn) return;

  if (user.isAnonymous) {
    msgInput.readOnly = true;
    msgInput.placeholder = "🔒 Μόνο για μέλη — Κάνε εγγραφή για να συμμετάσχεις στο chat!";
    msgInput.style.opacity = "0.7";
    msgInput.style.cursor = "not-allowed";
    msgInput.style.textAlign = "center";
    msgInput.style.color = "#bbb";
    msgInput.style.fontStyle = "italic";

    sendBtn.disabled = true;
    const emojiBtn = document.getElementById("emojiBtn");
if (emojiBtn) {
  emojiBtn.disabled = true;
  emojiBtn.style.opacity = "0.5";
  emojiBtn.style.cursor = "not-allowed";
}

    sendBtn.style.opacity = "0.5";
    sendBtn.style.cursor = "not-allowed";
  } else {
    msgInput.readOnly = false;
    msgInput.placeholder = "Γράψε ένα μήνυμα...";
    msgInput.style.opacity = "1";
    msgInput.style.cursor = "text";
    msgInput.style.textAlign = "left";
    msgInput.style.color = "inherit";
    msgInput.style.fontStyle = "normal";

    sendBtn.disabled = false;
    const emojiBtn = document.getElementById("emojiBtn");
if (emojiBtn) {
  emojiBtn.disabled = false;
  emojiBtn.style.opacity = "1";
  emojiBtn.style.cursor = "pointer";
}

    sendBtn.style.opacity = "1";
    sendBtn.style.cursor = "pointer";
  }
}, 400);


    // === Auto-assign admin role to MysteryMan ===
    if (user.uid === MYSTERYMAN_UID) {
      const adminRef = ref(db, "users/" + user.uid);
      setTimeout(() => {
        set(adminRef, {
          role: "admin",
          displayName: user.displayName || "MysteryMan",
        })
          .then(() =>
            console.log("🛡️ MysteryMan identified as Admin (role saved)")
          )
          .catch((err) => console.error("Role set error:", err));
      }, 500);
  
}

    } else {
  // === Απόκρυψη κουμπιών panels όταν είμαστε στο login/register ===
  document.getElementById("roomsToggleBtn")?.classList.add("hidden");
  document.getElementById("usersToggleBtn")?.classList.add("hidden");
  document.getElementById("logoutBtn")?.classList.add("hidden");

  // === Απόκρυψη και των ίδιων των panels στην auth ===
  document.getElementById("roomsPanel")?.classList.add("hidden");
  document.getElementById("roomsPanel")?.classList.remove("visible");
  document.getElementById("usersPanel")?.classList.add("hidden");
  document.getElementById("usersPanel")?.classList.remove("visible");


      console.log("🚪 Logged out");
      chatContainer.classList.add("hidden");
      authContainer.classList.remove("hidden");
      document.getElementById("usersPanel")?.classList.add("hidden");
        document.body.classList.add("auth-active");


    }
  });
}

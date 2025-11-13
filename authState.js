// ===================== WATCH AUTH STATE =====================
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, set, update, onValue, remove, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { db, auth } from "./firebaseInit.js";


import { convoAlert, convoPrompt } from "./convoAlerts.js";
import { initYouTubePanel } from "./youtube.js";

import { updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";


export function watchAuthState() {
  const authContainer = document.getElementById("authContainer");
  const chatContainer = document.getElementById("chatContainer");

  // === Unique UID of MysteryMan (admin) ===
  const MYSTERYMAN_UID = "LNT3cUi6sUPW3I1FCGSZMJVAymv1"; // ✅ δικό σου UID

  // ===================== MAIN AUTH WATCH =====================
onAuthStateChanged(auth, async (user) => {
    
    if (user) {
        document.body.classList.remove("auth-active"); // ⬅️ βάλε το εδώ
  // ✅ Εξασφάλιση ότι υπάρχει displayName στη βάση
  const userRef = ref(db, `users/${user.uid}`);
  await update(userRef, {
    displayName: user.displayName || "Unknown",
  });

      // === Βήμα 1B — Αν δεν έχει displayName, ζήτησέ το ===
// ============================================================
// 🕓 JoinedAt & LastSeen Tracking (Step 9A)
// ============================================================
(async () => {
  const userRef = ref(db, `users/${user.uid}`);

  try {
    const snap = await get(userRef);

    // Αν δεν υπάρχει joinedAt, γράψε το τώρα
    if (!snap.exists() || !snap.val().joinedAt) {
      await update(userRef, { joinedAt: Date.now() });
    }

    // Ενημέρωση για online
    await update(userRef, {
      status: "online",
      lastSeen: Date.now(),
    });

    // Όταν ο χρήστης φύγει ή κλείσει τη σελίδα → offline + lastSeen
    window.addEventListener("beforeunload", async () => {
      await update(userRef, {
        status: "offline",
        lastSeen: Date.now(),
      });
    });
  } catch (err) {
    console.error("JoinedAt/LastSeen error:", err);
    window.currentUser = user;
window.dispatchEvent(new Event("userReady"));

  }
})();


if (user && (!user.displayName || user.displayName.trim() === "")) {
  (async () => {
    let newName = "";
    while (!newName) {
      const res = await convoPrompt(

        "🎭 Δεν έχεις nickname!\nΔιάλεξε τώρα το όνομα που θα εμφανίζεται στο chat σου:"
      );
      if (!res || res.length < 3 || res.length > 20) {
        await convoAlert("⚠️ Το όνομα πρέπει να έχει 3–20 χαρακτήρες.");

      } else {
        newName = res.trim();
      }
    }

    // Ενημέρωση στο Auth
    await updateProfile(user, { displayName: newName });

    // Ενημέρωση και στη DB
    await update(ref(db, "users/" + user.uid), { displayName: newName });


    await convoAlert(`✅ Nickname αποθηκεύτηκε ως: ${newName}`);

    console.log("🪶 Nickname restored:", newName);
  })();
}

      // === AUTO-LOGOUT if banned (Convo Alert version) ===
            document.body.classList.add("chat-active"); // ✅ Ενεργοποιεί chat mode

      const bannedRef = ref(db, "users/" + user.uid + "/banned");
      onValue(bannedRef, (snap) => {
        const banned = snap.val();
        if (banned === true) {
          convoAlert(

            "⛔ Έχεις αποκλειστεί από το Convo.\n📅 Η πρόσβασή σου έχει αφαιρεθεί από τον MysteryMan."
          );
          setTimeout(() => signOut(auth), 2500);
        }
      });

      // === AUTO-MESSAGE if kicked (Convo Alert) ===
      // === AUTO-LOGOUT if kicked (Convo Alert + SignOut) ===
const kickRef = ref(db, "kicks/" + user.uid);
onValue(kickRef, (snap) => {
  if (snap.exists()) {
    const data = snap.val();
    const by = data.kickedBy || "Admin";
    const reason = data.reason || "χωρίς λόγο";
    convoAlert(`⚠️ Έχεις δεχθεί Kick από τον ${by}\n📝 Λόγος: ${reason}`);

    setTimeout(() => signOut(auth), 2000); // αποβολή μετά από 2s
    remove(kickRef); // Καθαρισμός για να μην επαναλαμβάνεται
  }
});


      // === Εμφάνιση κουμπιών panels μετά το login ===
      document.getElementById("roomsToggleBtn")?.classList.remove("hidden");
      
      // === Επανεμφάνιση όλων των top-right icons μετά το login ===
const topIcons = document.querySelectorAll(
  "#youtubeBtn, #profileBtn, #settingsBtn, #systemBtn, #coinsBtn, #musicBtn, .top-right button, .top-right .icon-btn"
);
topIcons.forEach((icon) => {
  icon.style.display = "";
});
initYouTubePanel(); // ✅ Επανενεργοποιεί το YouTube panel μετά το login



      document.getElementById("usersToggleBtn")?.classList.remove("hidden");
      document.getElementById("logoutBtn")?.classList.remove("hidden");
      // === Εμφάνιση DM εικονιδίου μετά το login ===
const dmNotifBtn = document.getElementById("dmNotifBtn");
if (dmNotifBtn) dmNotifBtn.classList.remove("hidden");


      // === Εμφάνιση panels ===
      document.getElementById("roomsPanel")?.classList.remove("hidden");
      document.getElementById("roomsPanel")?.classList.add("visible");
      document.getElementById("usersPanel")?.classList.remove("hidden");
      document.getElementById("usersPanel")?.classList.add("visible");

      console.log("👤 Logged in as:", user.email || user.displayName);
      console.log("🧩 Current UID:", user.uid);
      // ===============================================================
// 💬 Mentions list refresh (μετά το login)
// ===============================================================
setTimeout(() => {
  if (typeof loadMentions === "function") {
    console.log("🔁 Mentions refresh after login");
    loadMentions();
  } else {
    console.warn("⚠️ loadMentions function not found");
  }
}, 2000);

// 🔥 Τώρα εμφανίζουμε το Chat UI στο DOM
authContainer.classList.add("hidden");
chatContainer.classList.remove("hidden");

// 🟦 ΤΩΡΑ υπάρχει το mainChat → μπορούμε να κάνουμε init τα modules
window.currentUser = user;

// Δώσε ένα μικρό delay 100ms να ζωγραφίσει το DOM
setTimeout(() => {
    console.log("🚀 Dispatching userReady AFTER chatContainer is visible");
    window.dispatchEvent(new Event("userReady"));
}, 100);

      document.body.classList.remove("auth-active");

      // === Guest Read-Only UI Mode (Step 6 – Part A) ===
      setTimeout(() => {
        const msgInput = document.getElementById("messageInput");
        const sendBtn = document.getElementById("sendBtn");
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
  // ✅ Εμφάνιση κουμπιού "Banned" μόνο για MysteryMan (Admin)
  const bannedBtn = document.getElementById("showBannedBtn");
  if (bannedBtn) bannedBtn.classList.remove("hidden");

  // ✅ Εμφάνιση κουμπιού "Rename" μόνο για MysteryMan (Admin)
  const renameBtn = document.getElementById("renameUserBtn");
  if (renameBtn) renameBtn.classList.remove("hidden");

  // ✅ Καταχώριση ρόλου admin στη βάση
  set(adminRef, {
    role: "admin",
    displayName: user.displayName || "MysteryMan",
  })
    .then(() => console.log("🛡️ MysteryMan identified as Admin (role saved)"))
    .catch((err) => console.error("Role set error:", err));
}, 500);
} else {
  // ❌ Απόκρυψη κουμπιού "Banned" για όλους εκτός MysteryMan
  const bannedBtn = document.getElementById("showBannedBtn");
  if (bannedBtn) bannedBtn.classList.add("hidden");

  // ❌ Απόκρυψη κουμπιού "Rename" για όλους εκτός MysteryMan
  const renameBtn = document.getElementById("renameUserBtn");
  if (renameBtn) renameBtn.classList.add("hidden");
}


    } else {
        document.body.classList.add("auth-active"); // ⬅️ βάλε το εδώ

      // === Απόκρυψη panels & κουμπιών όταν είμαστε στο login/register ===
      
      document.body.classList.remove("chat-active"); // ✅ Απενεργοποιεί chat mode
      document.getElementById("roomsToggleBtn")?.classList.add("hidden");
      document.getElementById("usersToggleBtn")?.classList.add("hidden");
      document.getElementById("logoutBtn")?.classList.add("hidden");
  // === Απόκρυψη DM εικονιδίου στο login/register ===
  const dmNotifBtn = document.getElementById("dmNotifBtn");
  if (dmNotifBtn) dmNotifBtn.classList.add("hidden");

      document.getElementById("roomsPanel")?.classList.add("hidden");
      document.getElementById("roomsPanel")?.classList.remove("visible");
      document.getElementById("usersPanel")?.classList.add("hidden");
      document.getElementById("usersPanel")?.classList.remove("visible");
// === Απόκρυψη όλων των top-right icons κατά το login/register ===
const topIcons = document.querySelectorAll(
  "#youtubeBtn, #profileBtn, #settingsBtn, #systemBtn, #coinsBtn, #musicBtn, .top-right button, .top-right .icon-btn"
);
topIcons.forEach((icon) => {
  icon.style.display = "none";
});

// === Απόκρυψη YouTube panel ===
const ytPanel = document.getElementById("youtubePanel");
if (ytPanel) {
  ytPanel.classList.add("hidden");
  ytPanel.classList.remove("visible");
  ytPanel.style.display = "none";
}


      console.log("🚪 Logged out");
      chatContainer.classList.add("hidden");
      authContainer.classList.remove("hidden");
      document.body.classList.add("auth-active");
    }
  });
}

// ===============================================================
// 🎬 Auto-init YouTube panel μόλις φορτώσει το DOM (extra safety)
// ===============================================================
document.addEventListener("DOMContentLoaded", () => {
  try {
    if (typeof initYouTubePanel === "function") {
      initYouTubePanel();
      console.log("🎬 YouTube panel auto-initialized after DOM load");
    }
  } catch (err) {
    console.warn("⚠️ YouTube panel auto-init failed:", err);
  }
});

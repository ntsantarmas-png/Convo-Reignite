// ===================== WATCH AUTH STATE =====================
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ref, set, update, onValue, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { db, auth } from "./firebaseInit.js";
import { showConvoAlert } from "./app.js"; // ✅ για Convo bubble alerts

export function watchAuthState() {
  const authContainer = document.getElementById("authContainer");
  const chatContainer = document.getElementById("chatContainer");

  // === Unique UID of MysteryMan (admin) ===
  const MYSTERYMAN_UID = "LNT3cUi6sUPW3I1FCGSZMJVAymv1"; // ✅ δικό σου UID

  // ===================== MAIN AUTH WATCH =====================
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // === AUTO-LOGOUT if banned (Convo Alert version) ===
            document.body.classList.add("chat-active"); // ✅ Ενεργοποιεί chat mode

      const bannedRef = ref(db, "users/" + user.uid + "/banned");
      onValue(bannedRef, (snap) => {
        const banned = snap.val();
        if (banned === true) {
          showConvoAlert(
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
    showConvoAlert(`⚠️ Έχεις δεχθεί Kick από τον ${by}\n📝 Λόγος: ${reason}`);
    setTimeout(() => signOut(auth), 2000); // αποβολή μετά από 2s
    remove(kickRef); // Καθαρισμός για να μην επαναλαμβάνεται
  }
});


      // === Εμφάνιση κουμπιών panels μετά το login ===
      document.getElementById("roomsToggleBtn")?.classList.remove("hidden");
      document.getElementById("usersToggleBtn")?.classList.remove("hidden");
      document.getElementById("logoutBtn")?.classList.remove("hidden");

      // === Εμφάνιση panels ===
      document.getElementById("roomsPanel")?.classList.remove("hidden");
      document.getElementById("roomsPanel")?.classList.add("visible");
      document.getElementById("usersPanel")?.classList.remove("hidden");
      document.getElementById("usersPanel")?.classList.add("visible");

      console.log("👤 Logged in as:", user.email || user.displayName);
      authContainer.classList.add("hidden");
      chatContainer.classList.remove("hidden");
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
          // ✅ Εμφάνιση κουμπιού Unban μόνο για Admin
const bannedBtn = document.getElementById("showBannedBtn");
if (bannedBtn) bannedBtn.classList.remove("hidden");

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
      // === Απόκρυψη panels & κουμπιών όταν είμαστε στο login/register ===
            document.body.classList.remove("chat-active"); // ✅ Απενεργοποιεί chat mode
      document.getElementById("roomsToggleBtn")?.classList.add("hidden");
      document.getElementById("usersToggleBtn")?.classList.add("hidden");
      document.getElementById("logoutBtn")?.classList.add("hidden");

      document.getElementById("roomsPanel")?.classList.add("hidden");
      document.getElementById("roomsPanel")?.classList.remove("visible");
      document.getElementById("usersPanel")?.classList.add("hidden");
      document.getElementById("usersPanel")?.classList.remove("visible");

      console.log("🚪 Logged out");
      chatContainer.classList.add("hidden");
      authContainer.classList.remove("hidden");
      document.body.classList.add("auth-active");
    }
  });
}

// ===============================================================
// 🆔 Convo — UID Panel (Step 3: Live DB list + Copy)
// ===============================================================

import { auth, db } from "./firebaseInit.js";
import {
  ref,
  onValue,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { convoAlert } from "./convoAlerts.js";

// === Elements ===
const uidBtn = document.getElementById("uidBtn");
const uidPanel = document.getElementById("uidPanel");
const uidList = document.getElementById("uidList");
const closeUidBtn = document.getElementById("closeUidBtn");

// === Εμφάνιση UID Panel μόνο για MysteryMan (με delay ασφάλειας) ===
auth.onAuthStateChanged((user) => {
  if (!uidBtn || !uidPanel) return;

  // Κρύψε το κουμπί αρχικά
  uidBtn.classList.add("hidden");

  if (user) {
    // Μικρό delay για να προλάβει να φορτώσει το displayName
    setTimeout(() => {
      const name = user.displayName || "";
      if (name.toLowerCase() === "mysteryman") {
        uidBtn.classList.remove("hidden");
        loadUidList();
      }
    }, 800); // 🕒 0.8s ασφαλείας
  }
});


// === Toggle open/close ===
uidBtn?.addEventListener("click", () => {
  uidPanel.classList.toggle("hidden");
});

// === Close button ===
closeUidBtn?.addEventListener("click", () => {
  uidPanel.classList.add("hidden");
});

// === Click έξω για κλείσιμο ===
document.addEventListener("click", (e) => {
  if (!uidPanel.classList.contains("hidden")) {
    const clickedInside = uidPanel.contains(e.target) || uidBtn.contains(e.target);
    if (!clickedInside) uidPanel.classList.add("hidden");
  }
});

// ===============================================================
// 🔹 Live Load Users (UID + Name) from DB
// ===============================================================
function loadUidList() {
  const usersRef = ref(db, "users");

  onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    uidList.innerHTML = ""; // καθάρισε πριν ξαναγεμίσει

 if (!data) {
  uidList.innerHTML = `<p class="muted">⚠️ No users found.</p>`;
  convoAlert("📭 Δεν βρέθηκαν χρήστες στη βάση δεδομένων.");
  return;
}


    Object.entries(data).forEach(([uid, info]) => {
      const displayName = info.displayName || "Unknown";

      // === Δημιουργία στοιχείου ===
      const row = document.createElement("div");
      row.className = "uid-row";
      row.innerHTML = `
        <span class="uid-name">${displayName}</span>
        <span class="uid-code">${uid}</span>
        <button class="copy-btn" title="Copy UID">📋</button>
      `;

      // === Αντιγραφή UID ===
      row.querySelector(".copy-btn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(uid);
    showCopiedAnimation(row);
  } catch (err) {
    console.error("❌ Clipboard copy failed:", err);
    convoAlert("⚠️ Αποτυχία αντιγραφής UID — έλεγξε τα δικαιώματα του browser.");
  }
});

      uidList.appendChild(row);
    });
  });
}

// ===============================================================
// 💫 Copy animation ("✅ Copied!")
// ===============================================================
function showCopiedAnimation(row) {
  const note = document.createElement("span");
  note.className = "copied-note";
  note.textContent = "✅ Copied!";
  row.appendChild(note);
  setTimeout(() => note.remove(), 1200);
}

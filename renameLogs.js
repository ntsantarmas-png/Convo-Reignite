// ===============================================================
// ✏️ Convo — renameLogs.js
// Purpose: Show only "rename" actions from /adminLogs (MysteryMan only)
// ===============================================================

import { auth, db } from "./firebaseInit.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { convoAlert } from "./convoAlerts.js";

// --- DOM references ---
const renameBtn = document.getElementById("renameBtn");

// Use existing modal from index.html
const renameModal    = document.getElementById("renameModal");
const renameLogsList = document.getElementById("renameLogsList");
const closeRenameBtn = document.getElementById("closeRenameBtn");




// === Show button only for MysteryMan (guaranteed load) ===
// === Show button only for approved Admin UIDs ===

// 🔒 Όλοι οι επιτρεπόμενοι admins (βάζεις όποια UIDs θέλεις)
const allowedUids = [
  "LNT3cUi6sUPW3l1FCGSZMJVAymv1", // MysteryMan
  "EXAMPLE_UID_1", // Admin #2
  "EXAMPLE_UID_2", // Admin #3
];

function waitForButton() {
  const btn = document.getElementById("renameBtn");
  const user = auth.currentUser;

  if (!btn) {
    console.log("⏳ Waiting for renameBtn...");
    return setTimeout(waitForButton, 400);
  }

  console.log("🧠 Found renameBtn, checking UID:", user?.uid);
  if (allowedUids.includes(user?.uid || auth.currentUser?.uid)) {

    btn.classList.remove("hidden");
    console.log("✅ Rename button shown for allowed Admin UID");
  } else {
    console.warn("❌ Rename button hidden — UID not in allowed list:", user?.uid);
  }
}

// 🧠 Περιμένουμε λίγο ώστε να φορτωθούν τα πάντα
setTimeout(waitForButton, 1500);






// === Button click -> open modal (με Convo emoji trail) ===
renameBtn.addEventListener("click", async (e) => {
  emojiTrail(e); // 💫 πετάει τα emojis!
  renameModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  animateGlow(renameModal);
  await loadRenameLogs();
});


// === Close modal ===
renameModal.addEventListener("click", (e) => {
  if (e.target.id === "closeRenameBtn" || e.target.id === "renameModal") {
    renameModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
});

// === Load rename logs ===
async function loadRenameLogs() {
  const list = document.getElementById("renameLogsList");
  list.innerHTML = "<p class='muted'>Loading rename logs...</p>";

  try {
    const snap = await get(ref(db, "adminLogs"));
    list.innerHTML = "";

    snap.forEach((child) => {
      const data = child.val();
      if (data.type === "rename") {
        const item = document.createElement("div");
        item.className = "log-item rename-entry";
        item.innerHTML = `
          <div><b>Old:</b> ${data.oldName || "—"} ➜ <b>New:</b> ${data.newName || "—"}</div>
          <div class="muted small">By: ${data.adminName || "Unknown"} • ${new Date(
            data.createdAt || data.timestamp || Date.now()
          ).toLocaleString()}</div>
        `;
        list.prepend(item);
      }
    });

    if (!list.innerHTML.trim()) {
      list.innerHTML = "<p class='muted'>No rename actions found yet.</p>";
      convoAlert("📭 Δεν υπάρχουν ακόμα αλλαγές ονομάτων στο ιστορικό.");
    }
  } catch (err) {
    console.error("❌ Σφάλμα φόρτωσης rename logs:", err);
    convoAlert("⚠️ Δεν ήταν δυνατή η φόρτωση του ιστορικού μετονομασιών.");
  }
}


// === Glow animation ===
function animateGlow(modal) {
  modal.querySelector(".modal-box").animate(
    [
      { boxShadow: "0 0 0px rgba(0,255,200,0)" },
      { boxShadow: "0 0 20px rgba(0,255,200,0.7)" },
      { boxShadow: "0 0 0px rgba(0,255,200,0)" },
    ],
    { duration: 600, iterations: 1 }
  );
}
// === ✨ Convo Emoji Trail Effect ===
function emojiTrail(event) {
  const emojis = ["✨", "💫", "🌟", "🪶", "💙"];
  for (let i = 0; i < 4; i++) {
    const span = document.createElement("span");
    span.className = "emoji-float";
    span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    document.body.appendChild(span);

    const startX = event.clientX + (Math.random() * 40 - 20);
    const startY = event.clientY + (Math.random() * 20 - 10);
    const translateY = -(60 + Math.random() * 20);

    span.style.left = `${startX}px`;
    span.style.top = `${startY}px`;
    span.style.opacity = 0.9;
    span.style.transition = "transform 0.8s ease, opacity 0.8s ease";
    span.style.transform = `translateY(${translateY}px) scale(${0.9 + Math.random() * 0.3})`;

    setTimeout(() => (span.style.opacity = 0), 50);
    setTimeout(() => span.remove(), 800);
  }
}

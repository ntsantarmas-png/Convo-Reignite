// ===============================================================
// 💬 CONVO REACTIONS SYSTEM — Step 1C (Realtime + Glow)
// ===============================================================

import { db } from "./firebaseInit.js";
import {
  ref,
  get,
  set,
  update,
  remove,
  onValue,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// ===============================================================
// 🩵 Toggle Reaction (add/remove)
// ===============================================================
export async function toggleReaction(messageId, emoji) {
  const user = window.currentUser;
  if (!user || !user.uid) return;

  const reactionRef = ref(db, `v3/reactions/${messageId}/${emoji}/${user.uid}`);
  const snap = await get(reactionRef);

  if (snap.exists()) {
    await remove(reactionRef);
    console.log(`❌ Removed ${emoji} by ${user.displayName}`);
  } else {
    await set(reactionRef, { by: user.displayName, ts: Date.now() });
    console.log(`💖 Added ${emoji} by ${user.displayName}`);
  }
}

// ===============================================================
// 🧮 Helper — Count reactions per emoji
// ===============================================================
export function parseReactionData(snapshotVal) {
  const result = {};
  if (!snapshotVal) return result;
  Object.entries(snapshotVal).forEach(([emoji, users]) => {
    result[emoji] = Object.keys(users || {}).length;
  });
  return result;
}

// ===============================================================
// ✨ Render & Live Listen (fixed stable version)
// ===============================================================
export function renderReactions(container, messageId) {
  const bar = document.createElement("div");
  bar.className = "reaction-bar";
  container.appendChild(bar);

  const msgRef = ref(db, `v3/reactions/${messageId}`);

  // 🔄 Live listener για όλες τις αντιδράσεις
  onValue(msgRef, (snap) => {
    const data = snap.val();
    const parsed = parseReactionData(data);

    // Αν δεν υπάρχουν αντιδράσεις → καθάρισε το bar
if (!parsed) {
  bar.innerHTML = "";
  return;
}


    // ===========================================================
    // Ανανεώνουμε ολόκληρη τη μπάρα (πιο ασφαλές)
    // ===========================================================
    const existing = {};
    bar.querySelectorAll(".reaction-btn").forEach(btn => {
      existing[btn.dataset.emoji] = btn;
    });

    // Κράτα μόνο όσα υπάρχουν στο parsed
    Object.keys(existing).forEach(emo => {
      if (!parsed[emo]) {
        existing[emo].remove();
      }
    });

    // Δημιούργησε ή ενημέρωσε τα reactions
    Object.entries(parsed).forEach(([emoji, count]) => {
      let btn = bar.querySelector(`[data-emoji="${emoji}"]`);

      // === Αν δεν υπάρχει κουμπί, φτιάξτο ===
      if (!btn) {
        btn = document.createElement("span");
        btn.className = "reaction-btn";
        btn.dataset.emoji = emoji;
        btn.innerHTML = `${emoji} <small>${count}</small>`;
        btn.style.pointerEvents = "auto";
        btn.style.cursor = "pointer";
        btn.style.opacity = "0";
        bar.appendChild(btn);
// ===============================================================
// 🩵 Hover Tooltip με ονόματα χρηστών
// ===============================================================
const tooltip = document.createElement("div");
tooltip.className = "reaction-tooltip";
tooltip.textContent = "—";
tooltip.style.cssText = `
  display:none;
  position:absolute;
  background:rgba(20,20,30,0.95);
  border:1px solid rgba(0,255,255,0.25);
  border-radius:8px;
  padding:4px 8px;
  color:#fff;
  font-size:13px;
  box-shadow:0 0 10px rgba(0,255,255,0.4);
  z-index:1000;
  white-space:nowrap;
  pointer-events:none;
  transform:translateY(-6px);
`;
document.body.appendChild(tooltip);
// Αν ο χρήστης κάνει scroll στο chat → κρύψε το tooltip
const messagesDiv = document.getElementById("messages");
if (messagesDiv) {
  messagesDiv.addEventListener("scroll", () => {
    tooltip.style.display = "none";
  });
}

// === Smart auto-hide on scroll ===
const chatArea = document.getElementById("messages");
if (chatArea) {
  chatArea.addEventListener("scroll", () => {
    tooltip.style.opacity = "0";
    tooltip.style.display = "none";
  });
}

btn.addEventListener("mouseenter", async (e) => {
  // 🔍 Πάρε λίστα χρηστών που έκαναν αυτό το emoji
  const usersSnap = await get(ref(db, `v3/reactions/${messageId}/${emoji}`));
  if (!usersSnap.exists()) return;
  const users = Object.values(usersSnap.val() || {}).map(u => u.by);
  tooltip.textContent = users.join(", ");

  // ✨ Smart positioning (auto-adjust near edges)
const rect = e.target.getBoundingClientRect();
const tooltipWidth = tooltip.offsetWidth || 100;
const screenW = window.innerWidth;

// Υπολογισμός X θέσης — μην βγει έξω από δεξιά/αριστερά
let left = rect.left + rect.width / 2 - tooltipWidth / 2;
if (left < 6) left = 6;
if (left + tooltipWidth > screenW - 6) left = screenW - tooltipWidth - 6;

// Υπολογισμός Y (πάνω ή κάτω απ’ το emoji)
let top = rect.top - 36;
if (top < 0) top = rect.bottom + 8;

tooltip.style.left = `${left}px`;
tooltip.style.top = `${top}px`;
tooltip.style.display = "block";

// Smooth motion glow
tooltip.animate(
  [
    { opacity: 0, transform: "translateY(-4px) scale(0.96)" },
    { opacity: 1, transform: "translateY(0) scale(1)" }
  ],
  { duration: 220, easing: "ease-out" }
);

  tooltip.animate(
    [{ opacity: 0, transform: "translateY(-4px)" },
     { opacity: 1, transform: "translateY(0)" }],
    { duration: 200, easing: "ease-out" }
  );
});

btn.addEventListener("mouseleave", () => {
  // Smooth hide animation
  tooltip.animate(
    [
      { opacity: 1, transform: "translateY(0) scale(1)" },
      { opacity: 0, transform: "translateY(-4px) scale(0.97)" }
    ],
    { duration: 150, easing: "ease-in" }
  ).onfinish = () => {
    tooltip.style.display = "none";
  };
});


        // 🔥 Fade-in animation
        btn.animate(
          [
            { opacity: 0, transform: "scale(0.8)" },
            { opacity: 1, transform: "scale(1)" }
          ],
          { duration: 250, easing: "ease-out" }
        );
btn.style.opacity = "1"; // 🩵 Κρατά το κουμπί ορατό μετά το animation

        btn.addEventListener("click", async () => {
          await toggleReaction(messageId, emoji);
        });
      } else {
        // === Ενημέρωση count με animation ===
        const counter = btn.querySelector("small");
        const oldCount = parseInt(counter?.textContent || "0");
        if (count !== oldCount) {
          counter.textContent = count;
          counter.animate(
            [
              { transform: "scale(1)" },
              { transform: "scale(1.4)" },
              { transform: "scale(1)" }
            ],
            { duration: 250, easing: "ease-out" }
          );
        }
      }
});
  // === Κλείσε οποιοδήποτε tooltip αν αλλάξει η λίστα reactions ===
  const openTooltip = document.querySelector(".reaction-tooltip[style*='display: block']");
  if (openTooltip) {
    openTooltip.style.display = "none";
  }
  });
}

// ===============================================================
// 💬 Convo Mentions Panel (mentionsPanel.js)
// ===============================================================

import { auth, db } from "./firebaseInit.js";
import { ref, get, query, orderByChild, limitToFirst } 
  from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// ===============================================================
// 🔧 Globals
// ===============================================================
let mentionsPopup = null;
let mentionsList = [];
let currentInput = null;
let suppressNextMention = false;

// ===============================================================
// 🧩 Init Mentions Panel
// ===============================================================

  export function initMentionsPanel(inputEl) {
  if (window.__mentionsInit) {
    console.warn("⚠️ Mentions panel already initialized, skipping duplicate init.");
    return;
  }
  window.__mentionsInit = true;

  currentInput = inputEl;
  // Δημιουργία popup container ...



  // Δημιουργία popup container (μία φορά)
  mentionsPopup = document.createElement("div");
  mentionsPopup.classList.add("mention-popup");
  mentionsPopup.style.display = "none";
  document.body.appendChild(mentionsPopup);
// το popup να είναι fixed για σωστή τοποθέτηση πάνω από τα panels
mentionsPopup.style.position = "fixed";
mentionsPopup.setAttribute("role", "listbox");

// κλείσιμο με ESC σε όλο το έγγραφο
document.addEventListener("keydown", handleEscClose);
  // Φόρτωση users από τη βάση (για @mentions)
const usersRef = ref(db, "/users");



  // Φόρτωση users μόνο μία φορά (όχι σε κάθε αλλαγή)

console.log("🔍 Fetching users from:", usersRef.toString());

mentionsList = [];

async function loadMentions() {
  try {
    console.log("🔍 Fetching all users for mentions...");
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);
    mentionsList = [];

    if (!snapshot.exists()) {
      console.warn("⚠️ No users found at /users");
      return;
    }

    snapshot.forEach(childSnap => {
      const data = childSnap.val();
      if (data && data.displayName) {
        mentionsList.push(data.displayName);
      }
    });

    console.log("📜 Mentions loaded:", mentionsList);
  } catch (err) {
    console.error("❌ Mentions load error:", err.message);
  }
}
window.loadMentions = loadMentions;


  // Listener για @input στο πεδίο
  inputEl.addEventListener("input", handleMentionInput);
  document.addEventListener("click", handleOutsideClick);
}

// ===============================================================
// 🔎 Handle Typing '@' + Search (fixed version)
// ===============================================================
function handleMentionInput(e) {
  // 🚫 Αν μόλις μπήκε mention, αγνόησε αυτό το input
  if (suppressNextMention) {
    suppressNextMention = false;
    return;
  }

  const text = e.target.value;
  const cursorPos = e.target.selectionStart;
  const atIndex = text.lastIndexOf("@", cursorPos - 1);

  // ❌ Αν δεν υπάρχει @ πριν τον κέρσορα → κρύψε το popup
  if (atIndex === -1) {
    hideMentions();
    return;
  }

  // 🔍 Έλεγχος αν το @ είναι “ενεργό” (όχι μέσα σε ολοκληρωμένο mention)
  // Δηλαδή, σταματάμε αν υπάρχει κενό ή zero-width space μετά το όνομα
  const textAfterAt = text.slice(atIndex + 1, cursorPos);
  if (textAfterAt.includes(" ") || textAfterAt.includes("\u200b")) {
    hideMentions();
    return;
  }

  const query = textAfterAt.trim().toLowerCase();

  if (query.length === 0) {
    renderMentionsList(mentionsList);
  } else {
    const filtered = mentionsList.filter(u =>
      u.toLowerCase().startsWith(query)
    );
    renderMentionsList(filtered);
  }

  // 💡 Υπολογισμός θέσης popup
  const rect = currentInput.getBoundingClientRect();
  mentionsPopup.style.left = `${rect.left + 60}px`;
  mentionsPopup.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  mentionsPopup.style.display = "block";
}

// ===============================================================
// 🧾 Render Popup
// ===============================================================
function renderMentionsList(list) {
  if (!mentionsPopup) return;
  if (list.length === 0) {
    mentionsPopup.innerHTML = "<div class='mention-empty'>No matches</div>";
    return;
  }

  mentionsPopup.innerHTML = list
    .map(u => `<div class='mention-item'>${u}</div>`)
    .join("");

  mentionsPopup.querySelectorAll(".mention-item").forEach(item => {
    item.addEventListener("click", () => insertMention(item.textContent));
  });
}


// ===============================================================
// ⌨️ Keyboard Navigation for Mentions Popup
// ===============================================================
let activeIndex = -1;

document.addEventListener("keydown", (e) => {
  if (!mentionsPopup || mentionsPopup.style.display === "none") return;

  const items = Array.from(mentionsPopup.querySelectorAll(".mention-item"));
  if (items.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex = (activeIndex + 1) % items.length;
    updateActiveMention(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex = (activeIndex - 1 + items.length) % items.length;
    updateActiveMention(items);
  } else if (e.key === "Enter" && activeIndex >= 0) {
    e.preventDefault();
    items[activeIndex].click(); // επιλέγει αυτόματα το ενεργό mention
  }
});

function updateActiveMention(items) {
  items.forEach((item, i) => {
    if (i === activeIndex) {
      item.classList.add("active");
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("active");
    }
  });
}

// ===============================================================
// ✏️ Insert Selected Mention
// ===============================================================
// ===============================================================
// ✏️ Insert Selected Mention
// ===============================================================
function insertMention(name) {
  const text = currentInput.value;
  const cursorPos = currentInput.selectionStart;
  const atIndex = text.lastIndexOf("@", cursorPos - 1);
  if (atIndex === -1) return;

  // 🔒 Αφαίρεσε το '@' που πυροδότησε το popup και βάλε ολοκληρωμένο mention
  const before = text.slice(0, atIndex);
  const after = text.slice(cursorPos);
  const mentionText = `@${name}\u200b `;


  currentInput.value = before + mentionText + after;

  // ✅ Ενημέρωσε τον κέρσορα να πάει στο τέλος
  const newPos = before.length + mentionText.length;
  currentInput.setSelectionRange(newPos, newPos);

  // ✅ Κλείσε εντελώς το popup
  mentionsPopup.style.display = "none";
  hideMentions();

  // ✅ Καθυστέρησε ελάχιστα το focus για να μη θεωρηθεί νέο input
  setTimeout(() => {
    currentInput.focus();
  }, 60);


  // ✅ Επανενεργοποίησε την αποστολή με Enter (χωρίς shift)
  const form = document.getElementById("messageForm");
  if (form && currentInput) {
    currentInput.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          const popup = document.querySelector(".mention-popup");
          if (!popup || popup.style.display === "none") {
            e.preventDefault();
            form.requestSubmit(); // στείλε το μήνυμα
          }
        }
      },
      { once: true } // τρέχει μόνο μία φορά
    );
  }
}


// ===============================================================
// 🧹 Hide Mentions Popup
// ===============================================================
function hideMentions() {
  if (mentionsPopup) mentionsPopup.style.display = "none";
}

// ===============================================================
// 🚫 Outside Click Handler
// ===============================================================
function handleOutsideClick(e) {
  if (mentionsPopup && !mentionsPopup.contains(e.target) && e.target !== currentInput) {
    hideMentions();
  }
}
// ===============================================================
// ⌨️ ESC Key Close Handler
// ===============================================================
function handleEscClose(e) {
  if (e.key === "Escape") {
    hideMentions();
  }
}
// ===============================================================
// 📋 Load Mentions List (Panel Mode)
// ===============================================================
// ===============================================================
// 📋 Load Mentions List (Panel Mode – Διορθωμένο για Rooms & DMs)
// ===============================================================
export async function loadMentionsPanelList() {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    console.warn("⚠️ No user logged in for mentions panel.");
    return;
  }

  // ✅ Αν είμαστε σε DM → χρησιμοποίησε το currentPrivateChatId
  const chatId = window.currentPrivateChatId || null;
  const isDM = !!chatId;

  // 🔹 Ανάλογα με το context (room ή DM)
  const messagesRef = isDM
    ? ref(db, `v3/privateChats/${chatId}/messages`)
    : ref(db, "v3/messages/general");

  const panel = document.getElementById("mentionsList");
  if (!panel) {
    console.warn("⚠️ Mentions panel list element not found.");
    return;
  }

  try {
    const snapshot = await get(messagesRef);
    if (!snapshot.exists()) {
      panel.innerHTML = "<p>Δεν υπάρχουν mentions ακόμα.</p>";
      return;
    }

    const data = snapshot.val() || {};

    // ✅ Φίλτρο mentions ανά context
    const mentions = Object.entries(data)
      .filter(([_, msg]) =>
        msg.mentions &&
        msg.mentions.includes(userId) &&
        (isDM
          ? msg.roomType === "dm"
          : msg.roomType === "room" || !msg.roomType)
      )
      .map(([id, msg]) => ({
        id,
        text: msg.text || "(χωρίς κείμενο)",
        username: msg.username || "άγνωστος",
        timestamp: msg.timestamp || msg.createdAt || Date.now(),
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    if (mentions.length === 0) {
      panel.innerHTML = "<p>Δεν υπάρχουν mentions ακόμα.</p>";
      return;
    }

    // ✅ Εμφάνιση mentions στο panel
    panel.innerHTML = mentions
      .map((m) => {
        const date = new Date(m.timestamp);
        const timeStr = date.toLocaleString("el-GR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });

        return `
          <div class="mention-item-panel" data-id="${m.id}">
            <div class="mention-text">
              <strong>@${m.username}</strong>: ${m.text}
            </div>
            <div class="mention-time">${timeStr}</div>
          </div>
        `;
      })
      .join("");

    // ✅ Κλικ για scroll στο μήνυμα
    panel.querySelectorAll(".mention-item-panel").forEach((item) => {
      item.addEventListener("click", () => {
        const targetId = item.dataset.id;
        const messagesEl = document.getElementById("messages");
        if (!messagesEl || !targetId) return;

        const target = messagesEl.querySelector(`[data-id="${targetId}"]`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.style.transition = "background-color 0.3s ease";
          const oldBg = target.style.backgroundColor;
          target.style.backgroundColor = "#3b82f6";
          setTimeout(() => {
            target.style.backgroundColor = oldBg || "";
          }, 1200);
        }

        document.getElementById("mentionsPanel")?.classList.add("hidden");
      });
    });
  } catch (err) {
    console.error("❌ Mentions panel load error:", err);
    panel.innerHTML = "<p>Σφάλμα φόρτωσης mentions.</p>";
  }
}

// ✅ Τελικό export
export { loadMentionsPanelList as loadMentionsPanel };

// ============================================================================
// 🏠 Rooms Panel — Realtime Sync (Part E)
// ============================================================================
// (UPDATED — includes Convo Pulse / Lounge UI Slot injection)
// Base file used: original roomsPanel.js (you provided). :contentReference[oaicite:1]{index=1}
import { auth } from "./firebaseInit.js";
import { db } from "./firebaseInit.js";
import {
  ref,
  onChildAdded,
  onChildRemoved,
  onValue,
  get,
  set,
  remove,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

import { loadRoomMessages } from "./chatMessages.js";
import { convoAlert, convoConfirm, convoPrompt } from "./convoAlerts.js";
// === DOM refs ===
const roomsListEl = document.getElementById("roomsList");
const createBtn = document.getElementById("createRoomBtn");
const deleteBtn = document.getElementById("deleteRoomBtn");

let currentRoom = "general";
const roomsMap = new Map(); // αποθήκευση room ids & ονόματα

// ========================= Convo Pulse (UI Slot) — CONFIG =====================
const PULSE_SLOT_ID = "convoPulseSlot";
const PULSE_COLLAPSE_KEY = "convoPulseCollapsed";

// Dummy data for pulse (replace/extend later or fetch from DB)
const pulseItemsDefault = [
  { type: "news", title: "🎉 New Emoji Pack Released!" },
  { type: "news", title: "🛠 Maintenance Update Tomorrow" },
  { type: "smoothie", title: "🥤 Energy Boost: Banana Rush" },
  { type: "smoothie", title: "🍇 Recovery: Berry Power" },
  { type: "idea", title: '💡 "Add Daily Reward System?"', votes: 123 },
  { type: "event", title: "🎄 Holiday Gift Challenge!" },
];

// ============================================================================
// 🔄 Realtime Listeners
// ============================================================================
const roomsRef = ref(db, "v3/rooms");
// ============================================================================
// 🩵 CONVO PULSE — Firebase Hook (Realtime listener)
// ============================================================================
let pinnedMapLive = {};

const pulseRef = ref(db, "v3/pulse");
let pulseItemsLive = [];

// Όταν προστεθεί νέο item στο /pulse
onChildAdded(pulseRef, async (snap) => {
  const val = snap.val();
  if (!val) return;
  val.id = snap.key; // ✅ Σιγουρεύει ότι κάθε item έχει σταθερό id

  // 🕓 Αν έχει expiresAt και έχει περάσει → διαγραφή
  if (val.expiresAt && Date.now() > val.expiresAt) {
    console.log("🧹 Auto-clean expired Pulse item:", val.title);
    await remove(ref(db, "v3/pulse/" + snap.key));
    return; // μην το εμφανίσεις καν
  }

  pulseItemsLive.push(val);
  renderPulseItems(pulseItemsLive, pinnedMapLive);

});


// ============================================================================
// 🗑️ Όταν διαγραφεί κάποιο Pulse item (πλήρης καθαρισμός)
// ============================================================================
onChildRemoved(pulseRef, (snap) => {
  const removedId = snap.key;
  if (!removedId) return;

  // 🔍 Αφαίρεση από την τοπική λίστα βάσει ID ή τίτλου
  pulseItemsLive = pulseItemsLive.filter(
    (x) => String(x.id || x.title) !== String(removedId)
  );

  console.log(`🗑️ Pulse deleted from Firebase: ${removedId}`);
  renderPulseItems(
    pulseItemsLive.length ? pulseItemsLive : pulseItemsDefault,
    pinnedMapLive
  );
});

// 📌 Παρακολούθηση pinned posts
const pinnedRef = ref(db, "v3/pulsePinned");
onValue(pinnedRef, (snap) => {
  pinnedMapLive = snap.val() || {};
  renderPulseItems(pulseItemsLive, pinnedMapLive);
});

// Προσθήκη νέου room
onChildAdded(roomsRef, (snap) => {
  const roomId = snap.key;
  const val = snap.val();
  roomsMap.set(roomId, val?.name || roomId);
  renderRooms();
});

// ============================================================================
// 🗑️ Όταν διαγραφεί ένα room
// ============================================================================
onChildRemoved(roomsRef, (snap) => {
  const removedRoom = snap.key;
  roomsMap.delete(removedRoom);
  renderRooms();

  // Αν ο χρήστης ήταν μέσα στο room που διαγράφηκε
  if (currentRoom === removedRoom) {
    currentRoom = "general";
    localStorage.setItem("lastRoom", currentRoom);
    loadRoomMessages(currentRoom);
    convoAlert(`⚠️ Το δωμάτιο "${removedRoom}" διαγράφηκε. Μεταφέρθηκες στο #general.`);
    console.log(`🔄 Moved back to #general after deleting "${removedRoom}"`);
  }
});

// ============================================================================
// 🧩 Convo Pulse — UI helpers (Slot creation, render, toggle)
// ============================================================================

function ensurePulseSlot() {
  // Avoid duplicating
  if (document.getElementById(PULSE_SLOT_ID)) return document.getElementById(PULSE_SLOT_ID);

  // Where to attach: try to attach right after the roomsListEl container
  const attachAfter = roomsListEl?.parentElement || document.body;
  if (!attachAfter) return null;

  const slot = document.createElement("div");
  slot.id = PULSE_SLOT_ID;
  slot.className = "convo-pulse-slot";
  // Minimal inline styles so it looks ok until you add proper CSS
  slot.style.cssText = `
    margin-top:12px;
    border-top:1px solid rgba(255,255,255,0.04);
    padding-top:8px;
    font-size:13px;
  `;

  // header (collapsible)
  const header = document.createElement("div");
  header.className = "convo-pulse-header";
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:6px 4px;";
  header.innerHTML = `
  <div style="display:flex;align-items:center;gap:8px;">
    <span style="font-weight:700;color:#b3e5fc;">📰 CONVO NEWS / LOUNGE</span>
    <small style="opacity:0.7;transform:rotate(0deg);transition:transform 0.25s ease;">▼</small>
  </div>
  <div style="display:flex;gap:6px;align-items:center;">
    <button id="pulseAddBtn" title="Add new post"
      style="display:none;padding:3px 6px;border-radius:6px;border:0;
      background:rgba(255,255,255,0.08);color:#9be7ff;cursor:pointer;">
      + Add
    </button>
    <div style="opacity:.7;font-size:12px;">toggle</div>
  </div>
`;



  const content = document.createElement("div");
  content.className = "convo-pulse-content";
  content.style.cssText = "margin-top:8px;display:block;gap:6px;";

  slot.appendChild(header);
  slot.appendChild(content);
  // ===============================================================
// ✨ SHOW "+ Add" BUTTON ONLY FOR MYSTERYMAN
// ===============================================================


const addBtn = slot.querySelector("#pulseAddBtn");
auth.onAuthStateChanged((user) => {
  if (!user) return;
  const name = user.displayName || "";
  if (name === "MysteryMan") {
    addBtn.style.display = "inline-block";
  } else {
    addBtn.style.display = "none";
  }
});

// ✅ Ενεργοποίηση κουμπιού μόνο για MysteryMan
// ✅ Εμφάνιση +Add κουμπιού για MysteryMan μόλις φορτώσει ο χρήστης
window.addEventListener("userReady", () => {
  const user = window.currentUser || {};
  if (user.displayName === "MysteryMan") {
    const btn = slot.querySelector("#pulseAddBtn");
    if (btn) {
      btn.style.display = "inline-block";
      btn.addEventListener("click", addPulsePost);
    }
  }
});


  // insert after roomsListEl (if possible)
  if (roomsListEl && roomsListEl.parentElement) {
    // insert after roomsListEl
    roomsListEl.parentElement.insertBefore(slot, roomsListEl.nextSibling);
  } else {
    attachAfter.appendChild(slot);
  }

  // Restore collapsed state
  const collapsed = localStorage.getItem(PULSE_COLLAPSE_KEY) === "1";
  if (collapsed) {
    content.style.display = "none";
    header.querySelector("small") && (header.querySelector("small").textContent = "►");
  }

  // Toggle behavior
header.addEventListener("click", () => {
  const isHidden = content.style.display === "none";
  content.style.display = isHidden ? "block" : "none";
  header.querySelector("small") && (header.querySelector("small").textContent = isHidden ? "▼" : "►");
  localStorage.setItem(PULSE_COLLAPSE_KEY, isHidden ? "0" : "1");

  // ✅ Add/remove collapsed class for CSS arrow rotation
  if (isHidden) {
    header.classList.remove("collapsed");
  } else {
    header.classList.add("collapsed");
  }

  window.dispatchEvent(new CustomEvent("convoPulseToggled", { detail: { collapsed: !isHidden } }));
});


  return slot;
}


// ============================================================================
// 🩵 CONVO PULSE — Add Post (MysteryMan only)
// ============================================================================
async function addPulsePost() {
  const user = window.currentUser || {};
  if (user.displayName !== "MysteryMan") {
    convoAlert("⛔ Μόνο ο MysteryMan μπορεί να προσθέτει Pulse posts.");
    return;
  }

  const title = await convoPrompt("📰 Τίτλος νέου Pulse post:");
  if (!title) return;

  const type = await convoPrompt("💬 Τύπος (news / smoothie / idea / event):");
  if (!type) return;
  const desc = await convoPrompt("📝 Σύντομη περιγραφή ή περιεχόμενο του post:");
  if (!desc) {
    const confirmSkip = await convoConfirm("⚠️ Θες να το αφήσεις χωρίς περιγραφή;");
    if (!confirmSkip) return;
  }

  // 🗓️ Προαιρετική ημερομηνία λήξης για events
  let expiresAt = null;
  if (type.toLowerCase() === "event") {
    const expInput = await convoPrompt("📅 Πότε λήγει αυτό το event; (μορφή: YYYY-MM-DD ή άφησέ το κενό)");
    if (expInput && expInput.trim() !== "") {
      const ts = new Date(expInput).getTime();
      if (!isNaN(ts)) expiresAt = ts;
      else await convoAlert("⚠️ Μη έγκυρη ημερομηνία — το event θα αποθηκευτεί χωρίς λήξη.");
    }
  }

  // Δημιουργία νέου entry στο Firebase
  const ts = Date.now();
const newRef = ref(db, "v3/pulse/" + ts);
await set(newRef, { id: ts, type, title, desc, votes: 0, expiresAt });



  convoAlert(`✅ Προστέθηκε το post: “${title}” στο Convo Pulse!`);
}



function renderPulseItems(items = pulseItemsDefault, pinnedMap = {}) {
  const slot = ensurePulseSlot();
  if (!slot) return;
  const content = slot.querySelector(".convo-pulse-content");
  if (!content) return;

  // 🔝 Sort: pinned πρώτα
  const pinnedIds = Object.keys(pinnedMap);
  const sorted = [
    ...items.filter((x) => pinnedIds.includes(String(x.id || x.title))),
    ...items.filter((x) => !pinnedIds.includes(String(x.id || x.title))),
  ];

  const html = sorted
  .map((it) => {
    const id = it.id || it.title;
    const pinned = pinnedMap[id];
    const glow = pinned
      ? "box-shadow:0 0 12px rgba(255,255,120,0.3);border:1px solid rgba(255,255,120,0.4);"
      : "border:1px solid rgba(255,255,255,0.05);";
    const typeLabel =
  it.type === "news" ? "NEWS" :
  it.type === "smoothie" ? "SMOOTHIE" :
  it.type === "idea" ? "IDEA" :
  it.type === "event" ? "EVENT" : "POST";

const typeBadge = `<span class="pulse-type-badge pulse-${it.type || "post"}">${typeLabel}</span>`;

    const desc = it.desc
      ? `<div class='pulse-desc'>${escapeHtml(it.desc).slice(0, 90)}${it.desc.length > 90 ? "…" : ""}</div>`
      : "";

    return `
      <div class="pulse-row pulse-type-${it.type}" data-id="${id}" style="${glow}">
        <div class="pulse-main">
          <div class="pulse-title">
  ${typeBadge}
  ${escapeHtml(it.title)}${pinned ? " 📍" : ""}
</div>

          ${desc}
        </div>
        <button class="pulse-open-btn" data-title="${it.title}">open</button>
      </div>`;
  })
  .join("");

  content.innerHTML = html;
  if (typeof initPulseReactions === "function") initPulseReactions();

  content.querySelectorAll(".pulse-open-btn").forEach((b) => {
  b.addEventListener("click", () => {
    const title = b.dataset.title;
    const item = pulseItemsLive.find((x) => x.title === title) || {};
    showPulseModal(item);
  });
});

// ✅ Προσθέτεις εδώ το vote block
content.querySelectorAll(".pulse-vote-btn").forEach((b) => {
  b.addEventListener("click", async () => {
    const title = b.dataset.title;
    const ok = await convoConfirm(`Ψηφίζεις αυτό το θέμα; ${title}`);
    if (!ok) return;
    convoAlert(`✅ Ψήφισες: ${title} (demo)`);
    window.dispatchEvent(new CustomEvent("convoPulseVote", { detail: { title } }));
  });
});
}



  

// ============================================================================
// 🪩 Convo Pulse — Open Modal View
// ============================================================================
function showPulseModal(item) {
  // Αν υπάρχει ήδη modal → καθάρισε το παλιό
  document.querySelector("#pulseModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "pulseModal";
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  const box = document.createElement("div");
  box.className = "pulse-modal-box";
  box.style.cssText = `
    background: rgba(30,30,40,0.95);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 20px 24px;
    color: #fff;
    width: 360px;
    max-width: 90%;
    box-shadow: 0 0 18px rgba(0,0,0,0.4);
    animation: fadeIn 0.25s ease;
  `;

  const typeIcon =
    item.type === "news" ? "📰" :
    item.type === "smoothie" ? "🍓" :
    item.type === "idea" ? "💡" : "🎁";

  const d = item.expiresAt ? new Date(item.expiresAt) : null;
  const dateInfo = d
    ? `<div style="font-size:13px;opacity:.8;margin-top:4px;">📅 ${
        Date.now() > d ? `Expired ${d.toLocaleDateString()}` : `Until ${d.toLocaleDateString()}`
      }</div>`
    : "";
const updatedInfo = item.updatedAt
  ? `<div style="font-size:12px;opacity:.6;margin-top:4px;">🕓 Updated ${new Date(item.updatedAt).toLocaleString()}</div>`
  : "";

  box.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <div style="font-size:22px;">${typeIcon}</div>
    <button id="pulseCloseBtn" style="background:none;border:0;color:#9be7ff;font-size:18px;cursor:pointer;">✖</button>
  </div>
  <div style="font-weight:700;font-size:18px;line-height:1.2;margin-bottom:6px;">${item.title}</div>
  <div style="font-size:14px;opacity:.85;">${item.desc || "— Δεν υπάρχει περιγραφή —"}</div>
${dateInfo}
${updatedInfo}


  ${
    (window.currentUser?.displayName === "MysteryMan")
  ? `<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
       <button id="pulseEditBtn"
         style="padding:6px 10px;border-radius:6px;border:0;
         background:rgba(155,231,255,0.15);color:#9be7ff;cursor:pointer;">
         ✏️ Edit
       </button>
       <button id="pulseDeleteBtn"
         style="padding:6px 10px;border-radius:6px;border:0;
         background:rgba(255,70,70,0.15);color:#ff6666;cursor:pointer;">
         🗑 Delete
       </button>
              <button id="pulsePinBtn"
         style="padding:6px 10px;border-radius:6px;border:0;
         background:rgba(255,230,100,0.15);color:#ffe676;cursor:pointer;">
         📌 Pin Post
       </button>

     </div>`
     
  : ""

  }
`;


  modal.appendChild(box);
  document.body.appendChild(modal);

  // Κλείσιμο
    // 🗑️ Διαγραφή post (μόνο για MysteryMan)
  // ✏️ Επεξεργασία post (μόνο για MysteryMan)
// 🗑️ Διαγραφή post (μόνο για MysteryMan)
const delBtn = document.getElementById("pulseDeleteBtn");
if (delBtn) {
  delBtn.onclick = async () => {
    const ok = await convoConfirm(`🗑 Να διαγραφεί οριστικά το post:<br><strong>${item.title}</strong>;`);
    if (!ok) return;

    const pulseId = item.id || item.key || item.timestamp || item.title;
    if (!pulseId) {
      convoAlert("⚠️ Δεν βρέθηκε έγκυρο ID για διαγραφή.");
      return;
    }

    // 1️⃣ Σβήσε το ίδιο το post
    await remove(ref(db, "v3/pulse/" + pulseId)).catch(console.error);

    // 2️⃣ Σβήσε και τα reactions του
    await remove(ref(db, "v3/pulseReactions/" + pulseId)).catch(() => {});

    // 3️⃣ Ενημέρωσε την τοπική λίστα και ανανέωσε UI
    pulseItemsLive = pulseItemsLive.filter((x) => {
      const idOrTitle = x.id || x.key || x.timestamp || x.title;
      return idOrTitle !== pulseId;
    });
renderPulseItems(pulseItemsLive.length ? pulseItemsLive : pulseItemsDefault, pinnedMapLive);

    // 4️⃣ Κλείσε το modal
    modal.remove();
    convoAlert("✅ Το post διαγράφηκε!");
  };
}

// 🧭 Ρύθμιση αρχικής κατάστασης του κουμπιού (Pin / Unpin)
const pulseId = item.id || item.key || item.timestamp || item.title;
if (pulseId && pinnedMapLive && pinnedMapLive[pulseId]) {
  const btn = document.getElementById("pulsePinBtn");
  if (btn) btn.innerText = "📍 Unpin";
}

// 📌 Pin / Unpin post (μόνο για MysteryMan)
const pinBtn = document.getElementById("pulsePinBtn");
if (pinBtn) {
  pinBtn.onclick = async () => {
    const pulseId = item.id || item.key || item.timestamp || item.title;
    if (!pulseId) {
      convoAlert("⚠️ Δεν βρέθηκε έγκυρο ID για pin.");
      return;
    }


    const pinRef = ref(db, "v3/pulsePinned/" + pulseId);
    const snap = await get(pinRef);
    const isPinned = snap.exists();

    if (isPinned) {
  await remove(pinRef);
  convoAlert("📍 Το post ξεκαρφιτσώθηκε!");
  pinBtn.innerText = "📌 Pin Post";

  // ⚡ Άμεση ενημέρωση UI
  pinnedMapLive[pulseId] = undefined;
  renderPulseItems(pulseItemsLive, pinnedMapLive);
} else {
  await set(pinRef, true);
  convoAlert("📍 Το post καρφιτσώθηκε στη κορυφή!");
  pinBtn.innerText = "📍 Unpin";

  // ⚡ Άμεση ενημέρωση UI
  pinnedMapLive[pulseId] = true;
  renderPulseItems(pulseItemsLive, pinnedMapLive);
}
  };
}

  
  document.getElementById("pulseCloseBtn").onclick = () => modal.remove();
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
    });
} // ✅ κλείνει τη showPulseModal

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, function (m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
  });
}

// ============================================================================
// 🧩 Render List
// ============================================================================
function renderRooms() {
  if (!roomsListEl) return;
  const html = Array.from(roomsMap.entries())
    .map(
      ([roomId, name]) => `
      <li class="room-item ${currentRoom === roomId ? "active" : ""}" data-room="${roomId}">
        #${name}
      </li>`
    )
    .join("");

  roomsListEl.innerHTML = html;

  // Ensure Pulse slot exists and render items under rooms
ensurePulseSlot();

// ✅ Αν έχουμε live entries, δείξε αυτά — αλλιώς fallback
if (pulseItemsLive && pulseItemsLive.length > 0) {
  renderPulseItems(pulseItemsLive, pinnedMapLive);
} else {
  renderPulseItems(pulseItemsDefault);
}


  roomsListEl.querySelectorAll(".room-item").forEach((item) => {
    item.addEventListener("click", () => {
      const roomId = item.dataset.room;
      if (!window.currentPrivateChatId && roomId === currentRoom) return;

      currentRoom = roomId;
      window.currentPrivateChatId = null; // ✅ βγαίνουμε σίγουρα από private
      localStorage.setItem("lastRoom", currentRoom);
      renderRooms();

      // --- Καθάρισε το input όταν αλλάζεις room ---
      const msgInput = document.getElementById("messageInput");
      if (msgInput) {
        msgInput.value = "";
        msgInput.style.height = "40px";
      }

      // --- Εμφάνισε το main chat container και κρύψε το private ---
      const mainChat = document.getElementById("chatMessages");
      const privateChat = document.getElementById("privateChat");
      if (mainChat && privateChat) {
        mainChat.classList.remove("hidden");
        privateChat.classList.add("hidden");
      }

      loadRoomMessages(roomId);
      window.dispatchEvent(new Event("roomChanged"));

      console.log("🟢 Room changed:", roomId);
    });
  });
}

// ============================================================================
// ⚙️ Create / Delete Buttons
// ============================================================================
createBtn?.addEventListener("click", async () => {
  // 🧩 Convo-style prompt για νέο room
  const name = await convoPrompt("🆕 Δώσε όνομα για το νέο δωμάτιο:");
  if (!name) return;

  const roomId = name.trim().toLowerCase().replace(/\s+/g, "-");
  await set(ref(db, "v3/rooms/" + roomId), { name, createdAt: Date.now() });

  convoAlert(`✅ Το δωμάτιο "${name}" δημιουργήθηκε!`);
  console.log("✅ Room created:", roomId);
});

// ============================================================================
// 🗑️ DELETE ROOM — Fully Functional Custom Modal
// ============================================================================
deleteBtn?.addEventListener("click", async () => {
  const rooms = Array.from(roomsMap.entries());
  if (!rooms.length) {
    convoAlert("⚠️ Δεν υπάρχουν διαθέσιμα δωμάτια!");
    return;
  }

  // Δημιουργία overlay
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.6);
    display:flex;align-items:center;justify-content:center;z-index:9999;
  `;

  // Modal περιεχόμενο
  const modal = document.createElement("div");
  modal.style.cssText = `
    background:var(--panel-bg,rgba(30,30,40,0.95));
    border-radius:10px;padding:16px 20px;min-width:260px;
    box-shadow:0 0 15px rgba(0,0,0,0.4);color:#fff;
  `;
  modal.innerHTML = `
    <div style="margin-bottom:8px;">Επίλεξε το δωμάτιο που θες να διαγράψεις:</div>
    <ul class="room-select-list" style="list-style:none;margin:0;padding:0;">
      ${rooms
        .map(
          ([id, name]) =>
            `<li data-id="${id}" class="room-select-item"
              style="padding:6px 10px;margin:4px 0;border-radius:6px;
              background:rgba(255,255,255,0.05);cursor:pointer;transition:0.2s;">
              #${name}
            </li>`
        )
        .join("")}
    </ul>
    <div style="text-align:right;margin-top:12px;">
      <button id="roomCancel" style="padding:6px 14px;">Άκυρο</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  let selectedId = null;

  // Hover/Select εφέ
  modal.querySelectorAll(".room-select-item").forEach((el) => {
    el.addEventListener("mouseenter", () => (el.style.background = "rgba(255,255,255,0.1)"));
    el.addEventListener("mouseleave", () => {
      if (selectedId !== el.dataset.id) el.style.background = "rgba(255,255,255,0.05)";
    });
    el.addEventListener("click", async () => {
      selectedId = el.dataset.id;
      modal.querySelectorAll(".room-select-item").forEach((i) => (i.style.background = "rgba(255,255,255,0.05)"));
      el.style.background = "rgba(255,255,255,0.2)";

      // 🚫 Προστασία general
      if (selectedId === "general") {
        convoAlert("⚠️ Δεν μπορείς να διαγράψεις το κύριο δωμάτιο #general!");
        overlay.remove();
        return;
      }

      const ok = await convoConfirm(`Να διαγραφεί το δωμάτιο "${selectedId}";`);
      if (ok) {
        await remove(ref(db, "v3/rooms/" + selectedId));
        await remove(ref(db, "v3/messages/" + selectedId));
        convoAlert(`🗑 Το δωμάτιο "${selectedId}" διαγράφηκε επιτυχώς!`);
        console.log("✅ Room deleted:", selectedId);
      }
      overlay.remove();
    });
  });

  // Άκυρο
  modal.querySelector("#roomCancel").addEventListener("click", () => overlay.remove());
});

// ============================================================================
// 🏁 Initial Load — Wait for userReady
// ============================================================================
window.addEventListener("userReady", async () => {
  console.log("✅ userReady received → initializing Rooms panel...");

  const snap = await get(roomsRef);

  // Αν δεν υπάρχει καθόλου /rooms → δημιούργησε το general
  if (!snap.exists()) {
    await set(ref(db, "v3/rooms/general"), { name: "general", createdAt: Date.now() });
    roomsMap.set("general", "general");
  } else {
    const data = snap.val() || {};
    Object.entries(data).forEach(([id, val]) => {
      roomsMap.set(id, val?.name || id);
    });
  }

  const savedRoom = localStorage.getItem("lastRoom");

  // ✅ Εξασφάλιση ότι το #general είναι ορατό στη λίστα
  if (!roomsMap.has("general")) {
    roomsMap.set("general", "general");
  }

  // ✅ Τώρα κάνε render ΜΟΝΟ αφού έχει σίγουρα room
  renderRooms();

  if (savedRoom && roomsMap.has(savedRoom)) {
    currentRoom = savedRoom;
    renderRooms();
    loadRoomMessages(savedRoom);
    console.log("🔄 Restored last room:", savedRoom);
  } else {
    loadRoomMessages(currentRoom); // fallback to general
  }

  // Ensure Pulse slot & initial render (on startup)
  ensurePulseSlot();

  // ✅ Αν υπάρχουν live items από Firebase, δείξε τα — αλλιώς fallback
  if (pulseItemsLive && pulseItemsLive.length > 0) {
    renderPulseItems(pulseItemsLive, pinnedMapLive);
  } else {
    renderPulseItems(pulseItemsDefault);
  }

  console.log("🏠 Rooms panel initialized (after userReady)");
});

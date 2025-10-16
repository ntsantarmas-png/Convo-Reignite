// ============================================================================
// 🏠 Rooms Panel — Realtime Sync (Part E)
// ============================================================================
import { db } from "./firebaseInit.js";
import {
  ref,
  onChildAdded,
  onChildRemoved,
  get,
  set,
  remove,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { loadRoomMessages } from "./chatMessages.js";

// === DOM refs ===
const roomsListEl = document.getElementById("roomsList");
const createBtn = document.getElementById("createRoomBtn");
const deleteBtn = document.getElementById("deleteRoomBtn");

let currentRoom = "general";
const roomsMap = new Map(); // αποθήκευση room ids & ονόματα

// ============================================================================
// 🔄 Realtime Listeners
// ============================================================================
const roomsRef = ref(db, "v3/rooms");

// Προσθήκη νέου room
onChildAdded(roomsRef, (snap) => {
  const roomId = snap.key;
  const val = snap.val();
  roomsMap.set(roomId, val?.name || roomId);
  renderRooms();
});

// Αφαίρεση room
onChildRemoved(roomsRef, (snap) => {
  roomsMap.delete(snap.key);
  renderRooms();
});

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

  roomsListEl.querySelectorAll(".room-item").forEach((item) => {
    item.addEventListener("click", () => {
      
      const roomId = item.dataset.room;
      if (roomId === currentRoom) return;

     currentRoom = roomId;
  localStorage.setItem("lastRoom", currentRoom);  // 🧩 αποθήκευση
  renderRooms();                                   // ανανέωση εμφάνισης
  loadRoomMessages(roomId);                        // φόρτωση μηνυμάτων
  console.log("🟢 Room changed:", roomId);
});
  });
}

// ============================================================================
// ⚙️ Create / Delete Buttons
// ============================================================================
createBtn?.addEventListener("click", async () => {
  const name = prompt("🆕 Enter room name:");
  if (!name) return;
  const roomId = name.trim().toLowerCase().replace(/\s+/g, "-");
  await set(ref(db, "v3/rooms/" + roomId), { name, createdAt: Date.now() });
  console.log("✅ Room created:", roomId);
});

deleteBtn?.addEventListener("click", async () => {
  const roomId = prompt("🗑 Enter room ID to delete:");
  if (!roomId) return;
  if (!confirm(`⚠️ Delete room "${roomId}" and its messages?`)) return;
  await remove(ref(db, "v3/rooms/" + roomId));
  await remove(ref(db, "v3/messages/" + roomId));
  console.log("✅ Room deleted:", roomId);
});

// ============================================================================
// 🏁 Initial Load
// ============================================================================
(async () => {
  const snap = await get(roomsRef);
  if (!snap.exists()) {
    await set(ref(db, "v3/rooms/general"), { name: "general", createdAt: Date.now() });
  }
  renderRooms();
  const savedRoom = localStorage.getItem("lastRoom");
if (savedRoom && roomsMap.has(savedRoom)) {
  currentRoom = savedRoom;
  renderRooms();
  loadRoomMessages(savedRoom);
  console.log("🔄 Restored last room:", savedRoom);
} else {
  loadRoomMessages(currentRoom); // fallback to general
}

  console.log("🏠 Rooms panel initialized (Realtime sync)");
})();

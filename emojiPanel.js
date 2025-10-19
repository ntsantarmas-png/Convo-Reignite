// ===================== Emoji Panel — Step 4.2 (Giphy Integrated) =====================
import { auth, db } from "../firebaseInit.js";
import { fetchTrending, searchGiphy } from "./giphy.js";

import { ref, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

let emojiPanel, emojiBtn, tabs, tabContents;
let gifsGrid, stickersGrid, gifSearchInput, stickerSearchInput;
let giphyDebounce;

// === Τυχαία emoji για το Convo Trail ===
const trailEmojis = ["😀", "😂", "😍", "😎", "🥳", "🤩", "🫶", "🔥", "💫", "🌈", "💖", "😺", "🤖", "👻"];

// === Αρχικοποίηση πάνελ ===
export function initEmojiPanel() {
  emojiPanel = document.getElementById("emojiPanel");
  emojiBtn = document.getElementById("emojiBtn");
  tabs = document.querySelectorAll(".emoji-tabs .tab-btn");
  tabContents = document.querySelectorAll(".tab-content");
  gifsGrid = document.querySelector(".gif-grid");
  stickersGrid = document.querySelector(".sticker-grid");
  gifSearchInput = document.querySelector("#gifsTab .giphy-search");
  stickerSearchInput = document.querySelector("#stickersTab .giphy-search");

  if (!emojiPanel || !emojiBtn) return;

  // === Άνοιγμα / Κλείσιμο ===
  emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = emojiPanel.classList.contains("visible");
    if (isVisible) {
      closeEmojiPanel();
    } else {
      openEmojiPanel();
    }
  });

  // === Κλείσιμο με click έξω ===
  document.addEventListener("click", (e) => {
    if (
      emojiPanel.classList.contains("visible") &&
      !emojiPanel.contains(e.target) &&
      e.target !== emojiBtn
    ) {
      closeEmojiPanel();
    }
  });

  // === Κλείσιμο με ESC ===
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && emojiPanel.classList.contains("visible")) {
      closeEmojiPanel();
    }
  });

  // === Εναλλαγή Tabs ===
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      tabContents.forEach((tab) => {
        tab.classList.toggle("active", tab.id === target + "Tab");
      });
    });
  });

  // === Giphy Trending φόρτωση στην αρχή ===
  loadGiphyTrending("gifs");
  loadGiphyTrending("stickers");

  // === Search με debounce ===
  gifSearchInput.addEventListener("input", (e) => {
    clearTimeout(giphyDebounce);
    giphyDebounce = setTimeout(() => loadGiphySearch("gifs", e.target.value), 300);
  });

  stickerSearchInput.addEventListener("input", (e) => {
    clearTimeout(giphyDebounce);
    giphyDebounce = setTimeout(() => loadGiphySearch("stickers", e.target.value), 300);
  });
}

// === Άνοιγμα πάνελ με trail effect ===
function openEmojiPanel() {
  emojiPanel.classList.remove("hidden");
  setTimeout(() => emojiPanel.classList.add("visible"), 10);
  spawnEmojiTrail();
  enableEmojiClicks();
}

// === Κλείσιμο πάνελ ===
function closeEmojiPanel() {
  emojiPanel.classList.remove("visible");
  setTimeout(() => emojiPanel.classList.add("hidden"), 150);
}

// === Τυχαίο Convo Trail ===
function spawnEmojiTrail() {
  const count = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const emoji = document.createElement("div");
    emoji.textContent =
      trailEmojis[Math.floor(Math.random() * trailEmojis.length)];
    emoji.className = "emoji-float";

    const panelRect = emojiPanel.getBoundingClientRect();
    emoji.style.left = `${panelRect.left + 30 + Math.random() * 380}px`;
    emoji.style.top = `${panelRect.top + 280 + Math.random() * 40}px`;

    document.body.appendChild(emoji);

    const anim = emoji.animate(
      [
        { transform: "translateY(0) scale(1)", opacity: 1 },
        { transform: "translateY(-100px) scale(1.4)", opacity: 0 },
      ],
      { duration: 600 + Math.random() * 200, easing: "ease-out" }
    );

    anim.onfinish = () => emoji.remove();
  }
}

// === Click στα emoji ===
function insertEmojiToInput(emoji) {
  const input = document.getElementById("messageInput");
  if (!input) return;

  const start = input.selectionStart;
  const end = input.selectionEnd;
  const text = input.value;
  input.value = text.slice(0, start) + emoji + text.slice(end);
  input.selectionStart = input.selectionEnd = start + emoji.length;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

// === Add click events on all emoji (once only) ===
function enableEmojiClicks() {
  const emojiSpans = document.querySelectorAll(".emoji-grid span");
  emojiSpans.forEach((el) => {
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
  });
  const freshSpans = document.querySelectorAll(".emoji-grid span");
  freshSpans.forEach((el) => {
    el.addEventListener("click", () => insertEmojiToInput(el.textContent));
  });
}

// === Auto close όταν στέλνεις μήνυμα ===
export function closeEmojiPanelOnSend() {
  if (!emojiPanel) emojiPanel = document.getElementById("emojiPanel");
  if (emojiPanel) {
    emojiPanel.classList.remove("visible");
    setTimeout(() => emojiPanel.classList.add("hidden"), 150);
  }
}

// ===================== GIPHY LOADERS =====================
async function loadGiphyTrending(type = "gifs") {
  const grid = type === "gifs" ? gifsGrid : stickersGrid;
  if (!grid) return;
  grid.innerHTML = `<div style="opacity:0.6;text-align:center;">⏳ Loading ${type}...</div>`;
  const items = await fetchTrending(type);
  renderGiphyResults(type, items);
}

async function loadGiphySearch(type = "gifs", query = "") {
  const grid = type === "gifs" ? gifsGrid : stickersGrid;
  if (!grid) return;
  grid.innerHTML = `<div style="opacity:0.6;text-align:center;">🔍 Searching...</div>`;
  const items = await searchGiphy(type, query);
  renderGiphyResults(type, items);
}

function renderGiphyResults(type, items) {
  const grid = type === "gifs" ? gifsGrid : stickersGrid;
  if (!grid) return;
  if (!items.length) {
    grid.innerHTML = `<div style="text-align:center;opacity:0.6;">⚠️ No results</div>`;
    return;
  }

  grid.innerHTML = items
    .map(
      (it) =>
        `<img src="${it.images.fixed_width.url}" alt="${type}" data-url="${it.images.original.url}" class="giphy-item" />`
    )
    .join("");

  grid.querySelectorAll(".giphy-item").forEach((img) => {
    img.addEventListener("click", () => sendGiphyToChat(img.dataset.url, type));
  });
}

// === Στείλε GIF ή Sticker στο chat ===
async function sendGiphyToChat(url, type) {
  const user = auth.currentUser;
  if (!user) return;
  
  const currentRoom = window.currentRoom || localStorage.getItem("lastRoom") || "general";
  const msgRef = ref(db, `v3/messages/${currentRoom}`);

  await push(msgRef, {
    uid: user.uid,
    username: user.displayName || "Guest",
    type,
    gifUrl: url,
    createdAt: serverTimestamp(),
  });

  console.log(`🎞️ Sent ${type} to chat:`, url);

  // ✅ Κλείσε το panel μετά την αποστολή
  closeEmojiPanel();
}

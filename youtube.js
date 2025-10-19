// ===================== YouTube Panel — Step 3.0 (Shared Playback Base) =====================
import { auth, db } from "./firebaseInit.js";
import {
  onChildAdded,
  ref,
  off,
  set,
  push,
  get,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";


let youtubePanel, youtubeBtn, youtubeContent, closeYoutubeBtn;
let currentVideoId = null;
let messagesRef = null;
let lastHandledMsgId = null; // 🧠 αποφυγή διπλών YouTube αναπαραγωγών


export function initYouTubePanel() {
  youtubePanel = document.getElementById("youtubePanel");
  youtubeBtn = document.getElementById("youtubeBtn");
  youtubeContent = document.getElementById("youtubeContent");
  closeYoutubeBtn = document.getElementById("closeYoutubeBtn");

  // === Εμφάνιση κουμπιού για συνδεδεμένους ===
  auth.onAuthStateChanged((user) => {
  if (user) {
    youtubeBtn.classList.remove("hidden");
    // ❌ μην ξεκινάς listener εδώ — θα ξεκινήσει όταν αλλάξει room
  } else {
    youtubeBtn.classList.add("hidden");
    youtubePanel.classList.add("hidden");
  }
});


  // === Κουμπί YouTube Panel ===
  youtubeBtn?.addEventListener("click", () => {
    youtubePanel.classList.toggle("hidden");
  });

  closeYoutubeBtn?.addEventListener("click", () => {
    youtubePanel.classList.add("hidden");
    stopVideo();
  });

  // === Όταν αλλάζει το room ===
  window.addEventListener("roomChanged", (e) => {
  console.log("🎧 YouTube listener switching to room:", e.detail.roomId);
  startWatchingMessages(e.detail.roomId);
});

// ✅ Auto-start on default room
startWatchingMessages("general");
}

// ===================== Ανίχνευση YouTube Links =====================
function startWatchingMessages(roomId) {
  // 🧹 Καθάρισε οποιονδήποτε προηγούμενο listener υπάρχει
  if (messagesRef) {
    off(messagesRef);
    console.log("♻️ Previous YouTube listener cleared");
  }

  // Ετοίμασε το νέο reference
  const activeRoom = roomId || window.currentRoom || "general";
  messagesRef = ref(db, `v3/messages/${activeRoom}`);

  console.log("🎧 Listening for YouTube links in room:", activeRoom);

  // 🧠 Ενεργοποίηση *ενός και μόνο* listener
  onChildAdded(messagesRef, (snap) => {
    const msg = snap.val();
    if (!msg || !msg.text) return;

    // ⏭️ Απόφυγε διπλές επεξεργασίες για το ίδιο μήνυμα
    if (snap.key === lastHandledMsgId) return;
    lastHandledMsgId = snap.key;

    const link = extractYouTubeLink(msg.text);
    if (link) {
      console.log("🎬 Found YouTube link:", link);
      const videoId = extractVideoId(link);
      console.log("🎯 Extracted videoId:", videoId);
      if (videoId && videoId !== currentVideoId) {
        showVideo(videoId);
      }
    }
  });
}


// ===================== Ανάλυση YouTube συνδέσμου =====================
function extractYouTubeLink(text) {
  const ytRegex =
    /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^ \n]+|youtu\.be\/[\w-]+))/i;
  const match = text.match(ytRegex);
  return match ? match[1] : null;
}

function extractVideoId(url) {
  try {
    console.log("🔍 Full incoming URL:", url);

    // ?v=xxxxx
    let match = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
    if (match) {
      console.log("✅ Found via ?v= pattern:", match[1]);
      return match[1];
    }

    // short youtu.be/xxxxx
    match = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (match) {
      console.log("✅ Found via youtu.be:", match[1]);
      return match[1];
    }

    // embed/xxxxx
    match = url.match(/embed\/([A-Za-z0-9_-]{11})/);
    if (match) {
      console.log("✅ Found via embed path:", match[1]);
      return match[1];
    }

    console.warn("⚠️ No valid videoId found in:", url);
    return null;
  } catch (err) {
    console.error("❌ extractVideoId error:", err);
    return null;
  }
}
// ===================== Get YouTube Video Title =====================
async function fetchYouTubeTitle(videoId) {
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    const data = await res.json();
    return data.title || "Άγνωστο τραγούδι";
  } catch (err) {
    console.warn("⚠️ Title fetch failed:", err);
    return "Άγνωστο τραγούδι";
  }
}


// ===================== Εμφάνιση YouTube Player με κουμπί ▶ =====================
async function showVideo(videoId) {
    // 🧠 Αν είναι ήδη το ίδιο video, μην το ξαναφορτώσεις
  if (videoId === currentVideoId) {
    console.log("⏭️ Same video replay prevented:", videoId);
    return;
  }

  if (!videoId) return;
  // 🚫 Αν το chat μόλις έγινε clear, μην γράφεις νέο system μήνυμα
if (window.clearingChat) {
  console.log("🧹 Chat just cleared — skip auto YouTube message");
  return;
}

  currentVideoId = videoId;
  youtubePanel.classList.remove("hidden");

  // 🎬 Εμφάνιση preview με thumbnail + κουμπί "Παίξε"
  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  youtubeContent.innerHTML = `
    <div class="yt-preview" style="position:relative; cursor:pointer;">
      <img src="${thumbnail}" alt="YouTube thumbnail" style="width:100%; border-radius:8px;">
      <button id="playBtn" style="
        position:absolute; top:50%; left:50%;
        transform:translate(-50%,-50%);
        background:rgba(0,0,0,0.6);
        border:none; border-radius:50%;
        width:60px; height:60px;
        font-size:26px; color:white;
        cursor:pointer;
      ">▶</button>
    </div>
  `;

  // 🎵 Όταν πατηθεί το κουμπί "▶", παίζει το βίντεο με ήχο
  const playBtn = document.getElementById("playBtn");
  playBtn.addEventListener("click", () => {
    youtubeContent.innerHTML = `
      <iframe width="100%" height="200"
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allow="autoplay; encrypted-media"
        allowfullscreen>
      </iframe>
    `;
  });

  console.log("🎵 YouTube preview loaded:", videoId);

  // === Ενημέρωση στο Firebase (ίδιο με πριν) ===
  try {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return; // Guests excluded

    const name = user.displayName || "Unknown";
    const room = window.currentRoom || "general";
    // === ΝΕΟ ΣΤΥΛ ΜΗΝΥΜΑΤΟΣ ===
const ytTitle = await fetchYouTubeTitle(videoId);
const shareText = `🎵 ${name} ακούει το τραγούδι “${ytTitle}” — 🎬 Παίξε το κι εσύ!`;
const link = `https://youtu.be/${videoId}`;
// 🧩 Έλεγξε αν υπάρχει ήδη system μήνυμα για το ίδιο video
const checkRef = ref(db, `v3/messages/${room}`);
const existingSnap = await get(checkRef);
let alreadyPosted = false;
existingSnap.forEach((child) => {
  const val = child.val();
  if (val.system && val.text && val.text.includes(videoId)) {
    alreadyPosted = true;
  }
});

if (alreadyPosted) {
  console.log("⏭️ System message for this video already exists — skipping push.");
  return;
}


// 🧠 Αν αυτό το βίντεο υπάρχει ήδη στο Firebase (ίδιο id, ίδιο user), μην ξαναγράψεις μήνυμα
const currentRef = ref(db, "v3/youtube/current");
const snap = await get(currentRef);
if (snap.exists()) {
  const data = snap.val();
  if (data.videoId === videoId && data.by === name) {
    console.log("⏭️ Skip duplicate system message after reload");
    return;
  }
}

await set(ref(db, "v3/youtube/current"), {
  videoId,
  title: ytTitle,
  by: name,
  room,
  createdAt: serverTimestamp(),
});

const msgRef = ref(db, `v3/messages/${room}`);
await push(msgRef, {
  text: shareText.replace("Παίξε το κι εσύ!", `<a href="#" class="yt-play" data-url="${link}">Παίξε το κι εσύ!</a>`),
  system: true,
  createdAt: serverTimestamp(),
});


console.log("📡 Shared YouTube update sent:", ytTitle);
  } catch (err) {
    console.error("❌ Error saving YouTube status:", err);
  }
}
// ===================== Διακοπή βίντεο =====================
function stopVideo() {
  youtubeContent.innerHTML = `<p class="muted">🎵 Κανένα βίντεο – στείλε ένα YouTube link στο chat!</p>`;
  currentVideoId = null;
}
// ===================== Shared Playback (Click-to-Play Event) =====================
window.addEventListener("playYouTubeVideo", (e) => {
  const { url } = e.detail;
  if (!url) return;

  const videoId = extractVideoId(url);
  if (videoId) {
    console.log("🎬 Received shared video click:", videoId);
    showVideo(videoId); // ✅ παίζει το ίδιο βίντεο
  } else {
    console.warn("⚠️ No valid video ID found in shared URL:", url);
  }
});
window.addEventListener("DOMContentLoaded", () => {
  try {
    initYouTubePanel();
    console.log("✅ YouTube panel initialized safely");
  } catch (err) {
    console.error("❌ YouTube init error:", err);
  }
});

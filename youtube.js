// ===================== YouTube Panel — Step 3.0 (Shared Playback Base) =====================
import { auth, db } from "./firebaseInit.js";
import {
  onChildAdded,
  ref,
  off,
  set,
  push,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

let youtubePanel, youtubeBtn, youtubeContent, closeYoutubeBtn;
let currentVideoId = null;
let messagesRef = null;

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
  // καθάρισε προηγούμενο listener
  if (messagesRef) off(messagesRef);

  const activeRoom = roomId || window.currentRoom || "general";
  messagesRef = ref(db, `v3/messages/${activeRoom}`);

  console.log("🎧 Listening for YouTube links in room:", activeRoom);

  onChildAdded(messagesRef, (snap) => {
    const msg = snap.val();
    if (!msg || !msg.text) return;

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

// ===================== Εμφάνιση YouTube Player με κουμπί ▶ =====================
async function showVideo(videoId) {
  if (!videoId) return;
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
    const title = `https://youtu.be/${videoId}`;

    await set(ref(db, "v3/youtube/current"), {
      videoId,
      title,
      by: name,
      room,
      createdAt: serverTimestamp(),
    });

    const msgRef = ref(db, `v3/messages/${room}`);
    await push(msgRef, {
      text: `🎵 ${name} μοιράστηκε: ${title}`,
      system: true,
      createdAt: serverTimestamp(),
    });

    console.log("📡 Shared YouTube update sent:", title);
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
// === Initialize YouTube Panel ===
window.addEventListener("load", () => {
  initYouTubePanel();
});
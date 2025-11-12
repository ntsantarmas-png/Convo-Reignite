// ============================================================================
// 💫 CONVO PULSE — Reactions (Realtime Glow & Polish)
// ============================================================================
function initPulseReactions() {
  const user = window.currentUser || {};
  const userId = user.uid || "guest";
  const db = window.db;
  if (!db) return;

  const { ref, get, set, remove, onValue } = window.firebaseDatabase;

  document.querySelectorAll(".pulse-row").forEach((row) => {
    const postId = row.dataset.id;
    if (!postId) return;
    if (row.querySelector(".pulse-reactions")) return;

    const bar = document.createElement("div");
    bar.className = "pulse-reactions";
    bar.style.cssText = `
      display:inline-flex;
      gap:10px;
      font-size:15px;
      user-select:none;
      margin-top:4px;
      transition:opacity .3s ease;
    `;

    const emojis = ["👍", "💡", "🔥", "💖"];
    emojis.forEach((emoji) => {
      const span = document.createElement("span");
      const sup = document.createElement("sup");
      sup.textContent = "0";
      sup.style.cssText = "font-size:10px;margin-left:2px;opacity:.7;transition:opacity .25s;";
      span.textContent = emoji;
      span.appendChild(sup);
      span.className = "pulse-react";
      span.style.cssText = `
        cursor:pointer;
        opacity:.65;
        transition:transform .2s ease, filter .2s ease, opacity .2s ease, text-shadow .3s ease;
      `;

      // === Hover glow ===
      span.addEventListener("mouseenter", () => {
        span.style.filter = "brightness(1.5)";
        span.style.opacity = "1";
      });
      span.addEventListener("mouseleave", () => {
        if (!span.dataset.active) {
          span.style.filter = "brightness(1)";
          span.style.opacity = ".65";
          span.style.textShadow = "none";
        }
      });

      // === Live count + glow sync ===
      const emojiRef = ref(db, `v3/pulseReactions/${postId}/${emoji}`);
      onValue(emojiRef, (snap) => {
        const data = snap.val() || {};
        const count = Object.keys(data).length;
        sup.textContent = count || "0";
        const active = data[userId];
        if (active) {
          span.dataset.active = "1";
          span.style.filter = "brightness(1.8)";
          span.style.opacity = "1";
          span.style.textShadow = "0 0 8px rgba(155,231,255,0.9)";
        } else {
          span.dataset.active = "";
          span.style.filter = "brightness(1)";
          span.style.opacity = ".65";
          span.style.textShadow = "none";
        }
      });

      // === Click toggle ===
      span.addEventListener("click", async () => {
        if (userId === "guest") {
          window.convoAlert?.("⚠️ Μόνο εγγεγραμμένοι χρήστες μπορούν να αντιδρούν!");
          return;
        }
        const userRef = ref(db, `v3/pulseReactions/${postId}/${emoji}/${userId}`);
        const snap = await get(userRef);
        const isActive = snap.exists();

        // Animation feedback
        span.animate(
          [
            { transform: "scale(1.2)", filter: "brightness(1.9)" },
            { transform: "scale(1)", filter: "brightness(1.2)" },
          ],
          { duration: 280, easing: "ease-out" }
        );

        if (isActive) {
          // 🔻 Unreact glow-fade
          await remove(userRef);
          span.animate([{ opacity: 1 }, { opacity: 0.6 }], {
            duration: 200,
            fill: "forwards",
          });
        } else {
          // ✨ React glow-pulse
          await set(userRef, true);
          span.animate(
            [
              { textShadow: "0 0 0px rgba(155,231,255,0)" },
              { textShadow: "0 0 10px rgba(155,231,255,1)" },
              { textShadow: "0 0 4px rgba(155,231,255,0.6)" },
            ],
            { duration: 450, easing: "ease-in-out" }
          );
        }
      });

      bar.appendChild(span);
    });

    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";
    wrap.appendChild(bar);
    row.parentNode.insertBefore(wrap, row.nextSibling);
  });
}

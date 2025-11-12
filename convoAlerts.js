// ============================================================================
// 💬 CONVO ALERTS SYSTEM (Unified) — v1.0
// Supports HTML, single-instance popup, fade animations
// ============================================================================

export function convoAlert(message) {
  return new Promise((resolve) => {
    openConvoBubble("alert", message, resolve);
  });
}

export function convoConfirm(message) {
  return new Promise((resolve) => {
    openConvoBubble("confirm", message, resolve);
  });
}

export function convoPrompt(message, options = {}) {
  return new Promise((resolve) => {
    openConvoBubble("prompt", message, resolve, options);
  });
}

// ============================================================================
// 🧩 Core Bubble Renderer
// ============================================================================
function openConvoBubble(type, message, resolve, options = {}) {
  // Μην εμφανίσεις δεύτερο παράθυρο αν ήδη υπάρχει
  let overlay = document.getElementById("convoBubbleOverlay");
  if (overlay) overlay.remove();

  overlay = document.createElement("div");
  overlay.id = "convoBubbleOverlay";
  overlay.className = "convo-overlay";
  overlay.innerHTML = `
    <div class="convo-bubble">
      <div id="bubbleContent"></div>
      <div class="bubble-buttons"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const content = overlay.querySelector("#bubbleContent");
  const btns = overlay.querySelector(".bubble-buttons");
  content.innerHTML = message; // ✅ υποστήριξη HTML!

  // === Alert ===
  if (type === "alert") {
    btns.innerHTML = `<button id="bubbleOkBtn" class="btn small">OK</button>`;
    btns.querySelector("#bubbleOkBtn").onclick = () => {
      overlay.remove();
      resolve(true);
    };
  }

  // === Confirm ===
  else if (type === "confirm") {
    btns.innerHTML = `
      <button id="bubbleYesBtn" class="btn small success">Ναι</button>
      <button id="bubbleNoBtn" class="btn small red">Όχι</button>`;
    btns.querySelector("#bubbleYesBtn").onclick = () => {
      overlay.remove();
      resolve(true);
    };
    btns.querySelector("#bubbleNoBtn").onclick = () => {
      overlay.remove();
      resolve(false);
    };
  }

  // === Prompt ===
else if (type === "prompt") {
  content.innerHTML = `
    <div class="prompt-wrapper">
      <p>${message}</p>
      <input id="bubbleInput" class="input small" 
        placeholder="${options.placeholder || 'Πληκτρολόγησε εδώ...'}" 
        value="${options.defaultValue || ''}">
    </div>
  `;
  btns.innerHTML = `
    <button id="bubbleOkBtn" class="btn small success">OK</button>
    <button id="bubbleCancelBtn" class="btn small red">Ακύρο</button>
  `;
  const input = content.querySelector("#bubbleInput");
  btns.querySelector("#bubbleOkBtn").onclick = () => {
    const val = input.value.trim();
    overlay.remove();
    resolve(val || null);
  };
  btns.querySelector("#bubbleCancelBtn").onclick = () => {
    overlay.remove();
    resolve(null);
  };
  setTimeout(() => input.focus(), 50);
}


  // === Κλείσιμο με Esc ===
  document.addEventListener(
    "keydown",
    function escClose(e) {
      if (e.key === "Escape") {
        overlay.remove();
        resolve(type === "confirm" ? false : null);
        document.removeEventListener("keydown", escClose);
      }
    },
    { once: true }
  );

  // === Fade animation ===
  overlay.style.opacity = 0;
  requestAnimationFrame(() => {
    overlay.style.transition = "opacity 0.25s ease";
    overlay.style.opacity = 1;
  });
}
window.convoAlert = convoAlert;
window.convoConfirm = convoConfirm;
window.convoPrompt = convoPrompt;

// ===============================================================
// 🧑‍🎨 Convo — avatarSystem.js (Step 6 — Ring + Tooltip polish)
// Purpose: Generate and render user avatars (URL or initials) with rings & hover info
// ===============================================================

// === Παράδειγμα χρήσης ===
// const html = getUserAvatarHTML({ displayName: "MysteryMan", role: "admin", online: true, avatar: "..." });
// container.innerHTML = html;

export function getUserAvatarHTML(u = {}) {
  const name   = (u.displayName || "Guest").toString();
  const role   = (u.role || "user").toString().toLowerCase();
  const online = (u.state || u.online) === "online" || u.online === true;
  const avatar = u.avatar || "";

  // === Ring classes ===
  let ringClass = "avatar-ring";
  if (role === "admin") ringClass += " ring-admin";
  else if (role === "vip") ringClass += " ring-vip";
  if (online) ringClass += " ring-online";

  // === Tooltip text ===
  const tooltip = `${name} • ${role}${online ? " • online" : " • offline"}`;

  // === Inner avatar (image ή αρχικά) ===
  const initials = name.charAt(0).toUpperCase();
  const inner = avatar
    ? `<img src="${avatar}" alt="${name}" class="convo-avatar" />`
    : `<div class="convo-avatar-default">${initials}</div>`;

  // === Wrapper με ring + title ===
  return `<span class="${ringClass}" title="${tooltip}">${inner}</span>`;
}

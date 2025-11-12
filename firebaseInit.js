// ===================== FIREBASE INIT (v11) =====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

import { firebaseConfig } from "./firebaseConfig.js";

// === Initialize ===
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// ✅ Κάνε τα διαθέσιμα global
window.app = app;
window.auth = auth;
window.db = db;
import * as firebaseDatabase from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
window.firebaseDatabase = firebaseDatabase;

console.log("✅ Firebase initialized");

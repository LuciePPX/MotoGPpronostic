import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Configuration du projet motogppronostic (celui qui fonctionne)
const firebaseConfig = {
    apiKey: "AIzaSyAlWxI_w2R6eyJYBg9h_ynHWAgz3VS51Zk",
    authDomain: "motogppronostic.firebaseapp.com",
    databaseURL: "https://motogppronostic-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "motogppronostic",
    storageBucket: "motogppronostic.firebasestorage.app",
    messagingSenderId: "1093723718276",
    appId: "1:1093723718276:web:51b754c96ceacd589638d1"
};

// ===== INITIALISATION =====
export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
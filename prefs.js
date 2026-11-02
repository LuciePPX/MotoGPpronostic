import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { app, db } from './firebase-init.js';
import { activerNotifications } from './notifications.js';

const TYPES = ["rappel_weekend", "rappel_course", "resume_lundi", "resultats"];

// ===== FONCTION: BRANCHER LE BOUTON 🔔 ET SA FENÊTRE =====
export async function initPreferences(pseudo) {
    const fenetre = document.getElementById('preferences-modal');
    const prefs = (await get(ref(db, `preferences/${pseudo}`))).val() || {};

    // Cases : enregistrées dès qu'elles changent, cochées par défaut
    TYPES.forEach((type) => {
        const caseCochable = document.getElementById(`pref-${type}`);
        if (!caseCochable) return;

        caseCochable.checked = prefs[type] !== false;
        caseCochable.onchange = () => set(ref(db, `preferences/${pseudo}/${type}`), caseCochable.checked);
    });

    // Écouteurs posés une seule fois, même si la fonction est rappelée
    const boutonOuvrir = document.getElementById('btn-notifications');
    if (boutonOuvrir && !boutonOuvrir.dataset.branche) {
        boutonOuvrir.dataset.branche = "1";

        boutonOuvrir.addEventListener('click', () => fenetre.classList.add('active'));
        document.getElementById('close-preferences')
            ?.addEventListener('click', () => fenetre.classList.remove('active'));
        document.getElementById('btn-activer-appareil')
            ?.addEventListener('click', () => activerNotifications(app, db, pseudo));
    }
}
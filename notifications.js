import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Clé publique Web Push, générée dans Firebase > Cloud Messaging
const CLE_VAPID = "BHYVF375ucdXpq-d_mut2AC8T3o1OrEw5JCA4GsE1TrVwywwqlLvQDq2opC909110ytA8xvhIwosS9nQG0pIwbk";

// ===== FONCTION: ACTIVER LES NOTIFICATIONS =====
// Demande l'autorisation, récupère le jeton du téléphone et l'enregistre sous le pseudo
export async function activerNotifications(app, db, pseudo) {
    if (!pseudo) {
        alert("Connecte-toi d'abord avec ton pseudo.");
        return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        alert("Notifications indisponibles. Sur iPhone, ajoute d'abord le site à l'écran d'accueil et ouvre-le depuis cette icône.");
        return;
    }

    const autorisation = await Notification.requestPermission();
    if (autorisation !== "granted") {
        alert("Notifications refusées. Tu peux les réactiver dans les réglages du navigateur.");
        return;
    }

    try {
        const enregistrement = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
        const messaging = getMessaging(app);

        const jeton = await getToken(messaging, {
            vapidKey: CLE_VAPID,
            serviceWorkerRegistration: enregistrement
        });

        if (!jeton) {
            alert("Impossible d'obtenir le jeton de notification.");
            return;
        }

        // Les caractères interdits dans une clé Firebase sont remplacés par _
        const cleBase = pseudo.replace(/[.#$\[\]\/]/g, "_");
        await set(ref(db, `tokens/${cleBase}`), jeton);

        alert("Notifications activées !");
    } catch (e) {
        console.error("Erreur notifications :", e);
        alert("Erreur lors de l'activation des notifications.");
    }
}
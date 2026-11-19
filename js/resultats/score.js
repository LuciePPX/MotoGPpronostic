import { ref, get, query, orderByValue, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from '../coeur/firebase-init.js';
import { etat } from "../coeur/etat.js";

// ===== FUNCTION: LIRE LE SCORE GÉNÉRAL D'UN JOUEUR =====
// Renvoie 0 si le joueur n'a pas encore de score
export async function lireScoreJoueur(pseudo) {
    try {
        const snapshot = await get(ref(db, `scores/${pseudo}`));
        return snapshot.exists() ? snapshot.val() : 0;
    } catch (e) {
        console.error("Erreur lors de la récupération du score :", e);
        return 0;
    }
}

// ===== FUNCTION: AFFICHER LE SCORE GÉNÉRAL DANS L'EN-TÊTE =====
export function afficherScoreGeneral(score) {
    const scoreEl = document.getElementById('main-score-display');
    if (scoreEl) scoreEl.textContent = score;
}

// ===== FUNCTION: TOP 3 EN DIRECT =====
export function chargerTop3() {
    const miniPodium = document.getElementById('mini-podium-list');
    if (!miniPodium) return;

    // Firebase trie en croissant : on prend les 3 derniers, puis on inverse
    const scoresRef = query(ref(db, 'scores'), orderByValue(), limitToLast(3));

    onValue(scoresRef, (snapshot) => {
        if (!snapshot.exists()) {
            miniPodium.innerHTML = "Aucun score pour le moment";
            return;
        }

        const players = [];
        snapshot.forEach((child) => {
            players.push({ pseudo: child.key, score: child.val() });
        });
        players.reverse();

        miniPodium.innerHTML = players.map((p) => `
            <div class="mini-rank-item">
                <span class="player-name">${p.pseudo}</span>
                <span class="player-score">${p.score}</span>
            </div>
        `).join('');
    });
}

// ===== FUNCTION: CHARGER LE SCORE DU JOUEUR =====
export async function chargerScoreUtilisateur() {
    etat.currentScores[etat.pseudo] = await lireScoreJoueur(etat.pseudo);
    afficherScoreGeneral(etat.currentScores[etat.pseudo]);
}

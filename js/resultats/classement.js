import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from '../coeur/firebase-init.js';

// ===== FUNCTION: BOUTON CLASSEMENT ET FERMETURE DES FENÊTRES =====
export function setupModals() {
    // --- MODAL CLASSEMENT ---
    const btnClassement = document.getElementById('btn-ouvrir-classement');
    const modalClassement = document.getElementById('classement-modal');

    if (btnClassement && modalClassement) {
        btnClassement.addEventListener('click', (e) => {
            e.preventDefault();
            modalClassement.classList.add('active');
            chargerClassementGlobal();
        });
    }

    // --- FERMETURE COMMUNE (croix ou clic sur le fond) ---
    document.querySelectorAll('.modal').forEach((modal) => {
        modal.querySelector('.close-modal')?.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
}

// ===== FUNCTION: CHARGER LE CLASSEMENT GLOBAL =====
async function chargerClassementGlobal() {
    const tbody = document.getElementById('classement-tbody');
    const loadingEl = document.getElementById('loading');
    const tableEl = document.getElementById('classement-table');
    const emptyEl = document.getElementById('empty');

    try {
        const snapshot = await get(ref(db, 'scores_details/'));

        if (!snapshot.exists()) {
            loadingEl.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }

        const listeJoueurs = [];

        for (const [pseudo, grandsPrix] of Object.entries(snapshot.val())) {
            let totalSprint = 0;
            let totalRace = 0;

            for (const dataGP of Object.values(grandsPrix)) {
                totalSprint += parseInt(dataGP.sprint?.total) || 0;
                totalRace += parseInt(dataGP.race?.total) || 0;
            }

            listeJoueurs.push({ pseudo, sprint: totalSprint, race: totalRace, total: totalSprint + totalRace });
        }

        listeJoueurs.sort((a, b) => b.total - a.total);

        const medailles = ['🥇', '🥈', '🥉'];
        tbody.innerHTML = listeJoueurs.map((joueur, index) => `
            <tr>
                <td class="rank-col">${medailles[index] || ''} ${index + 1}</td>
                <td class="pseudo-col">${joueur.pseudo}</td>
                <td class="points-col">${joueur.sprint}</td>
                <td class="points-col">${joueur.race}</td>
                <td class="total-col">${joueur.total}</td>
            </tr>
        `).join('');

        loadingEl.style.display = 'none';
        emptyEl.style.display = 'none';
        tableEl.style.display = 'table';
    } catch (e) {
        console.error("Erreur Firebase:", e);
        loadingEl.innerHTML = "❌ Erreur de connexion";
    }
}
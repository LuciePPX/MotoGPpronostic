import { ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from '../coeur/firebase-init.js';
import { DATA_PILOTES } from '../../config.js';
import { etat, getRaceCourante } from '../coeur/etat.js';
import { attachDragListeners } from './glisser.js';
import { genererPilotes, rafraichirPilotesUtilises } from './pilotes.js';
import { demarrerTimer } from './timer.js';
import { canModify } from './courses.js';


// ===== FUNCTION: AFFICHER UN PILOTE DANS UNE ZONE =====
export function afficherPiloteEnZone(pilote, rank) {
    if (rank === 'Chute') {
        return `
            <div class="pilote-card" draggable="true" data-num="${pilote.num}" data-nom="${pilote.nom}">
                💥 Chute<br>
                <strong class="num">${pilote.num}</strong> <span>${pilote.nom}</span>
            </div>
        `;
    }
    return `
        <div class="pilote-card" draggable="true" data-num="${pilote.num}" data-nom="${pilote.nom}">
            <strong class="num">${pilote.num}</strong> <span>${pilote.nom}</span>
        </div>
    `;
}


// ===== FUNCTION: CHARGER LES PRONOSTICS DU JOUEUR DANS LES ZONES =====
export function chargerPronosticsUtilisateur() {
    const rankSprintPositions = ['1er', '2e', '3e'];

    rankSprintPositions.forEach((rank) => {
        const rankClass = rank === '1er' ? 'rank-1' : rank === '2e' ? 'rank-2' : 'rank-3';
        const element = document.querySelector(`#section-sprint .${rankClass}`);
        if (element && etat.sprintPredictions[rank]) {
            const pilote = DATA_PILOTES.find((p) => parseInt(p.num) === etat.sprintPredictions[rank]);
            if (pilote) {
                const contentArea = element.querySelector('.target-area');
                const placeholder = element.querySelector('small');
                if (placeholder) placeholder.style.display = 'none';
                if (contentArea) {
                    contentArea.innerHTML = afficherPiloteEnZone(pilote, rank);
                    const card = contentArea.querySelector('.pilote-card');
                    if (card) attachDragListeners(card);
                }
            }
            if (etat.sprintPredictions['1er']) etat.sprintValide = true;
            if (etat.racePredictions['1er']) etat.raceValide = true;
        }
    });

    rankSprintPositions.forEach((rank) => {
        const rankClass = rank === '1er' ? 'rank-1' : rank === '2e' ? 'rank-2' : 'rank-3';
        const element = document.querySelector(`#section-race .${rankClass}`);
        if (element && etat.racePredictions[rank]) {
            const pilote = DATA_PILOTES.find((p) => parseInt(p.num) === etat.racePredictions[rank]);
            if (pilote) {
                const contentArea = element.querySelector('.target-area');
                const placeholder = element.querySelector('small');
                if (placeholder) placeholder.style.display = 'none';
                if (contentArea) {
                    contentArea.innerHTML = afficherPiloteEnZone(pilote, rank);
                    const card = contentArea.querySelector('.pilote-card');
                    if (card) attachDragListeners(card);
                }
            }
        }
    });

    // Pari chute : sprint
    const sprintCrash = document.querySelector('#section-sprint .crash-zone');
    if (sprintCrash && etat.sprintPredictions['Chute']) {
        const pilote = DATA_PILOTES.find((p) => parseInt(p.num) === etat.sprintPredictions['Chute']);
        if (pilote) {
            sprintCrash.innerHTML = afficherPiloteEnZone(pilote, 'Chute');
            attachDragListeners(sprintCrash.querySelector('.pilote-card'));
            sprintCrash.classList.add('used-crash');
        }
    }

    // Pari chute : course
    const raceCrash = document.querySelector('#section-race .crash-zone');
    if (raceCrash && etat.racePredictions['Chute']) {
        const pilote = DATA_PILOTES.find((p) => parseInt(p.num) === etat.racePredictions['Chute']);
        if (pilote) {
            raceCrash.innerHTML = afficherPiloteEnZone(pilote, 'Chute');
            attachDragListeners(raceCrash.querySelector('.pilote-card'));
            raceCrash.classList.add('used-crash');
        }
    }

    afficherRecap('sprint');
    afficherRecap('race');
    updateSectionsVisibility();
}


// ===== FUNCTION: RÉCAPITULATIF DE MES PRONOSTICS =====
export function afficherRecap(type) {
    const recapEl = document.getElementById(`recap-${type}`);
    const btnContainer = document.getElementById(`btn-edit-${type}-container`);
    const predictions = type === 'sprint' ? etat.sprintPredictions : etat.racePredictions;
    const btnValider = document.getElementById(`btn-valider-${type}`);

    if (recapEl) {
        if (predictions && predictions['1er']) {
            const p1 = DATA_PILOTES.find(p => parseInt(p.num) === predictions['1er']);
            const p2 = DATA_PILOTES.find(p => parseInt(p.num) === predictions['2e']);
            const p3 = DATA_PILOTES.find(p => parseInt(p.num) === predictions['3e']);
            const pChute = DATA_PILOTES.find(p => parseInt(p.num) === predictions['Chute']);
            recapEl.innerHTML = `
                <div>🥇 ${p1 ? p1.nom : 'TBD'}</div>
                <div>🥈 ${p2 ? p2.nom : 'TBD'}</div>
                <div>🥉 ${p3 ? p3.nom : 'TBD'}</div>
                <div class="recap-item recap-chute">💥 Chute: ${pChute ? pChute.nom : 'Aucun'}</div>
            `;
        } else {
            recapEl.innerHTML = 'Pas encore validé';
        }
    }

    if (btnValider) {
        if (predictions && predictions['1er']) {
            btnValider.disabled = !canModify(type);
            btnValider.textContent = canModify(type) ? `Valider le ${type === 'sprint' ? 'Sprint' : 'Grand Prix'}` : 'Validé';
        } else {
            btnValider.disabled = false;
            btnValider.textContent = `Valider le ${type === 'sprint' ? 'Sprint' : 'Grand Prix'}`;
        }
    }

    if (btnContainer) {
        if (predictions && predictions['1er'] && canModify(type)) {
            btnContainer.innerHTML = `<button class="btn-modifier" id="btn-edit-${type}">Modifier</button>`;
            document.getElementById(`btn-edit-${type}`).addEventListener('click', () => editerPronostic(type));
        } else {
            btnContainer.innerHTML = '';
        }
    }
}


// ===== FUNCTION: MODIFIER UN PRONOSTIC (avant le départ) =====
function editerPronostic(type) {
    const path = getPronosticPath(type);
    if (!path) return;

    if (type === 'sprint') {
        etat.sprintPredictions = {};
        etat.sprintValide = false;
    } else {
        etat.racePredictions = {};
        etat.raceValide = false;
    }

    set(ref(db, path), null);
    genererPilotes();

    const section = document.getElementById(`section-${type}`);
    if (section) {
        section.querySelectorAll('.target-area, .crash-zone').forEach(zone => {
            zone.innerHTML = '';
            zone.classList.remove('used-crash');
            if (!zone.classList.contains('crash-zone')) zone.style.background = '';
        });
    }

    afficherRecap(type);
    updateSectionsVisibility();
    demarrerTimer('sprint', 'section-sprint');
    demarrerTimer('race', 'section-race');
    mettreAJourAffichagePronostics();
}


// ===== FUNCTION: CHEMIN FIREBASE DU PRONOSTIC COURANT =====
export function getPronosticPath(type) {
    const raceCourante = getRaceCourante();
    if (!raceCourante) return null;

    const raceKey = raceCourante.gp.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
    return `pronostics/${etat.pseudo}/${raceKey}/${type}`;
}


// ===== FUNCTION: CACHER LA ZONE DE PRONOSTICS QUAND LES DEUX SONT VALIDÉS =====
export function mettreAJourAffichagePronostics() {
    const pilotesColumn = document.querySelector('.pilotes-column');
    const podiumColumn = document.querySelector('.podium-column');
    if (!pilotesColumn) return;

    const masquer = etat.sprintValide && etat.raceValide;
    pilotesColumn.style.display = masquer ? 'none' : 'flex';
    if (podiumColumn) podiumColumn.style.display = masquer ? 'none' : 'flex';
}


// ===== FUNCTION: AFFICHER LA SESSION À PRONOSTIQUER =====
export function updateSectionsVisibility() {
    const sectionSprint = document.getElementById('section-sprint');
    const sectionRace = document.getElementById('section-race');
    const title = document.getElementById('current-title');

    const sprintComplete = etat.sprintPredictions['1er'] && etat.sprintPredictions['2e'] && etat.sprintPredictions['3e'] && etat.sprintPredictions['Chute'];

    if (sprintComplete || !canModify('sprint')) {
        sectionSprint?.classList.add('hidden');
        sectionRace?.classList.remove('hidden');
        if (title) title.textContent = 'Choisissez pour le GRAND PRIX';
    } else {
        sectionSprint?.classList.remove('hidden');
        sectionRace?.classList.add('hidden');
        if (title) title.textContent = 'Choisissez pour le SPRINT';
    }

    rafraichirPilotesUtilises();
}


// ===== FUNCTION: VALIDER ET ENREGISTRER UN PRONOSTIC =====
export function validerPronostic(type) {
    const predictions = type === 'sprint' ? etat.sprintPredictions : etat.racePredictions;

    if (!predictions['1er'] || !predictions['2e'] || !predictions['3e'] || !predictions['Chute']) {
        alert('Veuillez compléter le podium ET le pari chute avant de valider');
        return;
    }

    const path = getPronosticPath(type);
    if (!path) return;

    set(ref(db, path), predictions).then(() => {
        alert(`✅ Vos pronostics ${type.toUpperCase()} ont été sauvegardés!`);

        if (type === 'sprint') etat.sprintValide = true;
        if (type === 'race') etat.raceValide = true;

        mettreAJourAffichagePronostics();
        afficherRecap(type);
        updateSectionsVisibility();

        demarrerTimer('sprint', 'section-sprint');
        demarrerTimer('race', 'section-race');
    });
}
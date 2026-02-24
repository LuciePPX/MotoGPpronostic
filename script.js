import { DATA_PILOTES, DATA_CALENDRIER } from './config.js';

// ===== FIREBASE SDK IMPORTS =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
    apiKey: "AIzaSyBYjWjsY5eHOjrQOD2nJhXh0lZuQLwM6YQ",
    authDomain: "motogp-pronostic.firebaseapp.com",
    databaseURL: "https://motogppronostic-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "motogp-pronostic",
    storageBucket: "motogp-pronostic.appspot.com",
    messagingSenderId: "1082916850330",
    appId: "1:1082916850330:web:dbf5d1c7d8e47d86f01b75"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== GLOBAL STATE =====
let pseudo = '';
let sprintPredictions = {};
let racePredictions = {};
let sprintResults = {};
let raceResults = {};
let currentScores = {};
let scoresHistory = {};
let pilotesUtilises = [];
let pseudoGlobal = "";
let currentRaceTime = null;
let isEditingMode = false;
let editingType = null;
let currentRaceIndex = 0; // Index de la course actuelle dans le calendrier
let timerIntervals = {}; // Stockage des intervalles de timer
let firebaseListeners = {}; // Stockage des écouteurs Firebase
let sprintValide = false;
let raceValide = false;
// ===== ÉCRAN D'AUTH =====
document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('login-screen');
    const gameContainer = document.getElementById('game-screen');
    const pseudoInput = document.getElementById('pseudo-input');
    const btnValider = document.getElementById('btn-valider');
    const btnClassement = document.getElementById('btn-classement');

    btnValider?.addEventListener('click', commencerJeu);
    pseudoInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') commencerJeu();
    });
    btnClassement?.addEventListener('click', () => {
        window.open('classement.html', '_blank');
    });
});

// ===== FUNCTION: NETTOYAGE AVANT QUITTER =====
window.addEventListener('beforeunload', () => {
    // Arrêter tous les timers
    Object.values(timerIntervals).forEach(intervalId => {
        if (intervalId) clearInterval(intervalId);
    });
    timerIntervals = {};

    // Désinscrire de tous les écouteurs Firebase
    Object.values(firebaseListeners).forEach(listener => {
        listener.unsubscribe?.();
    });
    firebaseListeners = {};
});

// ===== FUNCTION: COMMENCER JEU =====
function commencerJeu() {
    const pseudoInput = document.getElementById('pseudo-input');
    pseudo = pseudoInput.value.trim();

    if (pseudo === '') {
        alert('Veuillez entrer un pseudo');
        return;
    }

    // Check si pseudo === "root" → Ouvre page admin
    if (pseudo.toLowerCase() === 'root') {
        window.location.href = 'admin.html';
        return;
    }

    // Login normal: cacher auth-container, afficher game-container
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    initialiserJeu();
}

// ===== FUNCTION: INITIALISER JEU =====
function initialiserJeu() {
    chargerDonneesFirebase();
    afficherProchainesCourses();
    genererPilotes();
    afficherScore();
    setupDropZones();
    setupButtons();
    setupModals();

    
    // Vérifier les résultats toutes les 30 secondes
    setInterval(() => {
        const raceCourante = getRaceCourante();
        if (raceCourante) {
            const sprintName = raceCourante.gp.replace(/\s+/g, '_');
            get(ref(db, `resultats/Sprint/${sprintName}`)).then(snapshot => {
                if (snapshot.val()) {
                    sprintResults = snapshot.val();
                    afficherResultats('sprint', 'section-sprint');
                    calculerPointsUtilisateur('sprint');
                }
            });
            get(ref(db, `resultats/Race/${sprintName}`)).then(snapshot => {
                if (snapshot.val()) {
                    raceResults = snapshot.val();
                    afficherResultats('race', 'section-race');
                    calculerPointsUtilisateur('race');
                }
            });
        }
    }, 30000);
}

function setupModals() {
    // --- MODAL HISTORIQUE ---
    const historyIcon = document.getElementById('open-history');
    const modalHistorique = document.getElementById('history-modal');
    const closeHistory = document.getElementById('close-history'); // Assure-toi d'avoir cet ID

    if (historyIcon && modalHistorique) {
        historyIcon.addEventListener('click', () => {
            modalHistorique.classList.add('active');
            if (typeof afficherHistorique === 'function') afficherHistorique();
        });
    }

    // --- MODAL CLASSEMENT ---
    const btnClassement = document.querySelector('.btn-classement'); // Ton bouton dans le header
    const modalClassement = document.getElementById('classement-modal');
    const closeClassement = document.getElementById('close-classement');

    if (btnClassement && modalClassement) {
        btnClassement.addEventListener('click', (e) => {
            e.preventDefault(); // Empêche le changement de page si c'est un lien
            modalClassement.classList.add('active');
            if (typeof chargerClassementGlobal === 'function') chargerClassementGlobal();
        });
    }

    // --- FERMETURE COMMUNE (Cliquer sur le X ou à côté de la modal) ---
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        const closeBtn = modal.querySelector('.close-modal');
        
        // Fermer via le bouton X
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        }

        // Fermer en cliquant sur le fond noir
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
}
// ===== FUNCTION: CHARGER DONNÉES FIREBASE =====
function getPronosticPath(type) {
    const raceCourante = getRaceCourante();
    if (!raceCourante) return null;

    const raceKey = raceCourante.gp.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
    return `pronostics/${pseudo}/${raceKey}/${type}`;
}

function chargerDonneesFirebase() {
    // Récupérer la course courante une seule fois
    const raceCourante = getRaceCourante();
    if (!raceCourante) return;

    // Générer la clé de course pour Firebase
    const raceKey = raceCourante.gp.replace(/\s+/g, "_").replace(/[^\w-]/g, "");

    // ------------------ Charger les pronostics ------------------
    const dbRef = ref(db, `pronostics/${pseudo}/${raceKey}`);
    const listenerKey = 'pronostics_' + pseudo;

    if (firebaseListeners[listenerKey]) {
        firebaseListeners[listenerKey].unsubscribe?.();
    }

    const unsubscribe = onValue(dbRef, (snapshot) => {
        const data = snapshot.val() || {};
        sprintPredictions = data.sprint || {};
        racePredictions = data.race || {};

        chargerPronosticsUtilisateur();
        chargerResultatsOfficiels();
    });
    firebaseListeners[listenerKey] = { unsubscribe };

    // ------------------ Charger les résultats officiels ------------------
    const sprintKey = 'sprint_results_' + raceKey;
    const raceResultsKey = 'race_results_' + raceKey;

    // Écouter résultats Sprint
    const sprintResultsRef = ref(db, `resultats/Sprint/${raceKey}`);
    if (firebaseListeners[sprintKey]) firebaseListeners[sprintKey].unsubscribe?.();
    const unsubscribeSprint = onValue(sprintResultsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            sprintResults = data;
            afficherResultats('sprint', 'section-sprint');
            calculerPointsUtilisateur('sprint');
            mettreAJourScoreCard();
        }
    });
    firebaseListeners[sprintKey] = { unsubscribe: unsubscribeSprint };

    // Écouter résultats Race
    const raceResultsRef = ref(db, `resultats/Race/${raceKey}`);
    if (firebaseListeners[raceResultsKey]) firebaseListeners[raceResultsKey].unsubscribe?.();
    const unsubscribeRace = onValue(raceResultsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            raceResults = data;
            afficherResultats('race', 'section-race');
            calculerPointsUtilisateur('race');
            mettreAJourScoreCard();
        }
    });
    firebaseListeners[raceResultsKey] = { unsubscribe: unsubscribeRace };

    // ------------------ Charger les scores ------------------
    chargerScoresUtilisateur();
}

// ===== FUNCTION: OBTENIR LA RACE COURANTE =====
export function getRaceCourante() {
    const maintenant = new Date();

    for (let i = 0; i < DATA_CALENDRIER.length; i++) {
        const race = DATA_CALENDRIER[i];
        const dateSprint = new Date(race.sprint);
        const dateRace = new Date(race.race);

        // On considère que la course est terminée 2h après la fin
        const finSprint = new Date(dateSprint.getTime() + 2 * 60 * 60 * 1000);
        const finRace = new Date(dateRace.getTime() + 2 * 60 * 60 * 1000);

        if (maintenant < finRace) {
            currentRaceIndex = i;
            return race; // Retourne l'objet complet
        }
    }

    // Si toutes les courses sont passées, retourner la dernière
    if (DATA_CALENDRIER.length > 0) {
        currentRaceIndex = DATA_CALENDRIER.length - 1;
        return DATA_CALENDRIER[currentRaceIndex];
    }

    return null;
}

// ===== FUNCTION: CHARGER SCORES UTILISATEUR =====
function chargerScoresUtilisateur() {
    get(ref(db, 'scores/' + pseudo)).then((snapshot) => {
        currentScores[pseudo] = snapshot.val() || 0;
        afficherScore();
    });

    get(ref(db, 'historique/' + pseudo)).then((snapshot) => {
        scoresHistory[pseudo] = snapshot.val() || [];
        afficherScore();
    });
}

// ===== FUNCTION: AFFICHER PROCHAINES COURSES =====
function afficherProchainesCourses() {
    const raceCourante = getRaceCourante();
    if (!raceCourante) return;

    // Mettre à jour les éléments existants dans l'HTML
    const raceName = document.getElementById('race-name');
    const raceCircuit = document.getElementById('race-circuit');
    const raceDateFormatted = document.getElementById('race-date-formatted');
    const circuitImage = document.getElementById('circuit-image');
    const statsContent = document.getElementById('stats-content');

    if (raceName) raceName.textContent = raceCourante.gp;
    if (raceCircuit) raceCircuit.textContent = raceCourante.circuit;
    
    // Formater la date du sprint
    if (raceDateFormatted) {
        const sprintDate = new Date(raceCourante.sprint);
        raceDateFormatted.textContent = sprintDate.toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    if (circuitImage) {
        circuitImage.src = raceCourante.image;
        circuitImage.alt = raceCourante.circuit;
    }

    if (statsContent && raceCourante.stats2025) {
        statsContent.innerHTML = `
            <div><strong>🏆 Vainqueur 2025:</strong> ${raceCourante.stats2025.vainqueurGP}</div>
            <div><strong>🏃 Sprint 2025:</strong> ${raceCourante.stats2025.vainqueurSprint}</div>
            <div><strong>🎯 Pole 2025:</strong> ${raceCourante.stats2025.pole}</div>
        `;
    }
}

// ===== FUNCTION: AFFICHER SCORE =====
function afficherScore() {
    const scoreMainEl = document.querySelector('.score-main');
    const scoreGpNameEl = document.querySelector('.score-gp-name');
    const scoreLastThreeEl = document.querySelector('.score-last-three');

    if (!scoreMainEl) return;

    const score = currentScores[pseudo] || 0;
    const lastThree = scoresHistory[pseudo] ? scoresHistory[pseudo].slice(0, 3).join(' - ') : 'N/A';

    scoreMainEl.textContent = score;
    if (scoreGpNameEl) scoreGpNameEl.textContent = `${pseudo}`;
    if (scoreLastThreeEl) scoreLastThreeEl.textContent = `Derniers résultats: ${lastThree}`;
}

// ===== FUNCTION: GÉNÉRER PILOTES =====
function genererPilotes() {
    const pilotesList = document.querySelector('.pilotes-list');
    if (!pilotesList) return;

    pilotesList.innerHTML = '';

    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => filtrerPilotes(e.target.value));
    }

    DATA_PILOTES.forEach((pilote) => {
        const div = document.createElement('div');
        div.className = 'pilote-card';
        div.draggable = true;
        div.dataset.num = pilote.num;
        div.dataset.nom = pilote.nom;
        div.textContent = `${pilote.num} - ${pilote.nom}`;

        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragend', handleDragEnd);

        // Marquer comme used si déjà dans prédictions
        if (estUtilise(pilote.num)) {
            div.classList.add('used');
        }

        pilotesList.appendChild(div);
    });
}

// ===== FUNCTION: EST UTILISÉ =====
function estUtilise(num) {
    return (
        Object.values(sprintPredictions).includes(num) ||
        Object.values(racePredictions).includes(num)
    );
}

// ===== FUNCTION: FILTRER PILOTES =====
function filtrerPilotes(valeur) {
    const pilotesList = document.querySelectorAll('.pilotes-list .pilote-card');
    const search = valeur.toLowerCase();

    pilotesList.forEach((card) => {
        const nom = card.dataset.nom.toLowerCase();
        const num = card.dataset.num;
        const match = nom.includes(search) || num.includes(search);
        card.style.display = match ? 'block' : 'none';
    });
}

// ===== FUNCTION: CHARGER PRONOSTICS UTILISATEUR =====
function chargerPronosticsUtilisateur() {
    // Sprint predictions
    const rankSprintPositions = ['1er', '2e', '3e'];
    rankSprintPositions.forEach((rank) => {
        const rankClass = rank === '1er' ? 'rank-1' : rank === '2e' ? 'rank-2' : 'rank-3';
        const element = document.querySelector(`#section-sprint .${rankClass}`);
        if (element && sprintPredictions[rank]) {
            const pilote = DATA_PILOTES.find((p) => parseInt(p.num) === sprintPredictions[rank]);
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
            if (sprintPredictions['1er']) sprintValide = true;
            if (racePredictions['1er']) raceValide = true;
        }
    });

    // Race predictions
    rankSprintPositions.forEach((rank) => {
        const rankClass = rank === '1er' ? 'rank-1' : rank === '2e' ? 'rank-2' : 'rank-3';
        const element = document.querySelector(`#section-race .${rankClass}`);
        if (element && racePredictions[rank]) {
            const pilote = DATA_PILOTES.find((p) => parseInt(p.num) === racePredictions[rank]);
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

    // Crash predictions
    const sprintCrash = document.querySelector('#section-sprint .crash-zone');
    if (sprintCrash && sprintPredictions['Chute']) {
        const pilote = DATA_PILOTES.find((p) => parseInt(p.num) === sprintPredictions['Chute']);
        if (pilote) {
            sprintCrash.innerHTML = afficherPiloteEnZone(pilote, 'Chute');
            attachDragListeners(sprintCrash.querySelector('.pilote-card'));
            sprintCrash.classList.add('used-crash');
        }
    }

    const raceCrash = document.querySelector('#section-race .crash-zone');
    if (raceCrash && racePredictions['Chute']) {
        const pilote = DATA_PILOTES.find((p) => parseInt(p.num) === racePredictions['Chute']);
        if (pilote) {
            raceCrash.innerHTML = afficherPiloteEnZone(pilote, 'Chute');
            attachDragListeners(raceCrash.querySelector('.pilote-card'));
            raceCrash.classList.add('used-crash');
        }
    }

    // Démarrer/Charger timers et résultats
    demarrerTimer('sprint', 'section-sprint');
    demarrerTimer('race', 'section-race');

    // mettre à jour récap/modify
    afficherRecap('sprint');
    afficherRecap('race');
    // ajuster la visibilité des sections sprint/race
    updateSectionsVisibility();
}

// ===== FUNCTION: ATTACH DRAG LISTENERS =====
function attachDragListeners(card) {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
}

// ===== DRAG & DROP HANDLERS =====
let draggedElement = null;
let draggedFromZone = null; // Permet de tracker si on drag d'une zone

function handleDragStart(e) {
    draggedElement = e.target;
    draggedFromZone = draggedElement.closest('.step');
    e.target.style.opacity = '0.5';
}

function handleDragEnd(e) {
    if (e.target) e.target.style.opacity = '1';
    draggedElement = null;
    draggedFromZone = null;
}
// ===== FUNCTION: SETUP DROP ZONES =====
function setupDropZones() {
    const dropZones = document.querySelectorAll('.step');

    dropZones.forEach((zone) => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
        zone.addEventListener('dragleave', handleDragLeave);
    });

    // permettre de déposer sur la liste des pilotes pour retirer un pilote d'une zone
    const pilotesListContainer = document.querySelector('.pilotes-list');
    if (pilotesListContainer) {
        pilotesListContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        pilotesListContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            // si on lâche sur la liste, on retire simplement la prédiction
            if (!draggedElement || !draggedFromZone) return;

            const num = parseInt(draggedElement.dataset.num);
            const oldRank = draggedFromZone.getAttribute('data-rank');
            const oldSectionId = draggedFromZone.closest('[id^="section-"]')?.id;
            const oldType = oldSectionId === 'section-sprint' ? 'sprint' : 'race';
            const oldPredictions = oldType === 'sprint' ? sprintPredictions : racePredictions;

            // supprimer de la prédiction et vider la zone cible
            delete oldPredictions[oldRank];
            const oldContent = draggedFromZone.querySelector('.target-area');
            if (oldContent) oldContent.innerHTML = '';
            // restaurer le placeholder
            const placeholder = draggedFromZone.querySelector('small');
            if (placeholder) placeholder.style.display = '';
            draggedFromZone.classList.remove('used-crash');
            draggedFromZone.style.background = '';

            // Ne pas écrire immédiatement dans Firebase, on committra au moment de la validation

            // rendre le pilote à nouveau sélectionnable
            const pilotesCards = document.querySelectorAll('.pilotes-list .pilote-card');
            const isStillUsed = estUtilise(num);
            pilotesCards.forEach((card) => {
                if (parseInt(card.dataset.num) === num && !isStillUsed) {
                    card.classList.remove('used');
                }
            });
        });
    }

    // écouteur global catch-all : si on lâche ailleurs que sur une zone ou la liste
    document.body.addEventListener('drop', (e) => {
        const targetZone = e.target.closest('.step');
        const overList = e.target.closest('.pilotes-list');
        if (targetZone || overList) return; // déjà géré
        if (!draggedElement || !draggedFromZone) return;

        const num = parseInt(draggedElement.dataset.num);
        const oldRank = draggedFromZone.getAttribute('data-rank');
        const oldSectionId = draggedFromZone.closest('[id^="section-"]')?.id;
        const oldType = oldSectionId === 'section-sprint' ? 'sprint' : 'race';
        const oldPredictions = oldType === 'sprint' ? sprintPredictions : racePredictions;

        delete oldPredictions[oldRank];
        const oldContent = draggedFromZone.querySelector('.target-area');
        if (oldContent) oldContent.innerHTML = '';
        const placeholder = draggedFromZone.querySelector('small');
        if (placeholder) placeholder.style.display = '';
        draggedFromZone.classList.remove('used-crash');
        draggedFromZone.style.background = '';
        // Ne pas écrire immédiatement dans Firebase, on committra au moment de la validation

        const pilotesCards = document.querySelectorAll('.pilotes-list .pilote-card');
        const isStillUsed = estUtilise(num);
        pilotesCards.forEach((card) => {
            if (parseInt(card.dataset.num) === num && !isStillUsed) {
                card.classList.remove('used');
            }
        });
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.style.background = 'rgba(225, 6, 0, 0.3)';
}

function handleDragLeave(e) {
    const zone = e.currentTarget;
    if (zone.classList.contains('crash-zone')) {
        zone.style.background = zone.classList.contains('used-crash') ? 'rgba(225, 6, 0, 0.2)' : 'rgba(225, 6, 0, 0.1)';
    } else {
        zone.style.background = '';
    }
}

function afficherPiloteEnZone(pilote, rank) {
    if (rank === 'Chute') {
        // crash prediction stays inside zone
        return `
            <div class="pilote-card" draggable="true" data-num="${pilote.num}" data-nom="${pilote.nom}">
                🚨 Chute<br>
                <strong class="num">${pilote.num}</strong> <span>${pilote.nom}</span>
            </div>
        `;
    } else {
        // simple card without rank label; the step itself displays the rank above
        return `
            <div class="pilote-card" draggable="true" data-num="${pilote.num}" data-nom="${pilote.nom}">
                <strong class="num">${pilote.num}</strong> <span>${pilote.nom}</span>
            </div>
        `;
    }
}
function handleDrop(e) {
    e.preventDefault();
    const zone = e.currentTarget;
    if (!draggedElement) return;

    const sectionId = zone.closest('[id^="section-"]')?.id;
    const type = sectionId === 'section-sprint' ? 'sprint' : 'race';
    const predictions = type === 'sprint' ? sprintPredictions : racePredictions;

    const rank = zone.getAttribute('data-rank') || 'Chute';

    const num = parseInt(draggedElement.dataset.num);
    const nom = draggedElement.dataset.nom;

    // 🔴 enlever l'ancienne position si elle existe
    if (draggedFromZone && draggedFromZone !== zone) {
        const oldRank = draggedFromZone.getAttribute('data-rank');
        const oldSectionId = draggedFromZone.closest('[id^="section-"]')?.id;
        const oldType = oldSectionId === 'section-sprint' ? 'sprint' : 'race';
        const oldPredictions = oldType === 'sprint' ? sprintPredictions : racePredictions;

        delete oldPredictions[oldRank];

        const oldContent = draggedFromZone.querySelector('.target-area, .crash-zone');
        if (oldContent) oldContent.innerHTML = '';

        const placeholder = draggedFromZone.querySelector('small');
        if (placeholder) placeholder.style.display = '';

        draggedFromZone.classList.remove('used-crash');
        draggedFromZone.style.background = '';
    }

    // 🔴 si un pilote était déjà dans cette zone → le libérer
    const existingCard = zone.querySelector('.pilote-card');
    if (existingCard) {
        const existingNum = parseInt(existingCard.dataset.num);
        delete predictions[rank];

        document.querySelectorAll('.pilotes-list .pilote-card').forEach(card => {
            if (parseInt(card.dataset.num) === existingNum) {
                card.classList.remove('used');
            }
        });
    }

    // 🟢 enregistrer la prédiction
    predictions[rank] = num;

    const contentArea = zone.querySelector('.target-area') || zone;
    const placeholder = zone.querySelector('small');
    if (placeholder) placeholder.style.display = 'none';

    contentArea.innerHTML = afficherPiloteEnZone({ num, nom }, rank);
    attachDragListeners(contentArea.querySelector('.pilote-card'));

    document.querySelectorAll('.pilotes-list .pilote-card').forEach(card => {
        if (parseInt(card.dataset.num) === num) {
            card.classList.add('used');
        }
    });

    zone.style.background = '';
    if (zone.classList.contains('crash-zone')) zone.classList.add('used-crash');

    mettreAJourAffichagePronostics();
}

// ===== FUNCTION: METTRE À JOUR AFFICHAGE PRONOSTICS =====
function mettreAJourAffichagePronostics() {
    const pilotesColumn = document.querySelector('.pilotes-column');
    const podiumColumn = document.querySelector('.podium-column');

    if (!pilotesColumn) return;

    // ON CACHE UNIQUEMENT SI LES DEUX SONT VALIDÉS
    if (sprintValide && raceValide) {
        pilotesColumn.style.display = 'none';
        if (podiumColumn) podiumColumn.style.display = 'none';
    } else {
        pilotesColumn.style.display = 'flex';
        if (podiumColumn) podiumColumn.style.display = 'flex';
    }
}

// ===== UTILITIES: RÉCAP ET MODIFICATION =====

function updateSectionsVisibility() {
    const sectionSprint = document.getElementById('section-sprint');
    const sectionRace = document.getElementById('section-race');
    const title = document.getElementById('current-title');

    const sprintComplete = sprintPredictions['1er'] && sprintPredictions['2e'] && sprintPredictions['3e'] && sprintPredictions['Chute'];    if (sprintComplete || !canModify('sprint')) {
        sectionSprint?.classList.add('hidden');
        sectionRace?.classList.remove('hidden');
        if (title) title.textContent = 'Choisissez pour le GRAND PRIX';
    } else {
        sectionSprint?.classList.remove('hidden');
        sectionRace?.classList.add('hidden');
        if (title) title.textContent = 'Choisissez pour le SPRINT';
    }
}


function canModify(type) {
    const raceCourante = getRaceCourante();
    if (!raceCourante) return false;
    const eventDate = new Date(type === 'sprint' ? raceCourante.sprint : raceCourante.race).getTime();
    return Date.now() < eventDate;
}

function afficherRecap(type) {
    const recapEl = document.getElementById(`recap-${type}`);
    const btnContainer = document.getElementById(`btn-edit-${type}-container`);
    const predictions = type === 'sprint' ? sprintPredictions : racePredictions;
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

    // mettre à jour l'état du bouton valider
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

// ===== FUNCTION: CRÉER TIMER COUNTDOWN =====
function creerTimer(dateStr, timerKey, timerElement) {
    if (timerIntervals[timerKey]) clearInterval(timerIntervals[timerKey]);

    function updateTimer() {
        const now = new Date().getTime();
        const eventTime = new Date(dateStr).getTime();
        const diff = eventTime - now;

        if (diff <= 0) {
            timerElement.innerHTML = '⏳ C\'est parti !';
            timerElement.style.color = '#00ff00';
            clearInterval(timerIntervals[timerKey]);
            delete timerIntervals[timerKey];
            afficherRecap('sprint');
            afficherRecap('race');
            return false;
        }

        const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
        const heures = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secondes = Math.floor((diff % (1000 * 60)) / 1000);

        timerElement.innerHTML = `
            <div style="display:flex;gap:10px;font-weight:bold">
                <div style="text-align:center"><div style="font-size:1.5em;color:#e10600">${jours}</div><div style="font-size:0.8em;color:#ccc">jours</div></div>
                <div style="text-align:center"><div style="font-size:1.5em;color:#e10600">${heures}</div><div style="font-size:0.8em;color:#ccc">heures</div></div>
                <div style="text-align:center"><div style="font-size:1.5em;color:#e10600">${minutes}</div><div style="font-size:0.8em;color:#ccc">min</div></div>
                <div style="text-align:center"><div style="font-size:1.5em;color:#e10600">${secondes}</div><div style="font-size:0.8em;color:#ccc">sec</div></div>
            </div>
        `;
        return true;
    }

    if (!updateTimer()) return;

    timerIntervals[timerKey] = setInterval(() => {
        if (!updateTimer()) clearInterval(timerIntervals[timerKey]);
    }, 1000);
}

// ===== FUNCTION: DÉMARRER TIMER =====
function demarrerTimer(type, sectionId) {
    const timerElement = document.getElementById(`timer-${type}`);
    if (!timerElement) return;

    const raceCourante = getRaceCourante();
    if (!raceCourante) return;

    const results = type === 'sprint' ? sprintResults : raceResults;
    if (results && Object.keys(results).length > 0) {
        afficherResultats(type, sectionId);
        return;
    }

    const dateEvent = type === 'sprint' ? raceCourante.sprint : raceCourante.race;
    const timerKey = `timer_${type}_${currentRaceIndex}`;
    creerTimer(dateEvent, timerKey, timerElement);
}

// ===== FUNCTION: AFFICHER RÉSULTATS =====

function afficherResultats(type, sectionId) {
    const timerElement = document.getElementById(`timer-${type}`);
    if (!timerElement) return;

    const results = type === 'sprint' ? sprintResults : raceResults;

    if (Object.keys(results).length === 0) return;

    timerElement.innerHTML = `✅ Résultats ${type === 'sprint' ? 'Sprint' : 'Course'} reçus`;
    timerElement.style.background = 'linear-gradient(135deg, rgba(0, 255, 0, 0.2) 0%, rgba(0, 255, 0, 0.05) 100%)';
    timerElement.style.color = '#00ff00';

    // Charger résultats officiels
    chargerResultatsOfficiels();
}

// ===== FUNCTION: CHARGER RÉSULTATS OFFICIELS =====
function chargerResultatsOfficiels() {
    // Afficher résultats du sprint
    const officialSprintEl = document.getElementById('official-sprint');
    const timerSprintEl = document.getElementById('timer-sprint'); 

    if (officialSprintEl) {
        if (sprintResults && sprintResults['1er']) {
            if (timerSprintEl) timerSprintEl.style.display = 'none';

            officialSprintEl.innerHTML = `
                <div><strong>🥇 1er:</strong> ${sprintResults['1er'] || 'TBD'}</div>
                <div><strong>🥈 2e:</strong> ${sprintResults['2e'] || 'TBD'}</div>
                <div><strong>🥉 3e:</strong> ${sprintResults['3e'] || 'TBD'}</div>
            `;
        } else {
            if (timerSprintEl) timerSprintEl.classList.add('hidden-timer');
        }
    }

    // Afficher résultats de la race
    const officialRaceEl = document.getElementById('official-race');
    const timerRaceEl = document.getElementById('timer-race');

    if (officialRaceEl) {
        if (raceResults && raceResults['1er']) {
            if (timerRaceEl) timerRaceEl.style.display = 'none';
            officialRaceEl.innerHTML = `
                <div><strong>🥇 1er:</strong> ${raceResults['1er'] || 'TBD'}</div>
                <div><strong>🥈 2e:</strong> ${raceResults['2e'] || 'TBD'}</div>
                <div><strong>🥉 3e:</strong> ${raceResults['3e'] || 'TBD'}</div>
            `;
        } else {
            if (timerRaceEl) timerRaceEl.classList.add('hidden-timer');
        }
    }
    
    // Mettre à jour récap et boutons modifier
    afficherRecap('sprint');
    afficherRecap('race');
    // ajuster les sections en fonction des pronostics
    updateSectionsVisibility();
}

// --- Écouteurs Firebase en temps réel ---
onValue(sprintResultsRef, (snapshot) => {
    const sprintResults = snapshot.val();
    // On récupère aussi les résultats de race pour garder la fonction unique
    getDatabase(database).ref('results/race').get().then(raceSnapshot => {
        const raceResults = raceSnapshot.val();
        updateOfficialResults(sprintResults, raceResults);
    });
});

onValue(raceResultsRef, (snapshot) => {
    const raceResults = snapshot.val();
    // On récupère aussi les résultats de sprint pour garder la fonction unique
    getDatabase(database).ref('results/sprint').get().then(sprintSnapshot => {
        const sprintResults = sprintSnapshot.val();
        updateOfficialResults(sprintResults, raceResults);
    });
});

// ===== FUNCTION: CALCULER LES POINTS =====
function calculerPointsUtilisateur(type) {
    const predictions = type === 'sprint' ? sprintPredictions : racePredictions;
    const results = type === 'sprint' ? sprintResults : raceResults;

    if (!results || !results['1er']) return;

    let pointsGagnes = 0;
    const raceCourante = getRaceCourante();
    if (!raceCourante) return;

    const podiumReel = [
        results['1er'],
        results['2e'],
        results['3e']
    ];

    // --- PODIUM ---
    for (const [rank, predictedNum] of Object.entries(predictions)) {
        if (rank === 'Chute') continue;

        const pilote = DATA_PILOTES.find(p => parseInt(p.num) === predictedNum);
        if (!pilote) continue;

        const nom = pilote.nom;
        const indexReel = podiumReel.indexOf(nom);

        if (indexReel === -1) {
            // ❌ pas sur le podium
            pointsGagnes += 3;
        } else {
            const placeReelle = ['1er', '2e', '3e'][indexReel];

            if (placeReelle === rank) {
                if (rank === '1er') pointsGagnes -= 3;
                if (rank === '2e') pointsGagnes -= 2;
                if (rank === '3e') pointsGagnes -= 1;
            } else {
                // 🔄 bon pilote, mauvaise place
                pointsGagnes += 1;
            }
        }
    }

    // --- CHUTE ---
    if (predictions['Chute']) {
        const piloteChute = DATA_PILOTES.find(p => parseInt(p.num) === predictions['Chute']);
        if (piloteChute) {
            const estSurPodium = podiumReel.includes(piloteChute.nom);
            if (!estSurPodium) {
                // 💥 chute bien prédite
                pointsGagnes -= 1;
            }
        }
    }

    // --- SAUVEGARDE FIREBASE ---
    const raceId = raceCourante.gp.replace(/\s+/g, '_');
    const scoreRef = ref(db, `scores_details/${pseudo}/${raceId}/${type}`);

    get(scoreRef).then(snap => {
        if (snap.exists()) return; // empêche double calcul

        set(scoreRef, pointsGagnes);

        get(ref(db, 'scores/' + pseudo)).then(snapshot => {
            const scoreActuel = snapshot.val() || 0;
            const nouveauScore = scoreActuel + pointsGagnes;
            set(ref(db, 'scores/' + pseudo), nouveauScore);
            currentScores[pseudo] = nouveauScore;
            afficherScore();
        });
    });
}

// ===== FUNCTION: METTRE À JOUR SCORE CARD =====
function mettreAJourScoreCard() {
    // Récupérer scores depuis Firebase
    get(ref(db, 'scores/' + pseudo)).then((snapshot) => {
        const score = snapshot.val() || 0;
        currentScores[pseudo] = score;
        afficherScore();
    });

    // Récupérer historique depuis Firebase
    get(ref(db, 'historique/' + pseudo)).then((snapshot) => {
        const historique = snapshot.val() || [];
        scoresHistory[pseudo] = historique;
        afficherScore();
    });
}

// ===== FUNCTION: ÉDITER PRONOSTIC =====
function editerPronostic(type) {
    const path = getPronosticPath(type);
    if (!path) return;

    // Vider les prédictions du type
    if (type === 'sprint') {
        sprintPredictions = {};
        sprintValide = false;
    } else {
        racePredictions = {};
        raceValide = false;
    }

    set(ref(db, path), null); // supprime les pronostics Firebase

    // Régénérer la liste des pilotes et vider les zones
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
    mettreAJourAffichagePronostics();
}

// ===== FUNCTION: SETUP BUTTONS =====
function setupButtons() {
    // Configurer les boutons de validation du sprint
    const btnValiderSprint = document.getElementById('btn-valider-sprint');
    if (btnValiderSprint) {
        btnValiderSprint.addEventListener('click', () => validerPronostic('sprint'));
    }

    // Configurer les boutons de validation de la race
    const btnValiderRace = document.getElementById('btn-valider-race');
    if (btnValiderRace) {
        btnValiderRace.addEventListener('click', () => validerPronostic('race'));
    }

    // Configurer modal historique
    const historyIcon = document.getElementById('open-history');
    const modalHistorique = document.getElementById('history-modal');
    const closeModal = document.querySelector('.close-modal');

    if (historyIcon && modalHistorique) {
        historyIcon.addEventListener('click', () => {
            modalHistorique.classList.add('active');
            afficherHistorique();
        });
    }

    if (closeModal && modalHistorique) {
        closeModal.addEventListener('click', () => {
            modalHistorique.classList.remove('active');
        });
    }

    if (modalHistorique) {
        modalHistorique.addEventListener('click', (e) => {
            if (e.target === modalHistorique) {
                modalHistorique.classList.remove('active');
            }
        });
    }
    const btnRegles = document.getElementById('btn-regles');
    const modalRegles = document.getElementById('regles-modal');
    const closeRegles = document.getElementById('close-regles');

    if (btnRegles && modalRegles) {
        btnRegles.addEventListener('click', (e) => {
            e.preventDefault();
            modalRegles.classList.add('active');
        });
    }

    if (closeRegles && modalRegles) {
        closeRegles.addEventListener('click', () => {
            modalRegles.classList.remove('active');
        });
    }

    if (modalRegles) {
        modalRegles.addEventListener('click', (e) => {
            if (e.target === modalRegles) {
                modalRegles.classList.remove('active');
            }
        });
    }
}

// ===== FUNCTION: VALIDER PRONOSTIC =====
function validerPronostic(type) {
    const predictions = type === 'sprint' ? sprintPredictions : racePredictions;

    if (!predictions['1er'] || !predictions['2e'] || !predictions['3e'] || !predictions['Chute']) {
        alert('Veuillez compléter le podium ET le pari chute avant de valider');
        return;
    }

    const path = getPronosticPath(type);
    if (!path) return;

    set(ref(db, path), predictions).then(() => {
        alert(`✅ Vos pronostics ${type === 'sprint' ? 'Sprint' : 'Race'} ont été sauvegardés!`);

        if (type === 'sprint') sprintValide = true;
        if (type === 'race') raceValide = true;

        mettreAJourAffichagePronostics();
        afficherRecap(type);
        updateSectionsVisibility();

        const results = type === 'sprint' ? sprintResults : raceResults;
        if (results && Object.keys(results).length > 0) {
            calculerPointsUtilisateur(type);
        }
    });
}
// ===== FUNCTION: AFFICHER HISTORIQUE =====
function afficherHistorique() {
    const historyList = document.querySelector('.history-list');
    if (!historyList || !scoresHistory[pseudo]) return;

    historyList.innerHTML = '';
    scoresHistory[pseudo].forEach((score, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <span class="history-item-name">Manche ${index + 1}</span>
            <span class="history-item-score">${score} pts</span>
        `;
        historyList.appendChild(item);
    });
}
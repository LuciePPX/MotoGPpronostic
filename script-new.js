import { DATA_PILOTES, DATA_CALENDRIER } from './config.js';

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
    apiKey: "AIzaSyBYjWjsY5eHOjrQOD2nJhXh0lZuQLwM6YQ",
    authDomain: "motogp-pronostic.firebaseapp.com",
    databaseURL: "https://motogp-pronostic-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "motogp-pronostic",
    storageBucket: "motogp-pronostic.appspot.com",
    messagingSenderId: "1082916850330",
    appId: "1:1082916850330:web:dbf5d1c7d8e47d86f01b75"
};

// Initialize Firebase (using global firebase from CDN)
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ===== GLOBAL STATE =====
let pseudo = '';
let sprintPredictions = {};
let racePredictions = {};
let sprintResults = {};
let raceResults = {};
let currentScores = {};
let scoresHistory = {};

// ===== ÉCRAN D'AUTH =====
document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');
    const gameContainer = document.getElementById('game-container');
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
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');

    initialiserJeu();
}

// ===== FUNCTION: INITIALISER JEU =====
function initialiserJeu() {
    chargerDonneesFirebase();
    afficherProchainesCourses();
    genererPilotes();
    chargerPronosticsUtilisateur();
    afficherScore();
    setupDropZones();
    setupButtons();
}

// ===== FUNCTION: CHARGER DONNÉES FIREBASE =====
function chargerDonneesFirebase() {
    const dbRef = database.ref('pronostics/' + pseudo);
    dbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            sprintPredictions = data.sprint || {};
            racePredictions = data.race || {};
            chargerResultatsOfficiels();
        }
    });
}

// ===== FUNCTION: AFFICHER PROCHAINES COURSES =====
function afficherProchainesCourses() {
    const calendrier = DATA_CALENDRIER;
    if (calendrier.length === 0) return;

    const nextRace = calendrier[0];
    const nextRaceContainer = document.getElementById('next-race-container');

    if (nextRaceContainer) {
        nextRaceContainer.innerHTML = `
            <h2>Prochaine Manche</h2>
            <div class="race-content-wrapper">
                <div class="race-info">
                    <div class="race-gp-name">
                        <span>${nextRace.numero}</span>
                        <div>
                            <h3 style="margin: 0; color: var(--red);">${nextRace.nom}</h3>
                            <p style="margin: 5px 0 0 0; color: var(--text-secondary);">${nextRace.circuit}</p>
                        </div>
                    </div>
                    <div class="race-details">
                        <div class="detail-item">
                            <span class="detail-icon">📍</span>
                            <span>${nextRace.pays}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-icon">📅</span>
                            <span>${nextRace.date}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-icon">🏁</span>
                            <span>${nextRace.tours} tours</span>
                        </div>
                    </div>
                </div>
                ${nextRace.image ? `
                    <div class="circuit-image-container">
                        <img src="${nextRace.image}" alt="${nextRace.circuit}" class="circuit-image">
                    </div>
                ` : ''}
            </div>
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
    const rankSprintPositions = ['rank-1', 'rank-2', 'rank-3'];
    rankSprintPositions.forEach((rank) => {
        const element = document.querySelector(`#section-sprint .${rank} .target-area`);
        if (element && sprintPredictions[rank]) {
            const pilote = DATA_PILOTES.find((p) => p.num === sprintPredictions[rank]);
            if (pilote) {
                element.innerHTML = `
                    <div class="pilote-card" draggable="true" data-num="${pilote.num}" data-nom="${pilote.nom}">
                        ${pilote.num} - ${pilote.nom}
                    </div>
                `;
                attachDragListeners(element.querySelector('.pilote-card'));
            }
        }
    });

    // Race predictions
    rankSprintPositions.forEach((rank) => {
        const element = document.querySelector(`#section-race .${rank} .target-area`);
        if (element && racePredictions[rank]) {
            const pilote = DATA_PILOTES.find((p) => p.num === racePredictions[rank]);
            if (pilote) {
                element.innerHTML = `
                    <div class="pilote-card" draggable="true" data-num="${pilote.num}" data-nom="${pilote.nom}">
                        ${pilote.num} - ${pilote.nom}
                    </div>
                `;
                attachDragListeners(element.querySelector('.pilote-card'));
            }
        }
    });

    // Crash predictions
    const sprintCrash = document.querySelector('#section-sprint .crash-zone');
    if (sprintCrash && sprintPredictions.crash) {
        const pilote = DATA_PILOTES.find((p) => p.num === sprintPredictions.crash);
        if (pilote) {
            sprintCrash.innerHTML = `
                <div class="pilote-card" draggable="true" data-num="${pilote.num}" data-nom="${pilote.nom}">
                    ${pilote.num} - ${pilote.nom}
                </div>
            `;
            attachDragListeners(sprintCrash.querySelector('.pilote-card'));
            sprintCrash.classList.add('used-crash');
        }
    }

    const raceCrash = document.querySelector('#section-race .crash-zone');
    if (raceCrash && racePredictions.crash) {
        const pilote = DATA_PILOTES.find((p) => p.num === racePredictions.crash);
        if (pilote) {
            raceCrash.innerHTML = `
                <div class="pilote-card" draggable="true" data-num="${pilote.num}" data-nom="${pilote.nom}">
                    ${pilote.num} - ${pilote.nom}
                </div>
            `;
            attachDragListeners(raceCrash.querySelector('.pilote-card'));
            raceCrash.classList.add('used-crash');
        }
    }

    // Démarrer/Charger timers et résultats
    demarrerTimer('sprint', 'section-sprint');
    demarrerTimer('race', 'section-race');
}

// ===== FUNCTION: ATTACH DRAG LISTENERS =====
function attachDragListeners(card) {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
}

// ===== DRAG & DROP HANDLERS =====
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = e.target;
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    if (e.target) {
        e.target.style.opacity = '1';
    }
    draggedElement = null;
}

// ===== FUNCTION: SETUP DROP ZONES =====
function setupDropZones() {
    const dropZones = document.querySelectorAll('.target-area, .crash-zone');

    dropZones.forEach((zone) => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
        zone.addEventListener('dragleave', handleDragLeave);
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

function handleDrop(e) {
    e.preventDefault();

    const zone = e.currentTarget;
    if (!draggedElement) return;

    // Déterminer le type de course et le rang
    const sectionId = zone.closest('[id^="section-"]')?.id;
    const type = sectionId === 'section-sprint' ? 'sprint' : 'race';
    const predictions = type === 'sprint' ? sprintPredictions : racePredictions;

    // Déterminer le rang/zone
    let rank = 'crash';
    if (zone.classList.contains('rank-1')) rank = 'rank-1';
    else if (zone.classList.contains('rank-2')) rank = 'rank-2';
    else if (zone.classList.contains('rank-3')) rank = 'rank-3';

    // Sauvegarde
    const num = parseInt(draggedElement.dataset.num);
    predictions[rank] = num;

    // Cloner le pilote dans la zone
    zone.innerHTML = '';
    const clonedCard = draggedElement.cloneNode(true);
    clonedCard.style.opacity = '1';
    zone.appendChild(clonedCard);
    attachDragListeners(clonedCard);

    // Marquer comme used
    const pilotesCards = document.querySelectorAll('.pilotes-list .pilote-card');
    pilotesCards.forEach((card) => {
        if (parseInt(card.dataset.num) === num) {
            card.classList.add('used');
        }
    });

    // Refresh zones
    zone.style.background = '';
    if (zone.classList.contains('crash-zone')) {
        zone.classList.add('used-crash');
    }

    // Sauvegarder en Firebase
    database.ref(`pronostics/${pseudo}/${type}`).set(predictions);
    mettreAJourAffichagePronostics();
}

// ===== FUNCTION: METTRE À JOUR AFFICHAGE PRONOSTICS =====
function mettreAJourAffichagePronostics() {
    const sprintComplete = sprintPredictions['rank-1'] && sprintPredictions['rank-2'] && sprintPredictions['rank-3'];
    const raceComplete = racePredictions['rank-1'] && racePredictions['rank-2'] && racePredictions['rank-3'];

    const pilotesColumn = document.querySelector('.pilotes-column');
    if (pilotesColumn) {
        if (sprintComplete && raceComplete) {
            pilotesColumn.style.display = 'none';
        } else {
            pilotesColumn.style.display = 'flex';
        }
    }
}

// ===== FUNCTION: DÉMARRER TIMER =====
function demarrerTimer(type, sectionId) {
    const timerElement = document.querySelector(`#${sectionId} #timer-${type}`);
    if (!timerElement) return;

    // Vérifier si résultat existe déjà
    const results = type === 'sprint' ? sprintResults : raceResults;
    if (Object.keys(results).length > 0) {
        afficherResultats(type, sectionId);
        return;
    }

    // Afficher message "⏳ Résultat en attente..."
    timerElement.textContent = `⏳ Résultat ${type === 'sprint' ? 'Sprint' : 'Course'} en attente...`;
    timerElement.style.background = 'linear-gradient(135deg, rgba(225, 6, 0, 0.2) 0%, rgba(225, 6, 0, 0.05) 100%)';

    // Écouter les résultats officiels en Firebase
    const resultsRef = database.ref(`resultats/${type}`);
    resultsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            if (type === 'sprint') {
                sprintResults = data;
            } else {
                raceResults = data;
            }
            afficherResultats(type, sectionId);
            mettreAJourScoreCard();
        }
    });
}

// ===== FUNCTION: AFFICHER RÉSULTATS =====
function afficherResultats(type, sectionId) {
    const timerElement = document.querySelector(`#${sectionId} #timer-${type}`);
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
    // Vérifier si résultats officiel existent
    const recapSprintEl = document.getElementById('recap-sprint');
    const recapRaceEl = document.getElementById('recap-race');

    if (recapSprintEl && sprintResults && sprintResults['rank-1']) {
        recapSprintEl.innerHTML = `
            1️⃣ ${sprintResults['rank-1'] || 'TBD'}<br>
            2️⃣ ${sprintResults['rank-2'] || 'TBD'}<br>
            3️⃣ ${sprintResults['rank-3'] || 'TBD'}
        `;
    } else if (recapSprintEl) {
        recapSprintEl.innerHTML = 'Résultats non disponibles';
    }

    if (recapRaceEl && raceResults && raceResults['rank-1']) {
        recapRaceEl.innerHTML = `
            1️⃣ ${raceResults['rank-1'] || 'TBD'}<br>
            2️⃣ ${raceResults['rank-2'] || 'TBD'}<br>
            3️⃣ ${raceResults['rank-3'] || 'TBD'}
        `;
    } else if (recapRaceEl) {
        recapRaceEl.innerHTML = 'Résultats non disponibles';
    }
}

// ===== FUNCTION: METTRE À JOUR SCORE CARD =====
function mettreAJourScoreCard() {
    // Récupérer scores depuis Firebase
    database.ref('scores/' + pseudo).once('value', (snapshot) => {
        const score = snapshot.val() || 0;
        currentScores[pseudo] = score;
        afficherScore();
    });

    // Récupérer historique depuis Firebase
    database.ref('historique/' + pseudo).once('value', (snapshot) => {
        const historique = snapshot.val() || [];
        scoresHistory[pseudo] = historique;
        afficherScore();
    });
}

// ===== FUNCTION: ÉDITER PRONOSTIC =====
function editerPronostic(type) {
    const pilotesColumn = document.querySelector('.pilotes-column');
    if (pilotesColumn) {
        pilotesColumn.style.display = 'flex';
    }

    // Vider les prédictions du type
    if (type === 'sprint') {
        sprintPredictions = {};
        database.ref(`pronostics/${pseudo}/sprint`).remove();
    } else {
        racePredictions = {};
        database.ref(`pronostics/${pseudo}/race`).remove();
    }

    // Regenerer la liste des pilotes
    genererPilotes();
    
    // Vider les zones
    const section = document.getElementById(`section-${type}`);
    if (section) {
        section.querySelectorAll('.target-area, .crash-zone').forEach(zone => {
            zone.innerHTML = '';
            zone.classList.remove('used-crash');
            if (!zone.classList.contains('crash-zone')) {
                zone.style.background = '';
            }
        });
    }
}

// ===== FUNCTION: SETUP BUTTONS =====
function setupButtons() {
    // Configurer les boutons de modifier
    const btnModifierSprint = document.querySelector('#section-sprint .btn-modifier');
    const btnModifierRace = document.querySelector('#section-race .btn-modifier');
    
    if (btnModifierSprint) {
        btnModifierSprint.addEventListener('click', () => editerPronostic('sprint'));
    }
    if (btnModifierRace) {
        btnModifierRace.addEventListener('click', () => editerPronostic('race'));
    }

    // Configurer modal historique
    const historyIcon = document.querySelector('.history-icon');
    const modalHistorique = document.getElementById('modal-historique');
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

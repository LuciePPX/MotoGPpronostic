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
let currentRaceIndex = 0; // Index de la course actuelle dans le calendrier
let timerIntervals = {}; // Stockage des intervalles de timer
let firebaseListeners = {}; // Stockage des écouteurs Firebase
let sprintValide = false;
let raceValide = false;

// ===== ÉCRAN D'AUTH =====
document.addEventListener('DOMContentLoaded', () => {
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

    
    // Démarrer/Charger timers 
    demarrerTimer('sprint', 'section-sprint');
    demarrerTimer('race', 'section-race');
    
    // Vérifier les résultats toutes les 30 secondes
   // 1. On récupère la course une seule fois proprement
    const raceCourante = getRaceCourante();

    if (raceCourante) {
        // 2. Création de la clé de la course
        const raceKey = raceCourante.gp.replace(/\s+/g, "_").replace(/[^\w-]/g, "");

        // 3. Définition des références 
        const sprintResultsRef = ref(db, `resultats/${raceKey}/sprint`);
        const raceResultsRef = ref(db, `resultats/${raceKey}/race`);

        // 4. Écouteur pour le SPRINT
        onValue(sprintResultsRef, (snapshot) => {
            sprintResults = snapshot.val() || {};
            if (Object.keys(sprintResults).length > 0) {
                // Si on a des résultats, on les affiche
                chargerResultatsOfficiels();
            } else {
                // SINON, on lance le timer !
                demarrerTimer('sprint', 'section-sprint');
            }
        });

        // 5. Écouteur pour la RACE
        onValue(raceResultsRef, (snapshot) => {
            raceResults = snapshot.val() || {};
            if (Object.keys(raceResults).length > 0) {
                chargerResultatsOfficiels();
            } else {
                // SINON, on lance le timer !
                demarrerTimer('race', 'section-race');
            }
        });
    }


function setupModals() {
    // --- MODAL HISTORIQUE ---
    const historyIcon = document.getElementById('open-history');
    const modalHistorique = document.getElementById('history-modal');

    if (historyIcon && modalHistorique) {
        historyIcon.addEventListener('click', () => {
            modalHistorique.classList.add('active');
            if (typeof afficherHistorique === 'function') afficherHistorique();
        });
    }
async function chargerClassementGlobal() {
    const tbody = document.getElementById('classement-tbody');
    const loadingEl = document.getElementById('loading');
    const tableEl = document.getElementById('classement-table');
    const emptyEl = document.getElementById('empty');

    try {
        // On récupère tout le nœud scores_details
        const snapshot = await get(ref(db, 'scores_details/'));
        
        if (snapshot.exists()) {
            const allData = snapshot.val();
            const listeJoueurs = [];

            // Parcours de chaque utilisateur (ex: Lucy)
            for (const [pseudo, grandsPrix] of Object.entries(allData)) {
                let totalSprint = 0;
                let totalRace = 0;

                // Parcours de chaque GP pour cet utilisateur (ex: Grand_Prix_de_Thaïlande)
                for (const gpName in grandsPrix) {
                    const dataGP = grandsPrix[gpName];
                    
                    // Addition des totaux Sprint et Race s'ils existent
                    if (dataGP.sprint && dataGP.sprint.total) {
                        totalSprint += parseInt(dataGP.sprint.total);
                    }
                    if (dataGP.race && dataGP.race.total) {
                        totalRace += parseInt(dataGP.race.total);
                    }
                }

                listeJoueurs.push({
                    pseudo: pseudo,
                    sprint: totalSprint,
                    race: totalRace,
                    total: totalSprint + totalRace
                });
            }

            // Tri par score total (du plus haut au plus bas)
            listeJoueurs.sort((a, b) => b.total - a.total);

            // Génération du HTML
            tbody.innerHTML = listeJoueurs.map((joueur, index) => {
                let medal = '🏅';
                if (index === 0) medal = '🥇';
                else if (index === 1) medal = '🥈';
                else if (index === 2) medal = '🥉';

                return `
                    <tr>
                        <td class="rank-col">${medal} ${index + 1}</td>
                        <td class="pseudo-col">${joueur.pseudo}</td>
                        <td class="points-col">${joueur.sprint > 0 ? '+' : ''}${joueur.sprint}</td>
                        <td class="points-col">${joueur.race > 0 ? '+' : ''}${joueur.race}</td>
                        <td class="total-col">${joueur.total > 0 ? '+' : ''}${joueur.total}</td>
                    </tr>
                `;
            }).join('');

            loadingEl.style.display = 'none';
            emptyEl.style.display = 'none';
            tableEl.style.display = 'table';
        } else {
            loadingEl.style.display = 'none';
            emptyEl.style.display = 'block';
        }
    } catch (e) {
        console.error("Erreur Firebase:", e);
        loadingEl.innerHTML = "❌ Erreur de connexion";
    }
}

    // --- MODAL CLASSEMENT ---
    const btnClassement = document.querySelector('.btn-classement'); 
    const modalClassement = document.getElementById('classement-modal');

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
    const sprintResultsRef = ref(db, `resultats/${raceKey}/sprint`);
    if (firebaseListeners[sprintKey]) firebaseListeners[sprintKey].unsubscribe?.();
    const unsubscribeSprint = onValue(sprintResultsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            sprintResults = data;
            afficherResultats('sprint', 'section-sprint');
            calculerPointsUtilisateur('sprint');
        }
    });
    firebaseListeners[sprintKey] = { unsubscribe: unsubscribeSprint };

    // Écouter résultats Race
    const raceResultsRef = ref(db, `resultats/${raceKey}/race`);
    if (firebaseListeners[raceResultsKey]) firebaseListeners[raceResultsKey].unsubscribe?.();
    const unsubscribeRace = onValue(raceResultsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            raceResults = data;
            afficherResultats('race', 'section-race');
            calculerPointsUtilisateur('race');
        }
    });
    firebaseListeners[raceResultsKey] = { unsubscribe: unsubscribeRace };

    // ------------------ Charger les scores ------------------
    chargerScoresUtilisateur();
}

// ===== FUNCTION: OBTENIR LA RACE COURANTE =====
function getRaceCourante() {
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
        div.textContent = `#${pilote.num} - ${pilote.nom}`;

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

    // Mobile
    card.addEventListener('touchstart', handleTouchStart, { passive: false });
    card.addEventListener('touchmove', handleTouchMove, { passive: false });
    card.addEventListener('touchend', handleTouchEnd);
}

// ===== DRAG & DROP HANDLERS =====
let draggedElement = null;
let draggedFromZone = null; // Permet de tracker si on drag d'une zone
let touchOffset = { x: 0, y: 0 };

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

function handleTouchStart(e) {
    if (e.target.closest('.pilote-card')) {
        draggedElement = e.target.closest('.pilote-card');
        draggedFromZone = draggedElement.closest('.step');
        
        // Empêcher le scroll pendant le drag
        e.preventDefault();

        const touch = e.touches[0];
        const rect = draggedElement.getBoundingClientRect();
        
        // Calculer l'offset pour que la carte reste sous le doigt exactement où on a touché
        touchOffset.x = touch.clientX - rect.left;
        touchOffset.y = touch.clientY - rect.top;

        draggedElement.style.position = 'fixed';
        draggedElement.style.zIndex = '1000';
        draggedElement.style.opacity = '0.8';
        draggedElement.style.pointerEvents = 'none'; // Important pour détecter ce qu'il y a DESSOUS
    }
}

function handleTouchMove(e) {
    if (!draggedElement) return;
    e.preventDefault();

    const touch = e.touches[0];
    
    // Déplacer l'élément
    draggedElement.style.left = (touch.clientX - touchOffset.x) + 'px';
    draggedElement.style.top = (touch.clientY - touchOffset.y) + 'px';

    // Simuler le "dragover" pour le retour visuel
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const zone = elementBelow?.closest('.step');

    // Nettoyer les autres zones
    document.querySelectorAll('.step').forEach(s => s.style.background = '');
    
    // Feedback visuel sur la zone survolée
    if (zone) {
        zone.style.background = 'rgba(225, 6, 0, 0.3)';
    }
}

function handleTouchEnd(e) {
    if (!draggedElement) return;

    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const zone = elementBelow?.closest('.step');
    const overList = elementBelow?.closest('.pilotes-list');

    // Réinitialiser le style visuel
    draggedElement.style.position = '';
    draggedElement.style.zIndex = '';
    draggedElement.style.opacity = '1';
    draggedElement.style.pointerEvents = 'auto';
    draggedElement.style.left = '';
    draggedElement.style.top = '';

    if (zone) {
        // On réutilise ta logique handleDrop existante en simulant l'objet zone
        handleDrop({ 
            preventDefault: () => {}, 
            currentTarget: zone 
        });
    } else if (overList || !zone) {
        // Logique de retour à la liste (ton code existant pour le retrait)
        retirerPilote(draggedElement, draggedFromZone);
    }

    draggedElement = null;
    draggedFromZone = null;
    document.querySelectorAll('.step').forEach(s => s.style.background = '');
}

// ===== FUNCTION: SETUP DROP ZONES =====
function retirerPilote(element, fromZone) {
    if (!element || !fromZone) return;

    const num = parseInt(element.dataset.num);
    const oldRank = fromZone.getAttribute('data-rank');
    const oldSectionId = fromZone.closest('[id^="section-"]')?.id;
    const oldType = oldSectionId === 'section-sprint' ? 'sprint' : 'race';
    const oldPredictions = oldType === 'sprint' ? sprintPredictions : racePredictions;

    delete oldPredictions[oldRank];
    
    const oldContent = fromZone.querySelector('.target-area');
    if (oldContent) oldContent.innerHTML = '';
    
    const placeholder = fromZone.querySelector('small');
    if (placeholder) placeholder.style.display = '';
    
    fromZone.classList.remove('used-crash');
    fromZone.style.background = '';

    // MAJ liste visuelle
    document.querySelectorAll('.pilotes-list .pilote-card').forEach((card) => {
        if (parseInt(card.dataset.num) === num) {
            card.classList.remove('used');
        }
    });
    
    mettreAJourAffichagePronostics();
}
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
    timerElement.classList.remove('hidden-timer');
    if (!timerElement) return;

    const raceCourante = getRaceCourante(); // Ta nouvelle fonction
    if (!raceCourante) return;

    // 1. Vérifier si on a déjà les résultats dans Firebase
    const results = type === 'sprint' ? sprintResults : raceResults;
    if (results && Object.keys(results).length > 0) {
        timerElement.innerHTML = "🏁 Course terminée";
        return;
    }

    // 2. Calculer si l'événement est déjà passé
    const dateEvent = new Date(type === 'sprint' ? raceCourante.sprint : raceCourante.race);
    const maintenant = new Date();

    if (maintenant > dateEvent) {
        // Si l'heure de départ est passée mais qu'on n'a pas encore les résultats
        timerElement.innerHTML = "🏃 En cours / En attente";
        timerElement.style.color = "#ffa500"; // Orange
    } else {
        // Sinon, on lance le compte à rebours normalement
        const timerKey = `timer_${type}_${currentRaceIndex}`;
        creerTimer(dateEvent, timerKey, timerElement);
    }
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

function obtenirNomPilote(num) {
    if (!num) return 'TBD';
    // On cherche le pilote dans DATA_PILOTES dont le num correspond
    const pilote = DATA_PILOTES.find(p => parseInt(p.num) === parseInt(num));
    return pilote ? pilote.nom : `Pilote #${num}`;
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
                <div><strong>🥇 </strong> ${obtenirNomPilote(sprintResults['1er'])}</div>
                <div><strong>🥈 </strong> ${obtenirNomPilote(sprintResults['2e'])}</div>
                <div><strong>🥉 </strong> ${obtenirNomPilote(sprintResults['3e'])}</div>
                <div><strong>💥 </strong> ${obtenirNomPilote(sprintResults['Chute'])}</div>
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
                <div><strong>🥇 </strong> ${obtenirNomPilote(raceResults['1er'])}</div>
                <div><strong>🥈 </strong> ${obtenirNomPilote(raceResults['2e'])}</div>
                <div><strong>🥉 </strong> ${obtenirNomPilote(raceResults['3e'])}</div>
                <div><strong>💥 </strong> ${obtenirNomPilote(raceResults['Chute'])}</div>
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

// ===== FUNCTION: CALCULER LES POINTS =====
async function calculerPointsUtilisateur(type) {

    const raceKey = raceCourante.gp.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
    const predRef = ref(db, `pronostics/${pseudo}/${raceKey}/${type}`);
    const resRef = ref(db, `resultats/${raceKey}/${type}`);
    console.log(`📊 Calcul des points pour ${pseudo} - ${type} (${raceKey})`);

    // 2. On récupère les snapshots
    const [predSnap, resSnap] = await Promise.all([get(predRef), get(resRef)]);

    if (!predSnap.exists() || !resSnap.exists()) {
        console.error("Données manquantes pour le calcul");
        return;
    }

    const predictions = predSnap.val();
    const results = resSnap.val();
    const podiumReel = [results['1er'], results['2e'], results['3e']];  
    const chuteReelle = results['Chute'];
    console.log("📋 Prédictions :", predictions);
    console.log("🎯 Résultats officiels :", results);
    console.log("🎯 Podium réel :", podiumReel);
    console.log("🎯 Chute réelle :", chuteReelle);
    let detailPoints = {
        "1er": 0,
        "2e": 0,
        "3e": 0,
        "Chute": 0,
        "total": 0
    };

    const pointsParPosition = { '1er': 3, '2e': 2, '3e': 1 };


    ['1er', '2e', '3e'].forEach(rank => {
        const predictedNum = predictions[rank];
        const indexReel = podiumReel.indexOf(predictedNum);

            if (indexReel === -1) {
                detailPoints[rank] = -3;
            } else {
                const placeReelle = ['1er', '2e', '3e'][indexReel];
                detailPoints[rank] = (placeReelle === rank) ? pointsParPosition[rank] : -1;
            }
        });
    // --- CHUTE ---
    if (predictions['Chute']) {
        const indexChute = chuteReelle.indexOf(predictions['Chute']);
        detailPoints['Chute'] = (indexChute !== -1) ? 1 : 0;
        }
    
    // Calcul du total
    detailPoints.total = detailPoints["1er"] + detailPoints["2e"] + detailPoints["3e"] + detailPoints["Chute"];

    console.log("📈 Détail calculé :", detailPoints);

    // --- SAUVEGARDE FIREBASE ---
    const raceId = raceCourante.gp.replace(/\s+/g, '_');
    // On enregistre l'objet COMPLET dans scores_details
    const scoreRef = ref(db, `scores_details/${pseudo}/${raceId}/${type}`);

    const snap = await get(scoreRef);
    if (!snap.exists()) {
        // Sauvegarde du détail (ton historique utilisera ça)
        await set(scoreRef, detailPoints);

        // Mise à jour du score global (cumulatif)
        const globalScoreRef = ref(db, 'scores/' + pseudo);
        const snapshot = await get(globalScoreRef);
        const scoreActuel = snapshot.val() || 0;
        const nouveauScore = scoreActuel + detailPoints.total;
        
        await set(globalScoreRef, nouveauScore);
        
        currentScores[pseudo] = nouveauScore;
        if (typeof afficherScore === 'function') afficherScore();
    }

    console.groupEnd();
}
// ===== FUNCTION: ÉDITER PRONOSTIC =====
function editerPronostic(type) {
    const path = getPronosticPath(type);
    if (!path) return;

    if (type === 'sprint') {
        sprintPredictions = {};
        sprintValide = false;
    } else {
        racePredictions = {};
        raceValide = false;
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
    if (typeof mettreAJourAffichagePronostics === 'function') mettreAJourAffichagePronostics();
}

// ===== FUNCTION: SETUP BUTTONS =====
function setupButtons() {
    // Validation
    const btnValiderSprint = document.getElementById('btn-valider-sprint');
    if (btnValiderSprint) btnValiderSprint.addEventListener('click', () => validerPronostic('sprint'));

    const btnValiderRace = document.getElementById('btn-valider-race');
    if (btnValiderRace) btnValiderRace.addEventListener('click', () => validerPronostic('race'));

    // --- MODALE DETAIL (LOUPE) ---
    const historyIcon = document.getElementById('open-history');
    const modalDetails = document.getElementById('modal-details');
    const closeDetails = document.getElementById('close-details-modal');

    if (historyIcon) {
        historyIcon.addEventListener('click', () => {
            afficherListeHistoriqueGP(); // Ouvre et charge la modale de détails
        });
    }
    document.getElementById('btn-back-history').addEventListener('click', () => {
    document.getElementById('history-title').innerText = "📊 Historique par GP";
        afficherListeHistoriqueGP();
    });
    window.afficherDetailPointsGP = afficherDetailPointsGP;

    if (closeDetails) {
        closeDetails.addEventListener('click', () => {
            modalDetails.style.display = 'none';
        });
    }

    // --- MODALE REGLES ---
    const btnRegles = document.getElementById('btn-regles');
    const modalRegles = document.getElementById('regles-modal');
    const closeRegles = document.getElementById('close-regles');

    if (btnRegles) {
        btnRegles.addEventListener('click', (e) => {
            e.preventDefault();
            modalRegles.classList.add('active');
        });
    }

    if (closeRegles) {
        closeRegles.addEventListener('click', () => {
            modalRegles.classList.remove('active');
        });
    }

    // --- MODALE HISTORIQUE (Ancienne liste) ---
    const modalHistorique = document.getElementById('history-modal');
    const closeHistoryList = document.getElementById('close-history-list');

    if (closeHistoryList) {
        closeHistoryList.addEventListener('click', () => {
            modalHistorique.classList.remove('active');
        });
    }

    // Fermeture universelle au clic extérieur
    window.addEventListener('click', (e) => {
        if (e.target === modalDetails) modalDetails.style.display = 'none';
        if (e.target === modalRegles) modalRegles.classList.remove('active');
        if (e.target === modalHistorique) modalHistorique.classList.remove('active');
    });
}
async function afficherListeHistoriqueGP() {
    const historyContainer = document.getElementById('history-items');
    const footer = document.getElementById('history-footer');
    const modal = document.getElementById('history-modal');
    
    modal.classList.add('active');
    footer.style.display = 'none';
    historyContainer.innerHTML = '<div class="loader">Chargement de l\'historique...</div>';

    try {
        // On récupère tous les scores calculés pour l'utilisateur
        const snapshot = await get(ref(db, `scores_details/${pseudo}`));
        
        if (!snapshot.exists()) {
            historyContainer.innerHTML = '<p class="no-data">Aucun historique disponible pour le moment.</p>';
            return;
        }

        const GPData = snapshot.val(); // Contient tous les GP : { "GP_Espagne": { "sprint": 2, "race": -1 }, ... }
        let html = '<div class="gp-history-grid">';

        Object.keys(GPData).forEach(raceId => {
            const nomPropre = raceId.replace(/_/g, ' ');
            const totalGP = (GPData[raceId].sprint || 0) + (GPData[raceId].race || 0);
            
            html += `
                <div class="gp-history-card" onclick="afficherDetailPointsGP('${raceId}')">
                    <div class="gp-card-info">
                        <strong>${nomPropre}</strong>
                        <span>Score total: ${totalGP > 0 ? '+' + totalGP : totalGP} pts</span>
                    </div>
                    <div class="gp-card-arrow">🔍</div>
                </div>`;
        });

        html += '</div>';
        historyContainer.innerHTML = html;

    } catch (error) {
        console.error(error);
        historyContainer.innerHTML = '<p class="no-data">Erreur de chargement.</p>';
    }
}

// ===== FUNCTION: AFFICHER DETAIL POINTS (MODALE LOUPE) =====
async function afficherDetailPointsGP(raceId) {
    const historyContainer = document.getElementById('history-items');
    const footer = document.getElementById('history-footer');
    const title = document.getElementById('history-title');
    
    footer.style.display = 'block';
    title.innerText = `Détail : ${raceId.replace(/_/g, ' ')}`;
    historyContainer.innerHTML = '<div class="loader">Chargement du détail...</div>';

    try {
        let tableHtml = `<table class="detail-score-table">
            <thead>
                <tr>
                    <th>Session</th>
                    <th>Pari</th>
                    <th>Pilote</th>
                    <th>Points</th>
                </tr>
            </thead>
            <tbody>`;

        const types = ['sprint', 'race'];

        for (const type of types) {
            // 1. On récupère les pronos (pour avoir les noms des pilotes)
            // 2. On récupère les scores déjà calculés (dans scores_details)
            const [snapPred, snapScore] = await Promise.all([
                get(ref(db, `pronostics/${pseudo}/${raceId}/${type}`)),
                get(ref(db, `scores_details/${pseudo}/${raceId}/${type}`))
            ]);

            if (snapPred.exists() && snapScore.exists()) {
                const preds = snapPred.val();
                const pointsEnregistres = snapScore.val(); // Contient { "1er": 3, "2e": -1, ... }

                ['1er', '2e', '3e', 'Chute'].forEach(pos => {
                    if (preds[pos] === undefined) return;

                    // Trouver le nom du pilote via son numéro stocké dans le prono
                    const pilote = DATA_PILOTES.find(p => parseInt(p.num) === preds[pos]);
                    const nom = pilote ? pilote.nom : 'Inconnu';
                    
                    // On récupère le point directement depuis l'objet sauvegardé
                    const pts = pointsEnregistres[pos] || 0;

                    tableHtml += `
                        <tr>
                            <td><strong>${type.toUpperCase()}</strong></td>
                            <td>${pos}</td>
                            <td>${nom}</td>
                            <td class="${pts > 0 ? 'pts-positive' : (pts < 0 ? 'pts-negative' : 'pts-zero')}">
                                ${pts > 0 ? '+' + pts : pts} pts
                            </td>
                        </tr>`;
                });
                
                // Optionnel : Ajouter une ligne de sous-total pour la session
                tableHtml += `
                    <tr class="subtotal-row">
                        <td colspan="3">Sous-total ${type}</td>
                        <td><strong>${pointsEnregistres.total > 0 ? '+' + pointsEnregistres.total : pointsEnregistres.total}</strong></td>
                    </tr>`;
            }
        }

        tableHtml += '</tbody></table>';
        historyContainer.innerHTML = tableHtml;

    } catch (error) {
        console.error("Erreur historique détail:", error);
        historyContainer.innerHTML = '<p class="no-data">Erreur lors de la récupération du détail.</p>';
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
        alert(`✅ Vos pronostics ${type.toUpperCase()} ont été sauvegardés!`);

        if (type === 'sprint') sprintValide = true;
        if (type === 'race') raceValide = true;

        if (typeof mettreAJourAffichagePronostics === 'function') mettreAJourAffichagePronostics();
        afficherRecap(type);
        updateSectionsVisibility();

        const results = type === 'sprint' ? sprintResults : raceResults;
        if (results && results['1er']) {
            calculerPointsUtilisateur(type);
        }
    });
}
}
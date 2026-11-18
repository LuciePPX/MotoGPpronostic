import { DATA_PILOTES, DATA_CALENDRIER } from './config.js';
import { ref, set, get, onValue, query, orderByValue, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from './firebase-init.js';
import { normaliser } from './utils.js';
import { afficherCoursePrecedente, obtenirNomPilote, obtenirNomsChutes } from './resultats.js';
import { initPreferences } from './prefs.js';
import { initPaddock } from './paddock.js';
import { setupModals } from './classement.js';
import { etat, getRaceCourante } from './etat.js';
import { demarrerTimer, creerTimer } from './timer.js';
import { lireScoreJoueur, afficherScoreGeneral, chargerTop3 } from './score.js';
import { afficherProchainesCourses } from './courses.js';
import { genererPilotes, setupRecherche, estUtilise, rafraichirPilotesUtilises } from './pilotes.js';
import { attachDragListeners, setupDropZones, initClickAndSelect } from './glisser.js';
import { chargerPronosticsUtilisateur, afficherPiloteEnZone, afficherRecap, mettreAJourAffichagePronostics, updateSectionsVisibility, validerPronostic } from './pronostics.js';

// ===== GLOBAL STATE =====
let pseudo = '';
let sprintResults = {};
let raceResults = {};
let currentScores = {};
let currentRaceIndex = 0; // Index de la course actuelle dans le calendrier
let timerIntervals = {}; // Stockage des intervalles de timer
let firebaseListeners = {}; // Stockage des écouteurs Firebase


// ===== DÉMARRAGE APRÈS CONNEXION =====
// auth-ui.js envoie cet événement quand le joueur est connecté
let jeuDemarre = false;

document.addEventListener('joueur-connecte', (e) => {
    if (jeuDemarre) return; // Évite de lancer le jeu deux fois
    jeuDemarre = true;

    pseudo = e.detail.pseudo;
    document.getElementById('welcome-title').textContent = `Bienvenue ${pseudo} !`;

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    initialiserJeu();
    initPreferences(pseudo);
    initPaddock();
});

// ___ FUNCTION: cleanning ___
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

// ===== FUNCTION: INITIALISER JEU =====
function initialiserJeu() {

    etat.rafraichirRecap = () => { afficherRecap('sprint'); afficherRecap('race'); };
    chargerDonneesFirebase();
    afficherProchainesCourses();
    afficherCoursePrecedente();
    genererPilotes();
    setupRecherche();  
    afficherScoreGeneral(currentScores[pseudo] || 0);
    setupDropZones();
    initClickAndSelect();
    setupButtons();
    setupModals();
    chargerScoreUtilisateur();
    chargerTop3();


    // Démarrer/Charger timers 
    demarrerTimer('sprint', 'section-sprint');
    demarrerTimer('race', 'section-race');
}


// ____ FUNCTION: firebase data load ____ 

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
        etat.sprintPredictions = data.sprint || {};
        etat.racePredictions = data.race || {};

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

    // Résultats sprint : affichés si présents, sinon le compte à rebours est lancé
    const unsubscribeSprint = onValue(sprintResultsRef, (snapshot) => {
        sprintResults = snapshot.val() || {};
        if (Object.keys(sprintResults).length > 0) {
            afficherResultats('sprint', 'section-sprint');
        } else {
            demarrerTimer('sprint', 'section-sprint');
        }
    });
    firebaseListeners[sprintKey] = { unsubscribe: unsubscribeSprint };

    // Écouter résultats Race
    const raceResultsRef = ref(db, `resultats/${raceKey}/race`);
    if (firebaseListeners[raceResultsKey]) firebaseListeners[raceResultsKey].unsubscribe?.();
    // Résultats course : même logique
    const unsubscribeRace = onValue(raceResultsRef, (snapshot) => {
        raceResults = snapshot.val() || {};
        if (Object.keys(raceResults).length > 0) {
            afficherResultats('race', 'section-race');
        } else {
            demarrerTimer('race', 'section-race');
        }
    });
    firebaseListeners[raceResultsKey] = { unsubscribe: unsubscribeRace };

    // ------------------ Charger les scores ------------------
    chargerScoreUtilisateur();
}


// ____ FUNCTION: load officals results ____
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
                <div><strong>💥 </strong> ${obtenirNomsChutes(sprintResults['Chute'])}</div>
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
                <div><strong>💥 </strong> ${obtenirNomsChutes(raceResults['Chute'])}}</div>
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



// ===== FUNCTION: SETUP BUTTONS =====
function setupButtons() {
    // Validation
    const btnValiderSprint = document.getElementById('btn-valider-sprint');
    if (btnValiderSprint) btnValiderSprint.addEventListener('click', () => validerPronostic('sprint'));

    const btnValiderRace = document.getElementById('btn-valider-race');
    if (btnValiderRace) btnValiderRace.addEventListener('click', () => validerPronostic('race'));


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

    // Fermeture universelle au clic extérieur
    window.addEventListener('click', (e) => {
        if (e.target === modalRegles) modalRegles.classList.remove('active');
    });
}

// ===== FUNCTION: CHARGER LE SCORE DU JOUEUR =====
async function chargerScoreUtilisateur() {
    currentScores[pseudo] = await lireScoreJoueur(pseudo);
    afficherScoreGeneral(currentScores[pseudo]);
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
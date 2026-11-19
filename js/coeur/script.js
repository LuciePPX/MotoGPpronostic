
import { ref, onValue} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from './firebase-init.js';
import { afficherCoursePrecedente, chargerResultatsOfficiels, afficherResultats } from '../resultats/resultats.js';
import { initPreferences } from '../notifications/prefs.js';
import { initPaddock } from '../resultats/paddock.js';
import { setupModals } from '../resultats/classement.js';
import { etat, getRaceCourante } from './etat.js';
import { demarrerTimer, creerTimer } from '../jeu/timer.js';
import { afficherScoreGeneral, chargerTop3, chargerScoreUtilisateur } from '../resultats/score.js';
import { afficherProchainesCourses } from '../jeu/courses.js';
import { genererPilotes, setupRecherche } from '../jeu/pilotes.js';
import { setupDropZones, initClickAndSelect } from '../jeu/glisser.js';
import { chargerPronosticsUtilisateur, afficherRecap, validerPronostic } from '../jeu/pronostics.js';

// ===== GLOBAL STATE =====
let pseudo = '';
let timerIntervals = {}; // Stockage des intervalles de timer
let firebaseListeners = {}; // Stockage des écouteurs Firebase


// ===== DÉMARRAGE APRÈS CONNEXION =====
// auth-ui.js envoie cet événement quand le joueur est connecté
let jeuDemarre = false;

document.addEventListener('joueur-connecte', (e) => {
    if (jeuDemarre) return; // Évite de lancer le jeu deux fois
    jeuDemarre = true;

    pseudo = e.detail.pseudo;
    etat.pseudo = pseudo
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
    afficherScoreGeneral(etat.currentScores[etat.pseudo] || 0);
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
        etat.sprintResults = snapshot.val() || {};
        if (Object.keys(etat.sprintResults).length > 0) {
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
        etat.raceResults = snapshot.val() || {};
        if (Object.keys(etat.raceResults).length > 0) {
            afficherResultats('race', 'section-race');
        } else {
            demarrerTimer('race', 'section-race');
        }
    });
    firebaseListeners[raceResultsKey] = { unsubscribe: unsubscribeRace };

    // ------------------ Charger les scores ------------------
    chargerScoreUtilisateur();
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



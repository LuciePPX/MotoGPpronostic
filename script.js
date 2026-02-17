// 1. IMPORTS (TOUJOURS EN HAUT)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { DATA_PILOTES, DATA_CALENDRIER } from "./config.js";

// 2. CONFIGURATION FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAlWxI_w2R6eyJYBg9h_ynHWAgz3VS51Zk",
    authDomain: "motogppronostic.firebaseapp.com",
    databaseURL: "https://motogppronostic-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "motogppronostic",
    storageBucket: "motogppronostic.firebasestorage.app",
    messagingSenderId: "1093723718276",
    appId: "1:1093723718276:web:51b754c96ceacd589638d1",
    measurementId: "G-D9M06ECP07"
};

// 3. INITIALISATION
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let pilotesUtilises = [];
let pseudoGlobal = "";
let currentRaceTime = null; // Heure de clôture actuelle
let isEditingMode = false; // Mode édition
let editingType = null; // Sprint ou Race

// --- SCORE CARD & HISTORIQUE ---
async function mettreAJourScoreCard() {
    if (!pseudoGlobal) return;
    
    const snapshot = await get(ref(db, 'scores/' + pseudoGlobal));
    if (snapshot.exists()) {
        const data = snapshot.val();
        const total = data.total || 0;
        
        // Afficher le score principal
        const mainScoreEl = document.getElementById('main-score-display');
        if (mainScoreEl) {
            mainScoreEl.innerText = total > 0 ? `+${total}` : total;
        }
    }
    
    // Charger le nom du GP actuel
    const maintenant = new Date();
    const futureRace = DATA_CALENDRIER.find(r => new Date(r.race) > maintenant);
    if (futureRace) {
        const gpNameEl = document.getElementById('current-gp-name');
        if (gpNameEl) {
            gpNameEl.innerText = futureRace.gp;
        }
    }
    
    // Charger les 3 derniers GPs
    await afficherDerniersScores();
}

async function afficherDerniersScores() {
    if (!pseudoGlobal) return;
    
    const snapshot = await get(ref(db, 'historique/' + pseudoGlobal));
    let courses = [];
    
    if (snapshot.exists()) {
        const data = snapshot.val();
        courses = Object.entries(data).map(([gp, score]) => ({ gp, score }));
    }
    
    // Prendre les 3 derniers
    const derniers = courses.slice(-3).reverse();
    
    const container = document.getElementById('last-three-scores');
    if (container) {
        container.innerHTML = '';
        derniers.forEach(item => {
            const div = document.createElement('div');
            div.className = 'score-small';
            div.innerHTML = `<div>${item.score > 0 ? '+' : ''}${item.score}</div><div class="score-small-label">${item.gp.substring(0, 3)}</div>`;
            container.appendChild(div);
        });
    }
}

async function chargerHistoriqueScores() {
    if (!pseudoGlobal) return;
    
    const snapshot = await get(ref(db, 'historique/' + pseudoGlobal));
    let courses = [];
    
    if (snapshot.exists()) {
        const data = snapshot.val();
        courses = Object.entries(data).map(([gp, score]) => ({ gp, score }));
    }
    
    const container = document.getElementById('history-items');
    if (container) {
        container.innerHTML = '';
        if (courses.length === 0) {
            container.innerText = 'Aucun résultat enregistré';
            return;
        }
        
        courses.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <span class="history-item-name">${item.gp}</span>
                <span class="history-item-score">${item.score > 0 ? '+' : ''}${item.score}</span>
            `;
            container.appendChild(div);
        });
    }
}

// --- 0. SYSTÈME DE POINTS ---
function calculerPoints(prono, resultat) {
    let points = 0;

    // 1. Vérifier la chute
    if (prono["Chute"] === resultat["Chute"]) {
        points += 1;
    }

    // 2. Vérifier le podium 1er, 2e, 3e
    if (prono["1er"] === resultat["1er"]) {
        points += 3; // Exactement bon en 1ère place
    } else if (prono["1er"] !== "---") {
        // Chercher si le pilote est ailleurs dans le podium
        if (prono["1er"] === resultat["2e"] || prono["1er"] === resultat["3e"]) {
            points += 1; // Bon pilote, mauvaise place
        } else if (![resultat["1er"], resultat["2e"], resultat["3e"]].includes(prono["1er"])) {
            points += 3; // Pilote n'apparait pas sur le podium
        }
    }

    if (prono["2e"] === resultat["2e"]) {
        points += 2; // Exactement bon en 2ème place
    } else if (prono["2e"] !== "---") {
        if (prono["2e"] === resultat["1er"] || prono["2e"] === resultat["3e"]) {
            points += 1; // Bon pilote, mauvaise place
        } else if (![resultat["1er"], resultat["2e"], resultat["3e"]].includes(prono["2e"])) {
            points += 3;
        }
    }

    if (prono["3e"] === resultat["3e"]) {
        points += 1; // Exactement bon en 3ème place
    } else if (prono["3e"] !== "---") {
        if (prono["3e"] === resultat["1er"] || prono["3e"] === resultat["2e"]) {
            points += 1; // Bon pilote, mauvaise place
        } else if (![resultat["1er"], resultat["2e"], resultat["3e"]].includes(prono["3e"])) {
            points += 3;
        }
    }

    return points;
}

async function enregistrerPoints(pseudo, type, points) {
    try {
        // Récupérer les scores existants
        const snapshot = await get(ref(db, 'scores/' + pseudo));
        let totalScore = 0;
        let courseScores = {};

        if (snapshot.exists()) {
            const data = snapshot.val();
            totalScore = data.total || 0;
            courseScores = data.courses || {};
        }

        // Ajouter les nouveaux points
        courseScores[type] = points;
        totalScore += points;

        // Sauvegarder
        await set(ref(db, 'scores/' + pseudo), {
            total: totalScore,
            courses: courseScores,
            lastUpdated: new Date().toISOString()
        });

        return totalScore;
    } catch (e) {
        console.error("Erreur lors de l'enregistrement des points:", e);
        return 0;
    }
}

function estCourseBloqueee(raceTime) {
    const now = new Date();
    return now > new Date(raceTime);
}

function bloquerZoneSaisie(estBloqueee) {
    const steps = document.querySelectorAll('.step');
    steps.forEach(step => {
        if (estBloqueee) {
            step.classList.add('locked');
            step.draggable = false;
        } else {
            step.classList.remove('locked');
        }
    });

    const pilotes = document.querySelectorAll('.pilote-card');
    pilotes.forEach(p => {
        p.draggable = !estBloqueee;
    });

    const btnSprint = document.getElementById('btn-valider-sprint');
    const btnRace = document.getElementById('btn-valider-race');
    if (btnSprint) btnSprint.disabled = estBloqueee;
    if (btnRace) btnRace.disabled = estBloqueee;
}

function verifierEtatCourse() {
    if (currentRaceTime && estCourseBloqueee(currentRaceTime)) {
        bloquerZoneSaisie(true);
        const banner = document.getElementById('main-banner');
        if (banner) banner.innerText = "🏁 Saisies fermées - Course en cours!";
    } else {
        bloquerZoneSaisie(false);
    }
}

// Fonction pour afficher/masquer les boutons d'édition et gérer la visibilité des sections
async function mettreAJourAffichagePronostics() {
    const sprintContainer = document.getElementById('btn-edit-sprint-container');
    const raceContainer = document.getElementById('btn-edit-race-container');
    
    if (!pseudoGlobal) return;
    
    const pronosSnapshot = await get(ref(db, 'pronos/' + pseudoGlobal));
    const sprintFait = pronosSnapshot.exists() && pronosSnapshot.val().Sprint;
    const raceFait = pronosSnapshot.exists() && pronosSnapshot.val().Race;
    
    // Déterminer si on peut modifier (timer pas dépassé)
    const peutModifier = currentRaceTime && !estCourseBloqueee(currentRaceTime);
    
    // Afficher/masquer les boutons d'édition
    if (sprintContainer) {
        if (sprintFait && peutModifier) {
            sprintContainer.innerHTML = '<button class="btn-modifier" id="btn-edit-sprint">📝 Modifier</button>';
            document.getElementById('btn-edit-sprint').onclick = () => editerPronostic('Sprint');
        } else {
            sprintContainer.innerHTML = '';
        }
    }
    
    if (raceContainer) {
        if (raceFait && peutModifier) {
            raceContainer.innerHTML = '<button class="btn-modifier" id="btn-edit-race">📝 Modifier</button>';
            document.getElementById('btn-edit-race').onclick = () => editerPronostic('Race');
        } else {
            raceContainer.innerHTML = '';
        }
    }
    
    // Cacher la section pronostics si les deux sont faits
    const pilotesSection = document.querySelector('.pilotes-section');
    const mainBanner = document.getElementById('main-banner');
    const podiumsWrapper = document.querySelector('.podiums-wrapper');
    
    if (sprintFait && raceFait && !isEditingMode) {
        if (pilotesSection) pilotesSection.classList.add('hidden');
        if (podiumsWrapper) podiumsWrapper.classList.add('hidden');
        if (mainBanner) mainBanner.classList.add('hidden');
    } else if (!isEditingMode) {
        if (pilotesSection) pilotesSection.classList.remove('hidden');
        if (mainBanner) mainBanner.classList.remove('hidden');
    }
}

// --- 1. GESTION DU JEU ---

// Fonction pour éditer un pronostic existant
async function editerPronostic(type) {
    isEditingMode = true;
    editingType = type;
    
    const pronosSnapshot = await get(ref(db, 'pronos/' + pseudoGlobal + '/' + type));
    if (!pronosSnapshot.exists()) return alert("Pronostic non trouvé !");
    
    const choix = pronosSnapshot.val().choix;
    
    // Afficher la section correspondante
    const containerId = type === 'Sprint' ? 'section-sprint' : 'section-race';
    const container = document.getElementById(containerId);
    if (container) container.classList.remove('hidden');
    
    // Cacher l'autre section si elle existe
    const otherContainerId = type === 'Sprint' ? 'section-race' : 'section-sprint';
    const otherContainer = document.getElementById(otherContainerId);
    if (otherContainer) otherContainer.classList.add('hidden');
    
    // Réinitialiser les listes de pilotes
    pilotesUtilises = [];
    
    // Vider toutes les zones de la section
    const steps = document.querySelectorAll(`#${containerId} .step`);
    steps.forEach(step => {
        viderZone(step);
    });
    
    // Régénérer la liste des pilotes
    genererPilotes();
    
    // Charger les anciens choix dans les zones de drag & drop
    steps.forEach(step => {
        const rank = step.dataset.rank;
        if (choix[rank] && choix[rank] !== "---") {
            // Trouver le pilote correspondant
            const pilote = DATA_PILOTES.find(p => p.nom === choix[rank]);
            if (pilote) {
                const sid = `p-${pilote.num}`;
                placerPilote(step, choix[rank], sid);
            }
        }
    });
    
    // Afficher la bannière appropriée
    const currentTitle = document.getElementById('current-title');
    if (currentTitle) {
        currentTitle.innerText = type === 'Sprint' ? "Modifier votre SPRINT" : "Modifier votre GRAND PRIX";
    }
    
    // Afficher la section de drag and drop et les pilotes
    const pilotesSection = document.querySelector('.pilotes-section');
    if (pilotesSection) pilotesSection.classList.remove('hidden');
    
    const podiumsWrapper = document.querySelector('.podiums-wrapper');
    if (podiumsWrapper) podiumsWrapper.classList.remove('hidden');
}

async function commencerJeu() {
    const pseudo = document.getElementById('pseudo-input').value.trim();
    if (!pseudo) return alert("Pseudo requis !");
    pseudoGlobal = pseudo;
    
    document.getElementById('welcome-title').innerText = `Pilote : ${pseudo}`;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    const snapshot = await get(ref(db, 'pronos/' + pseudo));
    if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.Sprint) afficherRecapVisuel('recap-sprint', data.Sprint.choix);
        if (data.Race) afficherRecapVisuel('recap-race', data.Race.choix);
    }

    chargerCalendrier();
    genererPilotes();
    initDragAndDrop();
    chargerResultatsOfficiels();
    chargerScorePersonnel();
    mettreAJourAffichagePronostics();
}

// --- 2. CALENDRIER ET TIMER ---
function chargerCalendrier() {
    const maintenant = new Date();
    const futureRace = DATA_CALENDRIER.find(r => new Date(r.race) > maintenant);

    if (futureRace) {
        const raceNameEl = document.getElementById('race-name');
        const raceCircuitEl = document.getElementById('race-circuit');
        const raceDateEl = document.getElementById('race-date-formatted');
        const circuitImageEl = document.getElementById('circuit-image');

        if(raceNameEl) raceNameEl.textContent = futureRace.gp;
        if(raceCircuitEl) raceCircuitEl.textContent = futureRace.circuit;
        
        if(raceDateEl) {
            const options = { day: 'numeric', month: 'long', year: 'numeric' };
            const dateObj = new Date(futureRace.race);
            raceDateEl.textContent = dateObj.toLocaleDateString('fr-FR', options);
        }

        // Charger l'image du circuit
        if (circuitImageEl && futureRace.image) {
            circuitImageEl.src = futureRace.image;
            circuitImageEl.alt = futureRace.circuit;
        }

        // Afficher le nom du GP dans le score card
        const gpNameEl = document.getElementById('current-gp-name');
        if (gpNameEl) {
            gpNameEl.innerText = futureRace.gp;
        }

        const statsContent = document.getElementById('stats-content');
        if (statsContent && futureRace.stats2025) {
            statsContent.innerHTML = `
                <strong>Stats 2025 :</strong><br>
                Pole : ${futureRace.stats2025.pole}<br>
                Vainqueur : ${futureRace.stats2025.vainqueurGP}
            `;
        }

        // Définir l'heure de clôture du Sprint
        currentRaceTime = new Date(futureRace.sprint);
        
        // Lancer les deux timers
        demarrerTimer(new Date(futureRace.sprint), 'timer-sprint');
        demarrerTimer(new Date(futureRace.race), 'timer-race');
        verifierEtatCourse();
    }
}

function demarrerTimer(cible, id) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let hasStarted = false; // Pour déterminer quand la session commence
    
    const updateTimer = () => {
        const maintenant = new Date();
        const diff = cible - maintenant;
        if (diff <= 0) {
            el.innerHTML = `<span style="color: #ff4444;">🏁 SESSION EN COURS</span>`;
            // Quand le timer passe 0, mettre à jour l'affichage des boutons
            if (!hasStarted) {
                hasStarted = true;
                mettreAJourAffichagePronostics();
            }
            return;
        }
        const j = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        el.textContent = `${j}j ${h}h ${m}m ${s}s`;
    };
    updateTimer();
    setInterval(updateTimer, 1000);
}

// --- 3. DRAG & DROP ---
function genererPilotes() {
    const list = document.getElementById('pilotes-list');
    if (!list) return;
    list.innerHTML = '';
    DATA_PILOTES.forEach(p => {
        const div = document.createElement('div');
        div.className = 'pilote-card';
        div.id = `p-${p.num}`;
        div.draggable = true;
        div.innerHTML = `<span class="num">#${p.num}</span> ${p.nom}`;
        if (pilotesUtilises.includes(p.nom)) div.classList.add('used');
        div.addEventListener('dragstart', e => {
            e.dataTransfer.setData('nom', p.nom);
            e.dataTransfer.setData('sid', div.id);
            e.dataTransfer.setData('fromPodium', 'false');
        });
        list.appendChild(div);
    });
}

function initDragAndDrop() {
    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', e => {
        if (e.dataTransfer.getData('fromPodium') === 'true') {
            resetPilote(e.dataTransfer.getData('sid'));
        }
    });

    document.querySelectorAll('.step').forEach(step => {
        step.addEventListener('dragover', e => e.preventDefault());
        step.addEventListener('drop', e => {
            e.preventDefault();
            const nom = e.dataTransfer.getData('nom');
            const sid = e.dataTransfer.getData('sid');
            const fromPodium = e.dataTransfer.getData('fromPodium') === 'true';
            if (!fromPodium && pilotesUtilises.includes(nom)) return;
            if (fromPodium) {
                const sourceStep = document.querySelector(`[data-cid="${sid}"]`);
                if (sourceStep && sourceStep !== step) viderZone(sourceStep);
            }
            const oldCard = step.querySelector('.pilote-card');
            if (oldCard) {
                const oldNom = oldCard.innerText.replace(/#\d+\s/, "").trim();
                pilotesUtilises = pilotesUtilises.filter(n => n !== oldNom);
                const oldId = step.dataset.cid;
                if(document.getElementById(oldId)) document.getElementById(oldId).classList.remove('used');
            }
            placerPilote(step, nom, sid);
        });
    });
}

function placerPilote(step, nom, sid) {
    if (!pilotesUtilises.includes(nom)) pilotesUtilises.push(nom);
    const originalCard = document.getElementById(sid);
    if (originalCard) originalCard.classList.add('used');
    step.dataset.cid = sid;
    const rank = step.dataset.rank;
    const numStr = originalCard ? originalCard.querySelector('.num').innerText : "#??";
    const cardHTML = `<div class="pilote-card" draggable="true"><span class="num">${numStr}</span> ${nom}</div>`;
    step.innerHTML = (rank === "Chute") ? cardHTML : `<span>${rank}</span><div class="target-area">${cardHTML}</div>`;
    if (rank === "Chute") step.classList.add('used-crash');
    const dragCard = step.querySelector('.pilote-card');
    dragCard.addEventListener('dragstart', e => {
        e.dataTransfer.setData('nom', nom);
        e.dataTransfer.setData('sid', sid);
        e.dataTransfer.setData('fromPodium', 'true');
    });
}

function viderZone(step) {
    const rank = step.dataset.rank;
    step.innerHTML = (rank === "Chute") ? `<small>Glisser ici</small>` : `<span>${rank}</span><div class="target-area"><small>Glisser ici</small></div>`;
    step.classList.remove('used-crash');
    delete step.dataset.cid;
}

function resetPilote(sid) {
    const step = document.querySelector(`[data-cid="${sid}"]`);
    if (step) {
        const nomElement = step.querySelector('.pilote-card');
        if (nomElement) {
            const nom = nomElement.innerText.replace(/#\d+\s/, "").trim();
            pilotesUtilises = pilotesUtilises.filter(n => n !== nom);
        }
        const original = document.getElementById(sid);
        if(original) original.classList.remove('used');
        viderZone(step);
    }
}

// --- 4. VALIDATION ---
function validerCourse(type) {
    const containerId = type === 'Sprint' ? 'section-sprint' : 'section-race';
    const steps = document.querySelectorAll(`#${containerId} .step`);
    let res = {};
    steps.forEach(s => {
        const card = s.querySelector('.pilote-card');
        res[s.dataset.rank] = card ? card.innerText.replace(/#\d+\s/, "").trim() : "---";
    });
    if (res["1er"] === "---") return alert("Podium incomplet !");
    set(ref(db, 'pronos/' + pseudoGlobal + '/' + type), {
        choix: res,
        timestamp: new Date().toISOString()
    }).then(() => {
        afficherRecapVisuel(`recap-${type.toLowerCase()}`, res);
        document.getElementById(containerId).classList.add('hidden');
        
        // Si on était en mode édition
        if (isEditingMode && editingType === type) {
            isEditingMode = false;
            editingType = null;
            // Réafficher les sections appropriées
            mettreAJourAffichagePronostics();
        } else {
            // Mode création normal
            if (type === 'Sprint') {
                document.getElementById('section-race').classList.remove('hidden');
                document.getElementById('current-title').innerText = "Choisissez pour le GRAND PRIX";
                pilotesUtilises = [];
                genererPilotes();
            } else {
                const sectionPilotes = document.querySelector('.pilotes-section');
                if(sectionPilotes) sectionPilotes.classList.add('hidden');
                document.getElementById('main-banner').innerText = "✅ Pronostics enregistrés !";
                // Mettre à jour l'affichage des boutons d'édition
                mettreAJourAffichagePronostics();
            }
        }
    });
}

function afficherRecapVisuel(id, choix) {
    const el = document.getElementById(id);
    if(el) el.innerHTML = `🥇 ${choix["1er"]} | 🥈 ${choix["2e"]} | 🥉 ${choix["3e"]} | ⚠️ ${choix["Chute"]}`;
}

function chargerResultatsOfficiels() {
    onValue(ref(db, 'resultats/'), async (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const offSprint = document.getElementById('official-sprint');
            const offRace = document.getElementById('official-race');
            if (data.Sprint && offSprint) offSprint.innerHTML = `🥇 ${data.Sprint["1er"]} | 🥈 ${data.Sprint["2e"]} | 🥉 ${data.Sprint["3e"]} | ⚠️ ${data.Sprint["Chute"]}`;
            if (data.Race && offRace) offRace.innerHTML = `🥇 ${data.Race["1er"]} | 🥈 ${data.Race["2e"]} | 🥉 ${data.Race["3e"]} | ⚠️ ${data.Race["Chute"]}`;

            // Calculer les points pour le joueur actuel
            if (pseudoGlobal) {
                const pronosSnapshot = await get(ref(db, 'pronos/' + pseudoGlobal));
                if (pronosSnapshot.exists()) {
                    const pronos = pronosSnapshot.val();
                    
                    // Calculer points Sprint
                    if (data.Sprint && pronos.Sprint) {
                        const pointsSprint = calculerPoints(pronos.Sprint.choix, data.Sprint);
                        await enregistrerPoints(pseudoGlobal, 'Sprint', pointsSprint);
                    }
                    
                    // Calculer points Race
                    if (data.Race && pronos.Race) {
                        const pointsRace = calculerPoints(pronos.Race.choix, data.Race);
                        await enregistrerPoints(pseudoGlobal, 'Race', pointsRace);
                    }
                }
            }
        }
    });
}

async function chargerScorePersonnel() {
    if (!pseudoGlobal) return;
    
    onValue(ref(db, 'scores/' + pseudoGlobal), (snapshot) => {
        const scoreEl = document.getElementById('user-score');
        const detailsEl = document.getElementById('score-details');
        const mainScoreEl = document.getElementById('main-score-display');
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            const total = data.total || 0;
            const courses = data.courses || {};
            
            scoreEl.innerHTML = `${total > 0 ? '+' : ''}${total} <span style="font-size: 0.6em;">pts</span>`;
            detailsEl.innerHTML = `Sprint: ${courses.Sprint || 0 > 0 ? '+' : ''}${courses.Sprint || 0} | Race: ${courses.Race || 0 > 0 ? '+' : ''}${courses.Race || 0}`;
            
            // Mettre à jour le score card principal
            if (mainScoreEl) {
                mainScoreEl.innerText = total > 0 ? `+${total}` : total;
            }
            
            // Mettre à jour les 3 derniers scores
            afficherDerniersScores();
        } else {
            scoreEl.innerHTML = '0 <span style="font-size: 0.6em;">pts</span>';
            detailsEl.innerHTML = 'En attente de résultats...';
            if (mainScoreEl) mainScoreEl.innerText = '0';
        }
    });
}

// --- 5. ADMIN SÉCURISÉ ---
function remplirListesPilotes() {
    const selects = ["res-1", "res-2", "res-3", "res-chute"];
    const testEl = document.getElementById(selects[0]);
    if (!testEl) return; // Sécurité : On quitte si les éléments n'existent pas

    const pilotesTries = [...DATA_PILOTES].sort((a, b) => a.nom.localeCompare(b.nom));
    selects.forEach(id => {
        const selectEl = document.getElementById(id);
        if (selectEl) {
            selectEl.innerHTML = '<option value="">-- Choisir un pilote --</option>';
            pilotesTries.forEach(p => {
                const option = document.createElement('option');
                option.value = p.nom;
                option.textContent = `#${p.num} - ${p.nom}`;
                selectEl.appendChild(option);
            });
        }
    });
}

// --- 6. INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Boutons de la page Jeu
    const btnRejoindre = document.getElementById('btn-rejoindre');
    if (btnRejoindre) btnRejoindre.onclick = commencerJeu;

    const btnValSprint = document.getElementById('btn-valider-sprint');
    if (btnValSprint) btnValSprint.onclick = () => validerCourse('Sprint');

    const btnValRace = document.getElementById('btn-valider-race');
    if (btnValRace) btnValRace.onclick = () => validerCourse('Race');

    // Gestion du modal d'historique
    const openHistoryBtn = document.getElementById('open-history');
    const closeHistoryBtn = document.getElementById('close-history');
    const historyModal = document.getElementById('history-modal');
    
    if (openHistoryBtn) {
        openHistoryBtn.addEventListener('click', () => {
            chargerHistoriqueScores();
            if (historyModal) historyModal.classList.add('active');
        });
    }
    
    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', () => {
            if (historyModal) historyModal.classList.remove('active');
        });
    }
    
    if (historyModal) {
        historyModal.addEventListener('click', (e) => {
            if (e.target === historyModal) {
                historyModal.classList.remove('active');
            }
        });
    }

    // On lance les fonctions globales seulement si on est sur la page Jeu
    if (document.getElementById('game-screen')) {
        chargerCalendrier();
        chargerResultatsOfficiels();
    }

    // On lance la fonction Admin seulement si on détecte un élément Admin
    if (document.getElementById('res-1')) {
        remplirListesPilotes();
    }
});
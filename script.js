let pilotesUtilises = [];
const pseudoInput = document.getElementById('pseudo-input');
const welcomeTitle = document.getElementById('welcome-title');
const listContainer = document.getElementById('pilotes-list');

// --- 1. GESTION DU CALENDRIER & TIMERS ---
async function chargerCalendrier() {
    try {
        const response = await fetch('v01_race_dataset.csv');
        const csvText = await response.text();
        const lignes = csvText.trim().split('\n').slice(1);
        const maintenant = new Date();

        for (let ligne of lignes) {
            const colonnes = ligne.split(',');
            if (colonnes.length < 5) continue;

            const nomGP = colonnes[1];
            const circuit = colonnes[2];
            const sprintStr = colonnes[3].trim();
            const raceStr = colonnes[4].trim();

            const parseDate = (s) => {
                const [d, t] = s.split(' ');
                const [day, month, year] = d.split('/');
                return new Date(`${year}-${month}-${day}T${t}`);
            };

            const dateSprint = parseDate(sprintStr);
            const dateRace = parseDate(raceStr);

            if (dateRace > maintenant) {
                document.getElementById('race-name').textContent = nomGP;
                document.getElementById('race-circuit').textContent = circuit;
                document.getElementById('race-date').textContent = sprintStr.split(' ')[0];
                demarrerTimer(dateSprint, 'timer-sprint');
                demarrerTimer(dateRace, 'timer-race');
                break;
            }
        }
    } catch (e) { console.error("Erreur Calendrier", e); }
}

function demarrerTimer(cible, id) {
    const el = document.getElementById(id);
    const typeCourse = id.includes('sprint') ? 'Sprint' : 'Race';

    const itv = setInterval(() => {
        const maintenant = new Date();
        const diff = cible - maintenant;

        majBoutonModification(cible, typeCourse);

        if (diff < 0) {
            el.textContent = "🏁 SESSION Lancée";
            clearInterval(itv);
            return;
        }
        const j = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${j}j ${h}h ${m}m ${s}s`;
    }, 1000);
}

// --- 2. GESTION DES PILOTES ---
async function genererPilotes() {
    listContainer.innerHTML = '';
    pilotesUtilises = [];
    try {
        const resp = await fetch('v01_pilote_dataset.csv');
        const text = await resp.text();
        const lignes = text.trim().split('\n').slice(1);

        lignes.forEach(l => {
            const [num, nom] = l.split(',');
            const div = document.createElement('div');
            div.className = 'pilote-card';
            div.id = `p-${num.trim()}`;
            div.draggable = true;
            div.innerHTML = `<span class="num">#${num.trim()}</span> ${nom.trim()}`;
            
            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('nom', nom.trim());
                e.dataTransfer.setData('sid', div.id);
                e.dataTransfer.setData('fromPodium', 'false');
            });
            listContainer.appendChild(div);
        });
    } catch (e) { console.error("Erreur Pilotes", e); }
}

// --- 3. DRAG & DROP ---
function initGame() {
    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', e => {
        if (e.dataTransfer.getData('fromPodium') === 'true') {
            resetPilote(e.dataTransfer.getData('sid'));
        }
    });

    document.querySelectorAll('.step').forEach(step => {
        step.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
        });

        step.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();

            const nom = e.dataTransfer.getData('nom');
            const sid = e.dataTransfer.getData('sid');
            const fromPodium = e.dataTransfer.getData('fromPodium') === 'true';

            if (fromPodium) {
                const sourceStep = document.querySelector(`[data-cid="${sid}"]`);
                if (sourceStep && sourceStep !== step) viderZone(sourceStep);
            } else if (pilotesUtilises.includes(nom)) {
                return alert("Déjà choisi !");
            }

            const ancienneCarte = step.querySelector('.pilote-card');
            if (ancienneCarte) {
                const ancienNom = ancienneCarte.innerText.replace(/#\d+\s/, "").trim();
                pilotesUtilises = pilotesUtilises.filter(n => n !== ancienNom);
                const oldId = step.dataset.cid;
                if(document.getElementById(oldId)) document.getElementById(oldId).classList.remove('used');
            }

            placerPilote(step, nom, sid, step.dataset.rank);
        });
    });
}

function placerPilote(step, nom, sid, rank) {
    if (!pilotesUtilises.includes(nom)) pilotesUtilises.push(nom);
    const originalCard = document.getElementById(sid);
    if (originalCard) originalCard.classList.add('used');
    step.dataset.cid = sid;

    const numero = originalCard ? originalCard.querySelector('.num').innerText : "#??";
    const cardHTML = `<div class="pilote-card" draggable="true" style="margin:0; cursor:grab; width:auto;"><span class="num">${numero}</span> ${nom}</div>`;

    if (rank === "Chute") {
        step.innerHTML = cardHTML;
        step.classList.add('used-crash');
    } else {
        step.innerHTML = `<span>${rank}</span><div class="target-area">${cardHTML}</div>`;
    }

    const dragCard = step.querySelector('.pilote-card');
    dragCard.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('nom', nom);
        e.dataTransfer.setData('sid', sid);
        e.dataTransfer.setData('fromPodium', 'true');
    });
}

function viderZone(step) {
    const rank = step.dataset.rank;
    if (rank === "Chute") {
        step.innerHTML = `<small>Glisser ici</small>`;
    } else {
        step.innerHTML = `<span>${rank}</span><div class="target-area"><small>Glisser ici</small></div>`;
    }
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
        const card = document.getElementById(sid);
        if (card) card.classList.remove('used');
        viderZone(step);
    }
}

// --- 4. NAVIGATION & VALIDATION ---
// --- GESTION DES DONNÉES JOUEURS ---

function commencerJeu() {
    const pseudo = pseudoInput.value.trim();
    if (!pseudo) return alert("Pseudo requis !");

    // 1. Chercher si le joueur existe déjà dans le LocalStorage
    let joueurs = JSON.parse(localStorage.getItem('db_motogp')) || {};

    if (joueurs[pseudo]) {
        // Le joueur existe : on charge ses pronos
        chargerPronosJoueur(joueurs[pseudo]);
        welcomeTitle.innerText = `Ravi de te revoir, ${pseudo}`;
    } else {
        // Nouveau joueur : on l'initialise
        joueurs[pseudo] = {
            sprint: null,
            race: null,
            dateInscription: new Date().toISOString()
        };
        localStorage.setItem('db_motogp', JSON.stringify(joueurs));
        welcomeTitle.innerText = `Bienvenue, ${pseudo}`;
    }

    // Affichage de l'écran de jeu
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    chargerCalendrier();
    genererPilotes();
    initGame();
}

// Fonction pour sauvegarder les pronos dans la "DB"
function sauvegarderDansDB(type, resultats) {
    const pseudo = pseudoInput.value.trim();
    let joueurs = JSON.parse(localStorage.getItem('db_motogp')) || {};

    if (joueurs[pseudo]) {
        if (type === 'Sprint') joueurs[pseudo].sprint = resultats;
        else joueurs[pseudo].race = resultats;
        
        localStorage.setItem('db_motogp', JSON.stringify(joueurs));
    }
}

// Fonction pour charger les pronos existants
function chargerPronosJoueur(donnees) {
    if (donnees.sprint) {
        afficherRecapVisuel('recap-sprint', donnees.sprint);
    }
    if (donnees.race) {
        afficherRecapVisuel('recap-race', donnees.race);
        // Si le GP est déjà fait, on cache les zones de jeu au démarrage
        document.querySelector('.pilotes-section').classList.add('hidden');
        const banner = document.querySelector('.section-banner');
        banner.innerText = "✅ Tes pronostics sont enregistrés !";
        banner.style.background = "#28a745";
    }
}

function afficherRecapVisuel(idElement, res) {
    document.getElementById(idElement).innerHTML = 
        `🥇 ${res["1er"]}<br>🥈 ${res["2e"]}<br>🥉 ${res["3e"]}<br>⚠️ Chute: ${res["Chute"]}`;
}

function validerCourse(type) {
    const sid = type === 'Sprint' ? 'section-sprint' : 'section-race';
    const rid = type === 'Sprint' ? 'recap-sprint' : 'recap-race';
    const steps = document.querySelectorAll(`#${sid} .step`);
    
    let res = { "1er": "---", "2e": "---", "3e": "---", "Chute": "---" };
    steps.forEach(s => {
        const card = s.querySelector('.pilote-card');
        const n = card ? card.innerText.replace(/#\d+\s/, "").trim() : "---";
        res[s.dataset.rank] = n;
    });

    if (res["1er"] === "---") return alert("Podium incomplet !");

    document.getElementById(rid).innerHTML = `🥇 ${res["1er"]}<br>🥈 ${res["2e"]}<br>🥉 ${res["3e"]}<br>⚠️ Chute: ${res["Chute"]}`;

    sauvegarderDansDB(type, res)
    if (type === 'Sprint') {
        document.getElementById('section-sprint').classList.add('hidden');
        document.getElementById('section-race').classList.remove('hidden');
        document.getElementById('current-title').innerText = "Choisissez pour le GRAND PRIX";
        genererPilotes(); 
    } else {
        // Validation Finale GP
        document.getElementById('section-race').classList.add('hidden');
        document.querySelector('.pilotes-section').classList.add('hidden');
        
        const banner = document.querySelector('.section-banner');
        banner.classList.remove('hidden'); // On s'assure qu'elle est visible
        banner.innerText = "✅ Tes pronostics sont enregistrés ! Bonne course 🏁";
        banner.style.background = "#28a7467c"; 
    }
}

function modifierCourse(type) {
    // On réaffiche la structure de jeu
    const banner = document.querySelector('.section-banner');
    banner.classList.remove('hidden');
    banner.innerText = "Pronostics MotoGP";
    banner.style.background = "#e107007c";
    
    document.querySelector('.pilotes-section').classList.remove('hidden');

    if (type === 'Sprint') {
        document.getElementById('section-sprint').classList.remove('hidden');
        document.getElementById('section-race').classList.add('hidden');
        document.getElementById('current-title').innerText = "Modification du SPRINT";
    } else {
        document.getElementById('section-race').classList.remove('hidden');
        document.getElementById('section-sprint').classList.add('hidden');
        document.getElementById('current-title').innerText = "Modification du GRAND PRIX";
    }
    document.getElementById('current-title').scrollIntoView({ behavior: 'smooth' });
}

function majBoutonModification(cible, type) {
    const container = document.getElementById(`btn-edit-${type.toLowerCase()}-container`);
    const recapElement = document.getElementById(`recap-${type.toLowerCase()}`);
    if (!recapElement) return;

    const recap = recapElement.innerText;
    if (recap === "Pas encore validé") return;

    const maintenant = new Date();
    const estClos = (cible - maintenant) <= 0;

    if (estClos) {
        container.innerHTML = `<span style="color: #aaa; font-style: italic; font-size: 0.8em;">🚫 Les jeux sont faits ! Résultats en fin de course. 🏁</span>`;
    } else {
        container.innerHTML = `<button class="btn-modifier" onclick="modifierCourse('${type}')">✏️ Modifier mon pari</button>`;
    }
}
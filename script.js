// --- DONNÉES INTÉGRÉES (Remplace les CSV pour Netlify) ---
const DATA_PILOTES = [
    {num: "1", nom: "Pecco Bagnaia"}, {num: "89", nom: "Jorge Martin"},
    {num: "93", nom: "Marc Marquez"}, {num: "23", nom: "Enea Bastianini"},
    {num: "31", nom: "Pedro Acosta"}, {num: "33", nom: "Brad Binder"},
    {num: "20", nom: "Fabio Quartararo"}, {num: "5", nom: "Johann Zarco"}
];

const DATA_CALENDRIER = [
    {gp: "Thaïlande", circuit: "Buriram", sprint: "2026-02-28T09:00:00", race: "2026-03-01T09:00:00"},
    {gp: "Argentine", circuit: "Termas", sprint: "2026-03-14T19:00:00", race: "2026-03-15T19:00:00"}
];

let pilotesUtilises = [];
let isAdmin = false;

// --- INITIALISATION ---
function commencerJeu() {
    const pseudo = document.getElementById('pseudo-input').value.trim();
    if (!pseudo) return alert("Pseudo requis !");

    let joueurs = JSON.parse(localStorage.getItem('db_motogp')) || {};

    if (pseudo.toLowerCase() === 'root') {
        isAdmin = true;
        document.getElementById('welcome-title').innerText = "Mode Administrateur";
        document.getElementById('user-stats-col').classList.add('hidden');
    } else {
        isAdmin = false;
        if (joueurs[pseudo]) {
            chargerPronosJoueur(joueurs[pseudo]);
            document.getElementById('welcome-title').innerText = `Ravi de te revoir, ${pseudo}`;
        } else {
            joueurs[pseudo] = { sprint: null, race: null };
            localStorage.setItem('db_motogp', JSON.stringify(joueurs));
            document.getElementById('welcome-title').innerText = `Bienvenue, ${pseudo}`;
        }
    }

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    chargerCalendrier();
    genererPilotes();
    initDragAndDrop();
}

function chargerCalendrier() {
    const maintenant = new Date();
    const futureRace = DATA_CALENDRIER.find(r => new Date(r.race) > maintenant);

    if (futureRace) {
        document.getElementById('race-name').textContent = futureRace.gp;
        document.getElementById('race-circuit').textContent = futureRace.circuit;
        document.getElementById('race-date').textContent = new Date(futureRace.sprint).toLocaleDateString();
        
        demarrerTimer(new Date(futureRace.sprint), 'timer-sprint-val', 'Sprint');
        demarrerTimer(new Date(futureRace.race), 'timer-race-val', 'Race');
    }
}

function demarrerTimer(cible, id, type) {
    const el = document.getElementById(id);
    const update = () => {
        const diff = cible - new Date();
        majBoutonModification(cible, type);
        if (diff <= 0) {
            el.textContent = "🏁 SESSION LANCÉE";
            return clearInterval(itv);
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${h}h ${m}m ${s}s`;
    };
    const itv = setInterval(update, 1000);
    update();
}

// --- LOGIQUE DRAG & DROP ---
function genererPilotes() {
    const list = document.getElementById('pilotes-list');
    list.innerHTML = '';
    DATA_PILOTES.forEach(p => {
        const div = document.createElement('div');
        div.className = 'pilote-card';
        div.id = `p-${p.num}`;
        div.draggable = true;
        div.innerHTML = `<span class="num">#${p.num}</span> ${p.nom}`;
        div.addEventListener('dragstart', e => {
            e.dataTransfer.setData('nom', p.nom);
            e.dataTransfer.setData('sid', div.id);
        });
        list.appendChild(div);
    });
}

function initDragAndDrop() {
    document.querySelectorAll('.step').forEach(step => {
        step.addEventListener('dragover', e => e.preventDefault());
        step.addEventListener('drop', e => {
            e.preventDefault();
            const nom = e.dataTransfer.getData('nom');
            const sid = e.dataTransfer.getData('sid');

            if (pilotesUtilises.includes(nom)) return alert("Pilote déjà utilisé !");

            // Nettoyage si la zone est déjà occupée
            const oldCard = step.querySelector('.pilote-card');
            if (oldCard) {
                const oldNom = oldCard.innerText.split(' ').slice(1).join(' ');
                pilotesUtilises = pilotesUtilises.filter(n => n !== oldNom);
                document.getElementById(step.dataset.cid).classList.remove('used');
            }

            // Placement
            step.dataset.cid = sid;
            pilotesUtilises.push(nom);
            document.getElementById(sid).classList.add('used');
            
            const cardHTML = `<div class="pilote-card" style="margin:0;">${nom}</div>`;
            if (step.dataset.rank === "Chute") {
                step.innerHTML = cardHTML;
                step.classList.add('used-crash');
            } else {
                step.innerHTML = `<span>${step.dataset.rank}</span><div class="target-area">${cardHTML}</div>`;
            }
        });
    });
}

// --- VALIDATION ---
function validerCourse(type) {
    const containerId = type === 'Sprint' ? 'section-sprint' : 'section-race';
    const recapId = type === 'Sprint' ? 'recap-sprint' : 'recap-race';
    const steps = document.querySelectorAll(`#${containerId} .step`);
    
    let res = {};
    steps.forEach(s => {
        const card = s.querySelector('.pilote-card');
        res[s.dataset.rank] = card ? card.innerText.trim() : "---";
    });

    if (res["1er"] === "---") return alert("Le podium doit avoir au moins un vainqueur !");

    const pseudo = document.getElementById('pseudo-input').value.trim();
    let joueurs = JSON.parse(localStorage.getItem('db_motogp')) || {};
    
    if (type === 'Sprint') joueurs[pseudo].sprint = res;
    else joueurs[pseudo].race = res;
    
    localStorage.setItem('db_motogp', JSON.stringify(joueurs));
    afficherRecapVisuel(recapId, res);

    if (type === 'Sprint') {
        document.getElementById('section-sprint').classList.add('hidden');
        document.getElementById('section-race').classList.remove('hidden');
        document.getElementById('current-title').innerText = "Choisissez pour le GRAND PRIX";
        pilotesUtilises = []; 
        genererPilotes();
    } else {
        document.getElementById('section-race').classList.add('hidden');
        document.querySelector('.pilotes-section').classList.add('hidden');
        document.querySelector('.section-banner').innerText = "✅ Pronostics enregistrés !";
    }
}

function afficherRecapVisuel(id, res) {
    document.getElementById(id).innerHTML = `🥇 ${res["1er"]}<br>🥈 ${res["2e"]}<br>🥉 ${res["3e"]}<br>⚠️ Chute: ${res["Chute"]}`;
}

function chargerPronosJoueur(d) {
    if (d.sprint) afficherRecapVisuel('recap-sprint', d.sprint);
    if (d.race) afficherRecapVisuel('recap-race', d.race);
}

function majBoutonModification(cible, type) {
    const container = document.getElementById(`btn-edit-${type.toLowerCase()}-container`);
    if (!container) return;
    const estClos = (cible - new Date()) <= 0;
    container.innerHTML = estClos ? `<small>🔒 Clos</small>` : `<button class="btn-modifier" onclick="location.reload()">✏️ Reset</button>`;
}
// 1. UTILISE LES LIENS COMPLETS (CDN) POUR LE NAVIGATEUR
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 2. TA CONFIGURATION
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

// --- DONNÉES ---
import { DATA_PILOTES, DATA_CALENDRIER } from "./config.js";

let pilotesUtilises = [];
let pseudoGlobal = "";

// --- 1. GESTION DU JEU ET MÉMOIRE ---
async function commencerJeu() {
    const pseudo = document.getElementById('pseudo-input').value.trim();
    if (!pseudo) return alert("Pseudo requis !");
    pseudoGlobal = pseudo;
    
    document.getElementById('welcome-title').innerText = `Pilote : ${pseudo}`;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    // MÉMOIRE : Charger les pronos existants depuis Firebase
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
}

// --- 2. CALENDRIER ET TIMERS (AVEC VERROUILLAGE) ---
function chargerCalendrier() {
    const maintenant = new Date();
    // On cherche la prochaine course
    const futureRace = DATA_CALENDRIER.find(r => new Date(r.race) > maintenant);

    if (futureRace) {
        document.getElementById('race-name').textContent = futureRace.gp;
        document.getElementById('race-circuit').textContent = futureRace.circuit;
        
        // --- FORMATAGE DE LA DATE (Jour Mois Année) ---
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const dateObj = new Date(futureRace.race);
        document.getElementById('race-date-formatted').textContent = dateObj.toLocaleDateString('fr-FR', options);

        // --- AFFICHAGE DES STATS 2025 ---
        if (futureRace.stats2025) {
            document.getElementById('stats-content').innerHTML = `
                <strong>Stats 2025 :</strong><br>
                Pole : ${futureRace.stats2025.pole}<br>
                Vainqueur : ${futureRace.stats2025.vainqueurGP}
            `;
        }

        // --- LANCEMENT DU TIMER (Cible : Sprint ou Race) ---
        // On cible le départ du Sprint pour verrouiller, ou la Race
        demarrerTimer(new Date(futureRace.sprint), 'timer-race-val', 'Sprint');
    }
}
function demarrerTimer(cible, id, type) {
    const el = document.getElementById(id);
    
    const updateTimer = () => {
        const maintenant = new Date();
        const diff = cible - maintenant;

        if (diff <= 0) {
            el.innerHTML = `<span style="color: #ff4444;">🏁 SESSION EN COURS</span>`;
            return;
        }

        // Calcul Jours, Heures, Minutes, Secondes
        const j = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        // Affichage formaté
        el.textContent = `${j}j ${h}h ${m}m ${s}s`;
    };

    updateTimer(); // Appel immédiat pour éviter le délai d'une seconde
    setInterval(updateTimer, 1000);
}

// --- 3. DRAG & DROP AVANCÉ ---
function genererPilotes() {
    const list = document.getElementById('pilotes-list');
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
    // Permet de supprimer en lâchant hors des zones
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
        if(document.getElementById(sid)) document.getElementById(sid).classList.remove('used');
        viderZone(step);
    }
}

// --- 4. VALIDATION ET MODIFICATION ---
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
        
        if (type === 'Sprint') {
            document.getElementById('section-race').classList.remove('hidden');
            document.getElementById('current-title').innerText = "Choisissez pour le GRAND PRIX";
            pilotesUtilises = [];
            genererPilotes();
        } else {
            document.querySelector('.pilotes-section').classList.add('hidden');
            document.getElementById('main-banner').innerText = "✅ Pronostics enregistrés !";
        }
    });
}

function majBoutonModification(cible, type) {
    const container = document.getElementById(`btn-edit-${type.toLowerCase()}-container`);
    const recapEl = document.getElementById(`recap-${type.toLowerCase()}`);
    if (!recapEl || recapEl.innerText === "Pas encore validé") return;

    if (new Date() > cible) {
        container.innerHTML = `<small style="color:gray">🔒 Verrouillé</small>`;
    } else {
        container.innerHTML = `<button class="btn-modifier" id="btn-mod-${type}">✏️ Modifier</button>`;
        document.getElementById(`btn-mod-${type}`).onclick = () => {
            document.getElementById(`section-${type.toLowerCase()}`).classList.remove('hidden');
            document.querySelector('.pilotes-section').classList.remove('hidden');
            if(type === 'Race') document.getElementById('section-sprint').classList.add('hidden');
        };
    }
}

function afficherRecapVisuel(id, choix) {
    document.getElementById(id).innerHTML = `🥇 ${choix["1er"]} | 🥈 ${choix["2e"]} | 🥉 ${choix["3e"]} | ⚠️ ${choix["Chute"]}`;
}

function chargerResultatsOfficiels() {
    const resRef = ref(db, 'resultats/');
    
    // onValue permet de mettre à jour la page INSTANTANÉMENT si tu changes le résultat
    onValue(resRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.Sprint) {
                document.getElementById('official-sprint').innerHTML = 
                    `🥇 ${data.Sprint["1er"]} | 🥈 ${data.Sprint["2e"]} | 🥉 ${data.Sprint["3e"]} | ⚠️ ${data.Sprint["Chute"]}`;
            }
            if (data.Race) {
                document.getElementById('official-race').innerHTML = 
                    `🥇 ${data.Race["1er"]} | 🥈 ${data.Race["2e"]} | 🥉 ${data.Race["3e"]} | ⚠️ ${data.Race["Chute"]}`;
            }
        }
    });
}

// 2. Fonction pour remplir les menus déroulants
function remplirListesPilotes() {
    const selects = ["res-1", "res-2", "res-3", "res-chute"];
    
    // Trier les pilotes par nom alphabétique (optionnel mais plus ergonomique)
    const pilotesTries = [...DATA_PILOTES].sort((a, b) => a.nom.localeCompare(b.nom));

    selects.forEach(id => {
        const selectEl = document.getElementById(id);
        pilotesTries.forEach(p => {
            const option = document.createElement('option');
            option.value = p.nom;
            option.textContent = `#${p.num} - ${p.nom}`;
            selectEl.appendChild(option);
        });
    });
}

// 3. Appeler la fonction au chargement
remplirListesPilotes();


// --- LIAISON DES BOUTONS ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-rejoindre').onclick = commencerJeu;
    document.getElementById('btn-valider-sprint').onclick = () => validerCourse('Sprint');
    document.getElementById('btn-valider-race').onclick = () => validerCourse('Race');
});
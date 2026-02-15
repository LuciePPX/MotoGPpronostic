// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAlWxI_w2R6eyJYBg9h_ynHWAgz3VS51Zk",
  authDomain: "motogppronostic.firebaseapp.com",
  projectId: "motogppronostic",
  storageBucket: "motogppronostic.firebasestorage.app",
  messagingSenderId: "1093723718276",
  appId: "1:1093723718276:web:51b754c96ceacd589638d1",
  measurementId: "G-D9M06ECP07"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// --- DONNÉES ---
const DATA_PILOTES = [
    {num: "1", nom: "Pecco Bagnaia"}, {num: "89", nom: "Jorge Martin"},
    {num: "93", nom: "Marc Marquez"}, {num: "23", nom: "Enea Bastianini"},
    {num: "31", nom: "Pedro Acosta"}, {num: "33", nom: "Brad Binder"},
    {num: "20", nom: "Fabio Quartararo"}, {num: "5", nom: "Johann Zarco"},
    {num: "72", nom: "Marco Bezzecchi"}, {num: "49", nom: "Fabio Di Giannantonio"}
];

const DATA_CALENDRIER = [
    {gp: "Thaïlande", circuit: "Buriram", sprint: "2026-02-28T09:00:00", race: "2026-03-01T09:00:00"},
    {gp: "Argentine", circuit: "Termas", sprint: "2026-03-14T19:00:00", race: "2026-03-15T19:00:00"}
];

let pilotesUtilises = [];

// --- BOUTONS ---
document.getElementById('btn-rejoindre').onclick = commencerJeu;
document.getElementById('btn-valider-sprint').onclick = () => validerCourse('Sprint');
document.getElementById('btn-valider-race').onclick = () => validerCourse('Race');

function commencerJeu() {
    const pseudo = document.getElementById('pseudo-input').value.trim();
    if (!pseudo) return alert("Pseudo requis !");
    
    document.getElementById('welcome-title').innerText = `Pilote : ${pseudo}`;
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
        
        demarrerTimer(new Date(futureRace.sprint), 'timer-sprint-val-label');
        demarrerTimer(new Date(futureRace.race), 'timer-race-val-label');
    }
}

function demarrerTimer(cible, id) {
    const el = document.getElementById(id);
    setInterval(() => {
        const diff = cible - new Date();
        if (diff <= 0) return el.textContent = "🏁 SESSION LANCÉE";
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${h}h ${m}m ${s}s`;
    }, 1000);
}

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
            if (pilotesUtilises.includes(nom)) return;

            const oldCard = step.querySelector('.pilote-card');
            if (oldCard) {
                const oldNom = oldCard.innerText.replace(/#\d+\s/, "").trim();
                pilotesUtilises = pilotesUtilises.filter(n => n !== oldNom);
                document.getElementById(step.dataset.cid).classList.remove('used');
            }

            step.dataset.cid = sid;
            pilotesUtilises.push(nom);
            document.getElementById(sid).classList.add('used');
            step.innerHTML = (step.dataset.rank === "Chute") ? 
                `<div class="pilote-card">${nom}</div>` : 
                `<span>${step.dataset.rank}</span><div class="target-area"><div class="pilote-card">${nom}</div></div>`;
            step.classList.add('used-crash');
        });
    });
}

function validerCourse(type) {
    const pseudo = document.getElementById('pseudo-input').value.trim();
    const containerId = type === 'Sprint' ? 'section-sprint' : 'section-race';
    const steps = document.querySelectorAll(`#${containerId} .step`);
    
    let res = {};
    steps.forEach(s => {
        const card = s.querySelector('.pilote-card');
        res[s.dataset.rank] = card ? card.innerText.trim() : "---";
    });

    if (res["1er"] === "---") return alert("Podium incomplet !");

    // SAUVEGARDE FIREBASE
    set(ref(db, 'pronos/' + pseudo + '/' + type), {
        choix: res,
        timestamp: new Date().toISOString()
    }).then(() => {
        document.getElementById(`recap-${type.toLowerCase()}`).innerHTML = `🥇 ${res["1er"]}<br>🥈 ${res["2e"]}<br>🥉 ${res["3e"]}<br>⚠️ Chute: ${res["Chute"]}`;
        if (type === 'Sprint') {
            document.getElementById('section-sprint').classList.add('hidden');
            document.getElementById('section-race').classList.remove('hidden');
            document.getElementById('current-title').innerText = "Choisissez pour le GRAND PRIX";
            pilotesUtilises = [];
            genererPilotes();
        } else {
            document.getElementById('section-race').classList.add('hidden');
            document.getElementById('pilotes-list').classList.add('hidden');
            document.getElementById('main-banner').innerText = "✅ Pronostics envoyés !";
        }
    });
}
// --- LIAISON DES BOUTONS ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Bouton pour entrer dans le jeu
    const btnRejoindre = document.getElementById('btn-rejoindre');
    if(btnRejoindre) {
        btnRejoindre.addEventListener('click', commencerJeu);
    }

    // Bouton pour valider le Sprint
    const btnSprint = document.getElementById('btn-valider-sprint');
    if(btnSprint) {
        btnSprint.addEventListener('click', () => validerCourse('Sprint'));
    }

    // Bouton pour valider la Course
    const btnRace = document.getElementById('btn-valider-race');
    if(btnRace) {
        btnRace.addEventListener('click', () => validerCourse('Race'));
    }
});
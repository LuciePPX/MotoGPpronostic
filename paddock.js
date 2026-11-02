import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from './firebase-init.js';
import { DATA_PILOTES, DATA_CALENDRIER } from './config.js';
import { cleCourse, libelleCourse } from './utils.js';

// Affiche +3, -1 ou 0
const fmt = (n) => (n > 0 ? `+${n}` : `${n}`);

function nomPilote(num) {
    if (num === undefined || num === null || num === "") return "—";
    const pilote = DATA_PILOTES.find(p => parseInt(p.num) === parseInt(num));
    return pilote ? pilote.nom : `#${num}`;
}

function nomsChutes(valeur) {
    if (valeur === undefined || valeur === null) return "—";
    const liste = Array.isArray(valeur) ? valeur : [valeur];
    return liste.length ? liste.map(nomPilote).join(", ") : "Aucune";
}

function indexCalendrier(cle) {
    return DATA_CALENDRIER.findIndex(c => cleCourse(c.gp) === cle);
}

// ===== FONCTION: BRANCHER LE BOUTON ET LA FENÊTRE =====
export function initPaddock() {
    const bouton = document.getElementById('btn-paddock');
    const fenetre = document.getElementById('paddock-modal');
    const liste = document.getElementById('paddock-course');
    if (!bouton || !fenetre || !liste || bouton.dataset.branche) return;
    bouton.dataset.branche = "1";

    bouton.addEventListener('click', async () => {
        fenetre.classList.add('active');
        await remplirCourses();
    });
    liste.addEventListener('change', () => afficherCourse(liste.value));
}

// ===== FONCTION: LISTE DES COURSES DÉJÀ JOUÉES (la plus récente en premier) =====
async function remplirCourses() {
    const liste = document.getElementById('paddock-course');
    const resultats = (await get(ref(db, 'resultats'))).val() || {};

    const cles = Object.keys(resultats).sort((a, b) => indexCalendrier(b) - indexCalendrier(a));

    liste.innerHTML = "";
    if (cles.length === 0) {
        document.getElementById('paddock-contenu').innerHTML = "<p>Aucune course n'a encore de résultats.</p>";
        return;
    }

    cles.forEach((cle) => {
        const option = document.createElement('option');
        option.value = cle;
        option.textContent = libelleCourse(cle);
        liste.appendChild(option);
    });

    afficherCourse(cles[0]);
}

// ===== FONCTION: AFFICHER UNE COURSE =====
async function afficherCourse(cle) {
    const zone = document.getElementById('paddock-contenu');
    zone.innerHTML = "<p>Chargement…</p>";

    const [resultats, scores, pronos] = await Promise.all([
        get(ref(db, `resultats/${cle}`)),
        get(ref(db, 'scores_details')),
        get(ref(db, 'pronostics'))
    ]);
    const res = resultats.val() || {};
    const tousScores = scores.val() || {};
    const tousPronos = pronos.val() || {};

    // Un joueur par ligne, avec ses points sprint, course et total
    const lignes = [];
    Object.entries(tousScores).forEach(([pseudo, parCourse]) => {
        const detail = parCourse?.[cle];
        if (!detail) return;
        const sprint = detail.sprint?.total || 0;
        const course = detail.race?.total || 0;
        lignes.push({ pseudo, sprint, course, total: sprint + course });
    });
    lignes.sort((a, b) => b.total - a.total);

    zone.innerHTML = `
        ${blocPodiums(res)}
        <h3>Points de cette course</h3>
        ${lignes.length ? tableauClassement(lignes) : "<p>Personne n'a pronostiqué cette course.</p>"}
        <div id="paddock-detail"></div>
    `;

    zone.querySelectorAll('[data-pseudo]').forEach((ligne) => {
        ligne.addEventListener('click', () =>
            afficherDetail(cle, ligne.dataset.pseudo, tousScores, tousPronos, res)
        );
    });
}

// ===== AFFICHAGE : PODIUMS OFFICIELS =====
function blocPodiums(res) {
    return `
        <div class="paddock-podiums">
            ${blocSession("Sprint", res.sprint)}
            ${blocSession("Course", res.race)}
        </div>
    `;
}

function blocSession(titre, session) {
    if (!session) {
        return `<div class="paddock-carte"><h4>${titre}</h4><p>Pas encore publié</p></div>`;
    }
    return `
        <div class="paddock-carte">
            <h4>${titre}</h4>
            <p>🥇 ${nomPilote(session["1er"])}</p>
            <p>🥈 ${nomPilote(session["2e"])}</p>
            <p>🥉 ${nomPilote(session["3e"])}</p>
            <p>💥 ${nomsChutes(session["Chute"])}</p>
        </div>
    `;
}

// ===== AFFICHAGE : CLASSEMENT DE LA COURSE =====
function tableauClassement(lignes) {
    return `
        <table class="score-table paddock-table">
            <thead>
                <tr><th>Joueur</th><th>Sprint</th><th>Course</th><th>Total</th></tr>
            </thead>
            <tbody>
                ${lignes.map((l, i) => `
                    <tr class="paddock-ligne" data-pseudo="${l.pseudo}">
                        <td>${i === 0 ? "🥇 " : ""}${l.pseudo}</td>
                        <td>${fmt(l.sprint)}</td>
                        <td>${fmt(l.course)}</td>
                        <td><strong>${fmt(l.total)}</strong></td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
        <p class="aide">👆 Touche un joueur pour voir ses pronostics.</p>
    `;
}

// ===== AFFICHAGE : PRONOS D'UN JOUEUR =====
function afficherDetail(cle, pseudo, tousScores, tousPronos, res) {
    const zone = document.getElementById('paddock-detail');
    const pointsJoueur = tousScores[pseudo]?.[cle] || {};
    const pronosJoueur = tousPronos[pseudo]?.[cle] || {};

    zone.innerHTML = `
        <h3>Pronos de ${pseudo}</h3>
        ${tableauPronos("Sprint", pronosJoueur.sprint, res.sprint, pointsJoueur.sprint)}
        ${tableauPronos("Course", pronosJoueur.race, res.race, pointsJoueur.race)}
    `;
    zone.scrollIntoView({ behavior: "smooth", block: "start" });
}

function tableauPronos(titre, prono, reel, points) {
    if (!prono) {
        return `<div class="paddock-carte"><h4>${titre}</h4><p>Pas de prono pour cette session.</p></div>`;
    }

    const ligne = (libelle, p, r, pts) =>
        `<tr><td>${libelle}</td><td>${p}</td><td>${r}</td><td>${fmt(pts || 0)}</td></tr>`;

    return `
        <div class="paddock-carte">
            <h4>${titre} : ${fmt(points?.total || 0)} pts</h4>
            <table class="score-table">
                <thead>
                    <tr><th>Place</th><th>Prono</th><th>Résultat</th><th>Pts</th></tr>
                </thead>
                <tbody>
                    ${ligne("🥇 1er", nomPilote(prono["1er"]), nomPilote(reel?.["1er"]), points?.["1er"])}
                    ${ligne("🥈 2e", nomPilote(prono["2e"]), nomPilote(reel?.["2e"]), points?.["2e"])}
                    ${ligne("🥉 3e", nomPilote(prono["3e"]), nomPilote(reel?.["3e"]), points?.["3e"])}
                    ${ligne("💥 Chute", nomPilote(prono["Chute"]), nomsChutes(reel?.["Chute"]), points?.["Chute"])}
                </tbody>
            </table>
        </div>
    `;
}
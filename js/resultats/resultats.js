import { DATA_PILOTES } from '../../config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from '../coeur/firebase-init.js';
import { libelleCourse } from '../coeur/utils.js';
import { etat } from '../coeur/etat.js';
import { afficherRecap, updateSectionsVisibility } from '../jeu/pronostics.js';


// ===== FUNCTION: NOM D'UN PILOTE À PARTIR DE SON NUMÉRO =====
export function obtenirNomPilote(num) {
    if (!num) return 'TBD';
    const pilote = DATA_PILOTES.find(p => parseInt(p.num) === parseInt(num));
    return pilote ? pilote.nom : `Pilote #${num}`;
}


// ===== FUNCTION: NOMS DES PILOTES CHUTÉS =====
// Les résultats stockent un tableau (ex. [25, 89]), les pronostics un seul numéro
export function obtenirNomsChutes(valeur) {
    if (valeur === undefined || valeur === null) return 'TBD';

    const numeros = Array.isArray(valeur) ? valeur : [valeur];
    if (numeros.length === 0) return 'Aucun';

    return numeros.map((num) => obtenirNomPilote(num)).join(', ');
}


// ===== FUNCTION: DATE DE LA DERNIÈRE SESSION D'UNE COURSE =====
function dateDerniereSession(courseData) {
    const dates = [courseData.sprint?.timestamp, courseData.race?.timestamp]
        .filter(Boolean)
        .map((t) => new Date(t).getTime())
        .filter((t) => !isNaN(t));

    return dates.length > 0 ? Math.max(...dates) : 0;
}


// ===== FUNCTION: BLOC D'UNE SESSION (SPRINT OU GRAND PRIX) =====
function construireBlocSession(titre, session, meilleursParieurs) {
    if (!session) {
        return `
            <div style="flex: 1;">
                <h4>${titre}</h4>
                <div>Pas encore de résultats</div>
            </div>
        `;
    }

    return `
        <div style="flex: 1;">
            <h4>${titre}</h4>
            <div>🥇 ${obtenirNomPilote(session["1er"])}</div>
            <div>🥈 ${obtenirNomPilote(session["2e"])}</div>
            <div>🥉 ${obtenirNomPilote(session["3e"])}</div>
            <div><strong>🏆 Meilleur parieur :</strong> ${meilleursParieurs.join(', ') || "Aucun"}</div>
        </div>
    `;
}


// ===== FUNCTION: CHARGER LES COURSES PASSÉES =====
export async function afficherCoursePrecedente() {
    const container = document.getElementById('previous-races-body');
    if (!container) return;

    try {
        const snapshot = await get(ref(db, 'resultats'));
        if (!snapshot.exists()) {
            container.innerHTML = "<p>Aucune course n'a encore de résultats.</p>";
            return;
        }

        const resultats = snapshot.val();
        etat.coursesPassees = Object.keys(resultats)
            .map((cle) => ({
                cle,
                date: dateDerniereSession(resultats[cle]),
                data: resultats[cle]
            }))
            .sort((a, b) => a.date - b.date);

        const scoresSnap = await get(ref(db, 'scores_details'));
        etat.scoresDetailsCache = scoresSnap.exists() ? scoresSnap.val() : {};

        etat.indexCoursePassee = etat.coursesPassees.length - 1;
        brancherFlechesCoursesPassees();
        afficherCoursePassee();
    } catch (error) {
        console.error("Erreur chargement courses précédentes :", error);
        container.innerHTML = "<p>Impossible de charger les courses précédentes.</p>";
    }
}


// ===== FUNCTION: BRANCHER LES FLÈCHES (une seule fois) =====
function brancherFlechesCoursesPassees() {
    const prev = document.getElementById('previous-races-prev');
    const next = document.getElementById('previous-races-next');
    if (!prev || !next || prev.dataset.branche) return;
    prev.dataset.branche = "1";

    prev.addEventListener('click', () => {
        if (etat.indexCoursePassee > 0) {
            etat.indexCoursePassee--;
            afficherCoursePassee();
        }
    });

    next.addEventListener('click', () => {
        if (etat.indexCoursePassee < etat.coursesPassees.length - 1) {
            etat.indexCoursePassee++;
            afficherCoursePassee();
        }
    });
}


// ===== FUNCTION: AFFICHER LA COURSE SÉLECTIONNÉE =====
function afficherCoursePassee() {
    const container = document.getElementById('previous-races-body');
    const course = etat.coursesPassees[etat.indexCoursePassee];
    if (!container || !course) return;

    const resultats = course.data;
    const { meilleurSprint, meilleurRace, meilleurGP, pireGP } = calculerMeilleurs(course.cle);

    const dateTexte = course.date
        ? new Date(course.date).toLocaleDateString('fr-FR', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        })
        : 'Date inconnue';

    container.innerHTML = `
        <div class="race-info" style="max-width: none; margin: 0 auto;">
            <h2>Course</h2>
            <div class="race-gp-name">
                <span>${libelleCourse(course.cle)}</span>
            </div>
            <div class="race-details">
                <div class="detail-item">
                    <span class="detail-icon">📅</span>
                    <span>${dateTexte}</span>
                </div>
            </div>
            <div class="stats-box" style="display: flex; gap: 25px; flex-wrap: wrap;">
                ${construireBlocSession("⏱️ Sprint", resultats.sprint, meilleurSprint)}
                ${construireBlocSession("🏁 Grand Prix", resultats.race, meilleurRace)}
            </div>
            <div style="flex: 1;">
                <h4>Récapitulatif du week-end</h4>
                <div><strong>🥇 Meilleur parieur GP :</strong> ${meilleurGP.join(', ') || "Aucun"}</div>
                <div><strong>😞 Pire parieur GP :</strong> ${pireGP.join(', ') || "Aucun"}</div>
            </div>
        </div>
    `;

    const compteur = document.getElementById('previous-races-compteur');
    if (compteur) compteur.textContent = `${etat.indexCoursePassee + 1} / ${etat.coursesPassees.length}`;

    const prev = document.getElementById('previous-races-prev');
    const next = document.getElementById('previous-races-next');
    if (prev) prev.disabled = etat.indexCoursePassee === 0;
    if (next) next.disabled = etat.indexCoursePassee === etat.coursesPassees.length - 1;
}


// ===== FUNCTION: MEILLEURS ET PIRES PARIEURS D'UNE COURSE =====
function calculerMeilleurs(cle) {
    let meilleurSprint = [], maxScoreSprint = -Infinity;
    let meilleurRace = [], maxScoreRace = -Infinity;
    let meilleurGP = [], maxScoreGP = -Infinity;
    let pireGP = [], minScoreGP = Infinity;

    Object.entries(etat.scoresDetailsCache).forEach(([joueur, data]) => {
        const courseScore = data[cle];
        if (!courseScore) return;

        const sprintTotal = courseScore.sprint?.total || 0;
        const raceTotal = courseScore.race?.total || 0;
        const gpTotal = sprintTotal + raceTotal;

        if (sprintTotal > maxScoreSprint) { maxScoreSprint = sprintTotal; meilleurSprint = [joueur]; }
        else if (sprintTotal === maxScoreSprint) meilleurSprint.push(joueur);

        if (raceTotal > maxScoreRace) { maxScoreRace = raceTotal; meilleurRace = [joueur]; }
        else if (raceTotal === maxScoreRace) meilleurRace.push(joueur);

        if (gpTotal > maxScoreGP) { maxScoreGP = gpTotal; meilleurGP = [joueur]; }
        else if (gpTotal === maxScoreGP) meilleurGP.push(joueur);

        if (gpTotal < minScoreGP) { minScoreGP = gpTotal; pireGP = [joueur]; }
        else if (gpTotal === minScoreGP) pireGP.push(joueur);
    });

    return { meilleurSprint, meilleurRace, meilleurGP, pireGP };
}


// ===== FUNCTION: AFFICHER RÉSULTATS =====

export function afficherResultats(type, sectionId) {
    const timerElement = document.getElementById(`timer-${type}`);
    if (!timerElement) return;

    const results = type === 'sprint' ? etat.sprintResults : etat.raceResults;

    if (Object.keys(results).length === 0) return;

    timerElement.innerHTML = `✅ Résultats ${type === 'sprint' ? 'Sprint' : 'Course'} reçus`;
    timerElement.style.background = 'linear-gradient(135deg, rgba(0, 255, 0, 0.2) 0%, rgba(0, 255, 0, 0.05) 100%)';
    timerElement.style.color = '#00ff00';

    // Charger résultats officiels
    chargerResultatsOfficiels();
}


// ===== FUNCTION: load officals results =====
export function chargerResultatsOfficiels() {
    // Afficher résultats du sprint
    const officialSprintEl = document.getElementById('official-sprint');
    const timerSprintEl = document.getElementById('timer-sprint');

    if (officialSprintEl) {
        if (etat.sprintResults && etat.sprintResults['1er']) {
            if (timerSprintEl) timerSprintEl.style.display = 'none';

            officialSprintEl.innerHTML = `
                <div><strong>🥇 </strong> ${obtenirNomPilote(etat.sprintResults['1er'])}</div>
                <div><strong>🥈 </strong> ${obtenirNomPilote(etat.sprintResults['2e'])}</div>
                <div><strong>🥉 </strong> ${obtenirNomPilote(etat.sprintResults['3e'])}</div>
                <div><strong>💥 </strong> ${obtenirNomsChutes(etat.sprintResults['Chute'])}</div>
            `;
        } else {
            if (timerSprintEl) timerSprintEl.classList.add('hidden-timer');
        }
    }

    // Afficher résultats de la race
    const officialRaceEl = document.getElementById('official-race');
    const timerRaceEl = document.getElementById('timer-race');

    if (officialRaceEl) {
        if (etat.raceResults && etat.raceResults['1er']) {
            if (timerRaceEl) timerRaceEl.style.display = 'none';
            officialRaceEl.innerHTML = `
                <div><strong>🥇 </strong> ${obtenirNomPilote(etat.raceResults['1er'])}</div>
                <div><strong>🥈 </strong> ${obtenirNomPilote(etat.raceResults['2e'])}</div>
                <div><strong>🥉 </strong> ${obtenirNomPilote(etat.raceResults['3e'])}</div>
                <div><strong>💥 </strong> ${obtenirNomsChutes(etat.raceResults['Chute'])}}</div>
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
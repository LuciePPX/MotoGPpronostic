import { getRaceCourante } from '../coeur/etat.js';


// ===== FUNCTION: AFFICHER LA PROCHAINE COURSE =====
export function afficherProchainesCourses() {
    const raceCourante = getRaceCourante();
    if (!raceCourante) return;

    const raceName = document.getElementById('race-name');
    const raceCircuit = document.getElementById('race-circuit');
    const raceDateFormatted = document.getElementById('race-date-formatted');
    const circuitImage = document.getElementById('circuit-image');
    const statsContent = document.getElementById('stats-content');

    if (raceName) raceName.textContent = raceCourante.gp;
    if (raceCircuit) raceCircuit.textContent = raceCourante.circuit;

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
            <div><strong>🏍️ Sprint 2025:</strong> ${raceCourante.stats2025.vainqueurSprint}</div>
            <div><strong>🏁 Pole 2025:</strong> ${raceCourante.stats2025.pole}</div>
        `;
    }
}


// ===== FUNCTION: LA SESSION PEUT-ELLE ENCORE ÊTRE MODIFIÉE ? =====
// Vrai tant que le départ de la session (sprint ou course) n'est pas passé
export function canModify(type) {
    const raceCourante = getRaceCourante();
    if (!raceCourante) return false;
    const eventDate = new Date(type === 'sprint' ? raceCourante.sprint : raceCourante.race).getTime();
    return Date.now() < eventDate;
}
import { etat, getRaceCourante } from '../coeur/etat.js';

// ===== FUNCTION: BEGIN TIMER =====
export function demarrerTimer(type, sectionId) {
    const timerElement = document.getElementById(`timer-${type}`);
    if (!timerElement) return;
    timerElement.classList.remove('hidden-timer');

    const raceCourante = getRaceCourante();
    if (!raceCourante) return;

    // 1. Résultats déjà publiés ?
    const results = type === 'sprint' ? etat.sprintResults : etat.raceResults;
    if (results && Object.keys(results).length > 0) {
        timerElement.innerHTML = "🏁 Course terminée";
        return;
    }

    // 2. L'événement est-il passé ?
    const dateEvent = new Date(type === 'sprint' ? raceCourante.sprint : raceCourante.race);
    const maintenant = new Date();

    if (maintenant > dateEvent) {
        timerElement.innerHTML = "🏃 En cours / En attente";
        timerElement.style.color = "#ffa500";
    } else {
        const timerKey = `timer_${type}_${etat.currentRaceIndex}`;
        creerTimer(dateEvent, timerKey, timerElement);
    }
}

// ===== FUNCTION: CRÉER TIMER COUNTDOWN =====
export function creerTimer(dateStr, timerKey, timerElement) {
    if (etat.timerIntervals[timerKey]) clearInterval(etat.timerIntervals[timerKey]);

    function updateTimer() {
        const now = new Date().getTime();
        const eventTime = new Date(dateStr).getTime();
        const diff = eventTime - now;

        if (diff <= 0) {
            timerElement.innerHTML = '⏳ C\'est parti !';
            timerElement.style.color = '#00ff00';
            clearInterval(etat.timerIntervals[timerKey]);
            delete etat.timerIntervals[timerKey];
            etat.rafraichirRecap?.()
            return false;
        }

        const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
        const heures = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secondes = Math.floor((diff % (1000 * 60)) / 1000);

        timerElement.innerHTML = `
            <div style="display:flex;gap:10px;font-weight:bold">
                <div style="text-align:center"><div style="font-size:1.5em;color:#e10600">${jours}</div><div style="font-size:0.8em;color:#ccc">jours</div></div>
                <div style="text-align:center"><div style="font-size:1.5em;color:#e10600">${heures}</div><div style="font-size:0.8em;color:#ccc">heures</div></div>
                <div style="text-align:center"><div style="font-size:1.5em;color:#e10600">${minutes}</div><div style="font-size:0.8em;color:#ccc">min</div></div>
                <div style="text-align:center"><div style="font-size:1.5em;color:#e10600">${secondes}</div><div style="font-size:0.8em;color:#ccc">sec</div></div>
            </div>
        `;
        return true;
    }

    if (!updateTimer()) return;

    etat.timerIntervals[timerKey] = setInterval(() => {
        if (!updateTimer()) clearInterval(etat.timerIntervals[timerKey]);
    }, 1000);
}
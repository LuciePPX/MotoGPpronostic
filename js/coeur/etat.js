import { DATA_CALENDRIER } from '../../config.js';

// ===== ÉTAT PARTAGÉ DU JEU =====
// Un seul objet exporté : les autres fichiers modifient ses propriétés (etat.x = ...).
// On ne peut pas réaffecter directement une variable importée en ES modules.
export const etat = {
    pseudo: '',
    sprintPredictions: {},
    racePredictions: {},
    sprintResults: {},
    raceResults: {},
    currentScores: {},
    currentRaceIndex: 0,
    timerIntervals: {},
    firebaseListeners: {},
    sprintValide: false,
    raceValide: false,
    draggedElement: null,
    draggedFromZone: null,
    zoneActive: null,
    coursesPassees: [],
    indexCoursePassee: 0,
    scoresDetailsCache: {},
    rafraichirRecap: null
};

// ===== FUNCTION: COURSE EN COURS =====
// Renvoie la prochaine course (ou la dernière si toutes sont passées)
// et met à jour l'index dans l'état
export function getRaceCourante() {
    const maintenant = new Date();

    for (let i = 0; i < DATA_CALENDRIER.length; i++) {
        const race = DATA_CALENDRIER[i];
        // On considère que la course est terminée 2h après le départ de la course
        const finRace = new Date(new Date(race.race).getTime() + 2 * 60 * 60 * 1000);

        if (maintenant < finRace) {
            etat.currentRaceIndex = i;
            return race;
        }
    }

    if (DATA_CALENDRIER.length > 0) {
        etat.currentRaceIndex = DATA_CALENDRIER.length - 1;
        return DATA_CALENDRIER[etat.currentRaceIndex];
    }

    return null;
}
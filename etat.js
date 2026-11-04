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
    scoresDetailsCache: {}
};
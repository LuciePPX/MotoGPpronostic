import { etat } from './etat.js';
import { afficherPiloteEnZone, mettreAJourAffichagePronostics } from './pronostics.js';
import { estUtilise, rafraichirPilotesUtilises } from './pilotes.js';

// ===== FUNCTION: RENDRE UNE CARTE GLISSABLE =====
export function attachDragListeners(card) {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
}

// ===== FUNCTION: DÉBUT ET FIN DU GLISSER =====
export function handleDragStart(e) {
    etat.draggedElement = e.target;
    etat.draggedFromZone = etat.draggedElement.closest('.step');
    e.target.style.opacity = '0.5';
}

export function handleDragEnd(e) {
    if (e.target) e.target.style.opacity = '1';
    etat.draggedElement = null;
    etat.draggedFromZone = null;
}


// ===== FUNCTION: VIDER UNE ZONE (logique commune) =====
function libererZone(zone) {
    const rank = zone.getAttribute('data-rank');
    const sectionId = zone.closest('[id^="section-"]')?.id;
    const type = sectionId === 'section-sprint' ? 'sprint' : 'race';
    const predictions = type === 'sprint' ? etat.sprintPredictions : etat.racePredictions;

    delete predictions[rank];

    const zoneContenu = zone.querySelector('.target-area') || zone;
    zoneContenu.innerHTML = '';

    const placeholder = zone.querySelector('small');
    if (placeholder) placeholder.style.display = '';
    zone.classList.remove('used-crash');
    zone.style.background = '';

    rafraichirPilotesUtilises();
    mettreAJourAffichagePronostics();
}

// ===== FUNCTION: setup drop zone  =====
export function setupDropZones() {
    const dropZones = document.querySelectorAll('.step');

    dropZones.forEach((zone) => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
        zone.addEventListener('dragleave', handleDragLeave);
    });

    // permettre de déposer sur la liste des pilotes pour retirer un pilote d'une zone
    const pilotesListContainer = document.querySelector('.pilotes-list');
    if (pilotesListContainer) {
        pilotesListContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        pilotesListContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            // si on lâche sur la liste, on retire simplement la prédiction
            if (!etat.draggedElement || !etat.draggedFromZone) return;

            const num = parseInt(etat.draggedElement.dataset.num);
            libererZone(etat.draggedFromZone);
        });
    }

    // écouteur global catch-all : si on lâche ailleurs que sur une zone ou la liste
    document.body.addEventListener('drop', (e) => {
        const targetZone = e.target.closest('.step');
        const overList = e.target.closest('.pilotes-list');
        if (targetZone || overList) return; // déjà géré
        if (!etat.draggedElement || !etat.draggedFromZone) return;

        const num = parseInt(etat.draggedElement.dataset.num);
        libererZone(etat.draggedFromZone);
    });
}


// ===== DRAG & DROP HANDLERS =====
// ===== FUNCTION: PLACER UN PILOTE DANS UNE ZONE =====
function executerDepot(zone, elementSource, zoneSource) {
    const sectionId = zone.closest('[id^="section-"]')?.id;
    const type = sectionId === 'section-sprint' ? 'sprint' : 'race';
    const predictions = type === 'sprint' ? etat.sprintPredictions : etat.racePredictions;
    const rank = zone.getAttribute('data-rank') || 'Chute';
    const num = parseInt(elementSource.dataset.num);
    const nom = elementSource.dataset.nom;

    // 0. Refuser si le pilote est déjà placé ailleurs dans cette session
    // (on ignore la zone d'origine, puisqu'on la vide juste après)
    const memeSection = zoneSource && zoneSource.closest('[id^="section-"]')?.id === sectionId;
    const rangOrigine = memeSection ? zoneSource.getAttribute('data-rank') : null;
    const dejaPlace = Object.entries(predictions).some(
        ([rang, valeur]) => valeur === num && rang !== rank && rang !== rangOrigine
    );
    if (dejaPlace) {
        alert("Ce pilote est déjà placé dans cette session.");
        return;
    }

    // 1. Vider la zone d'origine si on déplace une carte déjà posée
    if (zoneSource && zoneSource !== zone) {
        libererZone(zoneSource);
    }

    // 2. Placer le pilote (remplace celui qui était éventuellement dans la zone)
    predictions[rank] = num;
    const contentArea = zone.querySelector('.target-area') || zone;
    const placeholder = zone.querySelector('small');
    if (placeholder) placeholder.style.display = 'none';

    contentArea.innerHTML = afficherPiloteEnZone({ num, nom }, rank);
    attachDragListeners(contentArea.querySelector('.pilote-card'));
    contentArea.querySelector('.pilote-card').addEventListener('click', (e) => {
        e.stopPropagation();
        libererZone(zone);
    });

    // 3. Mettre à jour la liste : le pilote placé est marqué, le remplacé est libéré
    rafraichirPilotesUtilises();
    mettreAJourAffichagePronostics();
}


export function initClickAndSelect() {
    // 1. Gérer le clic sur les zones (Steps)
    document.querySelectorAll('.step').forEach(zone => {
        zone.addEventListener('click', (e) => {
          
            if (etat.zoneActive === zone) {
                // Si on reclique sur la même zone, on désactive
                zone.classList.remove('waiting-selection');
                etat.zoneActive = null;
            } else {
                // On active la nouvelle zone
                if (etat.zoneActive) etat.zoneActive.classList.remove('waiting-selection');
                etat.zoneActive = zone;
                zone.classList.add('waiting-selection');

                // Petit message console pour débugger
            }
        });
    });

    // 2. Gérer le clic sur les pilotes dans la liste
    // On utilise la délégation d'événement pour que ça marche même si la liste change
    document.querySelector('.pilotes-list').addEventListener('click', (e) => {
        const card = e.target.closest('.pilote-card');

        if (card && etat.zoneActive) {
            if (card.classList.contains('used')) {
                alert("Ce pilote est déjà utilisé !");
                return;
            }

            // Utilise ta fonction executerDepot existante !
            // On passe null pour zoneSource car c'est un nouveau choix depuis la liste
            executerDepot(etat.zoneActive, card, null);

            // On désactive la zone après le choix
            etat.zoneActive.classList.remove('waiting-selection');
            etat.zoneActive = null;
        }
    });
}
// ===== HANDLERS DU GLISSER-DÉPOSER SUR LES ZONES =====
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.style.background = 'rgba(225, 6, 0, 0.3)';
}

function handleDragLeave(e) {
    const zone = e.currentTarget;
    if (zone.classList.contains('crash-zone')) {
        zone.style.background = zone.classList.contains('used-crash') ? 'rgba(225, 6, 0, 0.2)' : 'rgba(225, 6, 0, 0.1)';
    } else {
        zone.style.background = '';
    }
}

function handleDrop(e) {
    e.preventDefault();
    executerDepot(e.currentTarget, etat.draggedElement, etat.draggedFromZone);
}
import { etat } from './etat.js';

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
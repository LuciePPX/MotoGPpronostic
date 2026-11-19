import { DATA_PILOTES } from '../../config.js';
import { etat } from '../coeur/etat.js';
import { normaliser } from '../coeur/utils.js';
import { handleDragStart, handleDragEnd } from './glisser.js';

// ===== FUNCTION: CRÉER LA LISTE DES PILOTES =====
export function genererPilotes() {
    const pilotesList = document.querySelector('.pilotes-list');
    if (!pilotesList) return;

    pilotesList.innerHTML = '';

    DATA_PILOTES.forEach((pilote) => {
        const div = document.createElement('div');
        div.className = 'pilote-card';
        div.draggable = true;
        div.dataset.num = pilote.num;
        div.dataset.nom = pilote.nom;
        div.textContent = `#${pilote.num} - ${pilote.nom}`;

        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragend', handleDragEnd);

        if (estUtilise(pilote.num)) {
            div.classList.add('used');
        }

        pilotesList.appendChild(div);
    });
}

// ===== FUNCTION: FILTRER LA LISTE PAR NOM OU NUMÉRO =====
export function filtrerPilotes(valeur) {
    const pilotesList = document.querySelectorAll('.pilotes-list .pilote-card');
    const recherche = normaliser(valeur);

    pilotesList.forEach((card) => {
        const nom = normaliser(card.dataset.nom);
        const num = card.dataset.num;
        const correspond = nom.includes(recherche) || num.includes(recherche);
        card.style.display = correspond ? 'block' : 'none';
    });
}

// ===== FUNCTION: BRANCHER LA RECHERCHE (une seule fois) =====
export function setupRecherche() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput || searchInput.dataset.branche) return;
    searchInput.dataset.branche = "1";

    searchInput.addEventListener('input', (e) => filtrerPilotes(e.target.value));
}

// ===== FUNCTION: LA SESSION AFFICHÉE (sprint ou course) =====
// La session affichée est celle dont le bloc n'est pas caché
export function sessionCourante() {
    return document.getElementById('section-sprint')?.classList.contains('hidden') ? 'race' : 'sprint';
}

// ===== FUNCTION: PILOTE DÉJÀ PLACÉ DANS LA SESSION COURANTE =====
export function estUtilise(num, type = sessionCourante()) {
    const predictions = type === 'sprint' ? etat.sprintPredictions : etat.racePredictions;
    return Object.values(predictions).includes(num);
}

// ===== FUNCTION: MARQUER LES PILOTES DÉJÀ UTILISÉS DANS LA LISTE =====
export function rafraichirPilotesUtilises() {
    document.querySelectorAll('.pilotes-list .pilote-card').forEach((card) => {
        card.classList.toggle('used', estUtilise(parseInt(card.dataset.num)));
    });
}
import { DATA_CALENDRIER } from './config.js';

// ===== CLÉ D'UNE COURSE (même règle que dans la base et dans Python) =====
export function cleCourse(gp) {
    return gp.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
}

// ===== NOM AFFICHÉ D'UNE COURSE À PARTIR DE SA CLÉ =====
// Retrouve le nom complet dans le calendrier, avec apostrophes et accents
export function libelleCourse(cle) {
    const course = DATA_CALENDRIER.find(c => cleCourse(c.gp) === cle);
    return course ? course.gp : cle.replace(/_/g, ' ');
}

// ===== TEXTE SANS ACCENTS, EN MINUSCULES (pour la recherche) =====
export function normaliser(texte) {
    return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
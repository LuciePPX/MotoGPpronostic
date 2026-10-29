import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { auth, db } from "./firebase-init.js";

// Lettres, chiffres, tiret et underscore, entre 2 et 15 caractères
const REGEX_PSEUDO = /^[A-Za-z0-9_-]{2,15}$/;

// ===== FONCTION: VÉRIFIER LE FORMAT DU PSEUDO =====
export function pseudoValide(pseudo) {
    return REGEX_PSEUDO.test(pseudo);
}

// ===== FONCTION: VÉRIFIER SI LE PSEUDO EST LIBRE =====
export async function pseudoDisponible(pseudo) {
    const snapshot = await get(ref(db, `pseudos/${pseudo}`));
    return !snapshot.exists();
}

// ===== FONCTION: RÉCUPÉRER LE PSEUDO D'UN COMPTE =====
export async function pseudoDeUtilisateur(uid) {
    const snapshot = await get(ref(db, `utilisateurs/${uid}`));
    return snapshot.exists() ? snapshot.val() : null;
}

// ===== FONCTION: INSCRIPTION =====
// Crée le compte, puis réserve le pseudo au nom de cet utilisateur
export async function inscription(email, motDePasse, pseudo) {
    if (!pseudoValide(pseudo)) {
        throw new Error("Pseudo invalide : 2 à 15 caractères, lettres, chiffres, - ou _.");
    }
    if (!(await pseudoDisponible(pseudo))) {
        throw new Error("Ce pseudo est déjà pris.");
    }

    const identifiants = await createUserWithEmailAndPassword(auth, email, motDePasse);
    const uid = identifiants.user.uid;

    await set(ref(db, `pseudos/${pseudo}`), uid);
    await set(ref(db, `utilisateurs/${uid}`), pseudo);

    return pseudo;
}

// ===== FONCTION: CONNEXION =====
export async function connexion(email, motDePasse) {
    const identifiants = await signInWithEmailAndPassword(auth, email, motDePasse);
    return await pseudoDeUtilisateur(identifiants.user.uid);
}

// ===== FONCTION: DÉCONNEXION =====
export function deconnexion() {
    return signOut(auth);
}

// ===== FONCTION: SURVEILLER LA CONNEXION =====
// Appelle callback(utilisateur) à chaque changement (connexion, déconnexion, rechargement)
export function surveillerConnexion(callback) {
    return onAuthStateChanged(auth, callback);
}

// ===== FONCTION: MESSAGE D'ERREUR EN FRANÇAIS =====
export function messageErreur(erreur) {
    const messages = {
        "auth/invalid-email": "Adresse email invalide.",
        "auth/missing-password": "Entre ton mot de passe.",
        "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
        "auth/email-already-in-use": "Un compte existe déjà avec cet email.",
        "auth/invalid-credential": "Email ou mot de passe incorrect.",
        "auth/too-many-requests": "Trop de tentatives, réessaie plus tard."
    };
    return messages[erreur.code] || erreur.message;
}

// ===== FONCTION: VÉRIFIER SI UN COMPTE EST ADMIN =====
export async function estAdministrateur(uid) {
    const snapshot = await get(ref(db, `admins/${uid}`));
    return snapshot.val() === true;
}
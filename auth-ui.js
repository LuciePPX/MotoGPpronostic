import {
    inscription,
    connexion,
    deconnexion,
    surveillerConnexion,
    pseudoDeUtilisateur,
    messageErreur
} from "./auth.js";

// ===== ÉLÉMENTS DE LA PAGE =====
const ecranConnexion = document.getElementById("login-screen");
const champEmail = document.getElementById("auth-email");
const champMotDePasse = document.getElementById("auth-mot-de-passe");
const champPseudo = document.getElementById("auth-pseudo");
const messageAuth = document.getElementById("auth-message");
const boutonValider = document.getElementById("btn-auth-valider");
const ongletConnexion = document.getElementById("onglet-connexion");
const ongletInscription = document.getElementById("onglet-inscription");

let mode = "connexion";
let pseudoSignale = null; // Évite d'envoyer deux fois l'événement pour le même joueur

// ===== FONCTION: CHANGER ENTRE CONNEXION ET INSCRIPTION =====
function afficherMode(nouveauMode) {
    mode = nouveauMode;
    const estInscription = mode === "inscription";

    ongletConnexion.classList.toggle("actif", !estInscription);
    ongletInscription.classList.toggle("actif", estInscription);
    champPseudo.classList.toggle("hidden", !estInscription);
    boutonValider.textContent = estInscription ? "Créer mon compte" : "Se connecter";
    messageAuth.textContent = "";
}

// ===== FONCTION: PRÉVENIR LE RESTE DU SITE QUE LE JOUEUR EST CONNECTÉ =====
function signalerJoueur(pseudo) {
    if (pseudoSignale === pseudo) return;
    pseudoSignale = pseudo;

    document.dispatchEvent(new CustomEvent("joueur-connecte", { detail: { pseudo } }));
}

// ===== FONCTION: BOUTON VALIDER (CONNEXION OU INSCRIPTION) =====
async function valider() {
    const email = champEmail.value.trim();
    const motDePasse = champMotDePasse.value;
    const pseudo = champPseudo.value.trim();

    messageAuth.textContent = "";
    boutonValider.disabled = true;

    try {
        if (mode === "inscription") {
            const pseudoCree = await inscription(email, motDePasse, pseudo);
            signalerJoueur(pseudoCree);
        } else {
            const pseudoConnecte = await connexion(email, motDePasse);
            if (pseudoConnecte) {
                signalerJoueur(pseudoConnecte);
            } else {
                messageAuth.textContent = "Ce compte n'a pas encore de pseudo.";
            }
        }
    } catch (erreur) {
        messageAuth.textContent = messageErreur(erreur);
    } finally {
        boutonValider.disabled = false;
    }
}

// ===== ÉVÉNEMENTS =====
boutonValider.addEventListener("click", valider);

champMotDePasse.addEventListener("keypress", (e) => {
    if (e.key === "Enter") valider();
});

ongletConnexion.addEventListener("click", () => afficherMode("connexion"));
ongletInscription.addEventListener("click", () => afficherMode("inscription"));

// ===== SURVEILLER LA CONNEXION =====
// Si le joueur est déjà connecté (rechargement de la page), on passe directement au jeu
surveillerConnexion(async (utilisateur) => {
    if (!utilisateur) return;

    const pseudo = await pseudoDeUtilisateur(utilisateur.uid);
    if (pseudo) signalerJoueur(pseudo);
});

// ===== BOUTON DÉCONNEXION =====
document.getElementById("btn-deconnexion")?.addEventListener("click", async () => {
    await deconnexion();
    location.reload();
});
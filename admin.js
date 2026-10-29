import { DATA_PILOTES, DATA_CALENDRIER } from "./config.js";
import { ref, set, get, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { db } from "./firebase-init.js";
import { surveillerConnexion } from "./auth.js";

// ===== CONTRÔLE D'ACCÈS =====
// La page n'est accessible qu'à un compte connecté et listé dans admins
surveillerConnexion(async (utilisateur) => {
    if (!utilisateur) {
        window.location.href = "index.html";
        return;
    }

    const estAdmin = (await get(ref(db, `admins/${utilisateur.uid}`))).val() === true;
    if (!estAdmin) {
        alert("Accès réservé à l'administrateur.");
        window.location.href = "index.html";
    }
});

// --- UTILITAIRES ---
function getRaceCourante() {
    const maintenant = new Date();
    for (let race of DATA_CALENDRIER) {
        const dateRace = new Date(race.race);
        const finRace = new Date(dateRace.getTime() + 2 * 60 * 60 * 1000);
        if (maintenant < finRace) return race;
    }
    return DATA_CALENDRIER[DATA_CALENDRIER.length - 1];
}

function getRaceKey(race) {
    return race.gp.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
}

function remplirCourses() {
    const select = document.getElementById("select-race");
    if (!select) return;

    DATA_CALENDRIER.forEach(race => {
        const option = document.createElement("option");

        option.value = getRaceKey(race);
        option.textContent = race.gp;

        select.appendChild(option);
    });
}

function remplirSelect(select) {
    if(!select) return;
    select.innerHTML = `<option value="">-- Choisir --</option>`;
    const pilotes = [...DATA_PILOTES].sort((a, b) => a.nom.localeCompare(b.nom));
    pilotes.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.num;
        opt.textContent = `#${p.num} - ${p.nom}`;
        select.appendChild(opt);
    });
}

// --- INITIALISATION INTERFACE ---
document.querySelectorAll("#res-1, #res-2, #res-3, .res-chute").forEach(remplirSelect);

remplirCourses();
document.getElementById("add-crash").onclick = () => {
    const sel = document.createElement("select");
    sel.className = "res-chute";
    remplirSelect(sel);
    document.getElementById("crash-selects-container").appendChild(sel);
};

// --- LOGIQUE PUBLICATION ---
const btnPublier = document.getElementById("btn-publier");
if (btnPublier) {
    btnPublier.onclick = async () => {

        const session = document.getElementById("type-session").value; 
        const raceKey = document.getElementById("select-race").value;

        const chutes = [...document.querySelectorAll(".res-chute")]
            .map(s => parseInt(s.value))
            .filter(v => !isNaN(v));

        const results = {
            "1er": parseInt(document.getElementById("res-1").value),
            "2e": parseInt(document.getElementById("res-2").value),
            "3e": parseInt(document.getElementById("res-3").value),
            "Chute": chutes,
            "timestamp": new Date().toISOString()
        };

        if (!results["1er"]) return alert("Sélectionnez au moins le vainqueur");

        try {
            await set(ref(db, `resultats/${raceKey}/${session}`), results);
            await executerRecalculGlobal(); // Recalcule tout après publication
            document.getElementById("status-msg").textContent = "✅ Résultats publiés et scores mis à jour !";
        } catch (error) {
            console.error(error);
            alert("Erreur Firebase");
        }
    };
}

// --- LOGIQUE RECALCUL (Harmonisé avec l'ID HTML) ---
const btnRecalcul = document.getElementById("btn-recalcul-global");
if (btnRecalcul) {
    btnRecalcul.onclick = async () => {
        await executerRecalculGlobal();
    };
}
async function executerRecalculGlobal() {
    const status = document.getElementById("status-msg");
    status.textContent = "⏳ Recalcul global en cours...";

    try {
        const [snapPronos, snapResults] = await Promise.all([
            get(ref(db, "pronostics")),
            get(ref(db, "resultats"))
        ]);

        if (!snapPronos.exists() || !snapResults.exists()) {
            status.textContent = "❌ Données manquantes.";
            return;
        }

        const pronosGlobal = snapPronos.val();
        const resultsGlobal = snapResults.val();
        const nouveauxScoresTotaux = {};
        const pointsParPosition = { '1er': 3, '2e': 2, '3e': 1 };

        for (const joueur in pronosGlobal) {
            let totalJoueur = 0;
            const pronosJoueur = pronosGlobal[joueur];

            for (const raceKey in pronosJoueur) {
                for (const type in pronosJoueur[raceKey]) {

                    const prono = pronosJoueur[raceKey][type];
                    const officiel = resultsGlobal[raceKey]?.[type];

                    if (!officiel) continue;
                    
                    let detail = { "1er": 0, "2e": 0, "3e": 0, "Chute": 0, "total": 0 };
                    const podiumReel = [officiel['1er'], officiel['2e'], officiel['3e']];
                    const placeListe = ['1er', '2e', '3e']

                    placeListe.forEach((place, indexProno)=> {

                        const piloteProno = parseInt(prono[place]);
                        if (!piloteProno) return; 
                        
                        // On vérifie si le pilote pronostiqué est dans le podium officiel
                        // On attribue les points en conséquence. 
                        // Si le pilote n'est pas dans le podium, on attribue -1 point.
                        const indexReel = podiumReel.indexOf(piloteProno);

                        if (indexReel !== -1) {
                            const estBonnePlace = indexProno == indexReel;
                            detail[place] = estBonnePlace ? pointsParPosition[place] : 1;
                        } else {
                            detail[place] = -1; 
                        }
                    });

                    if (prono['Chute'] && officiel['Chute']) {
                        const listChutes = Array.isArray(officiel['Chute']) ? officiel['Chute'] : [officiel['Chute']];
                        if (listChutes.includes(parseInt(prono['Chute']))) detail['Chute'] = 2;
                    }

                    detail.total = detail["1er"] + detail["2e"] + detail["3e"] + detail["Chute"];
                    totalJoueur += detail.total;

                    await set(ref(db, `scores_details/${joueur}/${raceKey}/${type}`), detail);
                }
            }
            nouveauxScoresTotaux[joueur] = totalJoueur;
        }

        // --- SAUVEGARDE FINALE DU CLASSEMENT ---
        await set(ref(db, "scores"), nouveauxScoresTotaux);
        status.textContent = "✅ Recalcul terminé !";
        console.log("Nouveaux scores calculés :", nouveauxScoresTotaux);

    } catch (error) {
        console.error("Erreur lors du recalcul :", error);
        status.textContent = "❌ Erreur critique lors du recalcul.";
    }
}

// ===== ONGLETS DE LA PAGE ADMIN =====
document.querySelectorAll(".onglets-admin .btn-onglet").forEach((bouton) => {
    bouton.addEventListener("click", () => {
        document.querySelectorAll(".onglets-admin .btn-onglet")
            .forEach((b) => b.classList.remove("actif"));
        document.querySelectorAll(".admin-panneau")
            .forEach((p) => p.classList.remove("actif"));

        bouton.classList.add("actif");
        document.getElementById(`onglet-${bouton.dataset.onglet}`).classList.add("actif");
    });
});

// ===== ENVOYER UNE NOTIFICATION =====
// 1. Enregistre le message dans la base
// 2. Lance le workflow GitHub qui l'envoie aux appareils
document.getElementById("btn-envoyer-notif")?.addEventListener("click", async () => {
    const titre = document.getElementById("notif-titre").value.trim();
    const message = document.getElementById("notif-message").value.trim();
    const statut = document.getElementById("notif-statut");
    const bouton = document.getElementById("btn-envoyer-notif");

    if (!titre || !message) {
        statut.textContent = "Remplis le titre et le message.";
        return;
    }

    bouton.disabled = true;
    statut.textContent = "⏳ Envoi en cours...";

    try {
        await push(ref(db, "notifications"), {
            titre,
            message,
            date: new Date().toISOString(),
            envoyee: false
        });

        const jeton = (await get(ref(db, "config_admin/github_token"))).val();
        if (!jeton) throw new Error("jeton GitHub absent de la base");

        await lancerEnvoiGitHub(jeton);

        statut.textContent = "✅ Notification envoyée. Elle arrive dans 1 à 2 minutes.";
        document.getElementById("notif-titre").value = "";
        document.getElementById("notif-message").value = "";
    } catch (erreur) {
        console.error(erreur);
        statut.textContent = `❌ Erreur : ${erreur.message}. Elle partira au prochain envoi automatique.`;
    } finally {
        bouton.disabled = false;
    }
});

// ===== LANCER LE WORKFLOW D'ENVOI SUR GITHUB =====
const GITHUB_DEPOT = "LuciePPX/MotoGPpronostic";
const GITHUB_WORKFLOW = "notifications.yml";

async function lancerEnvoiGitHub(jeton) {
    const reponse = await fetch(
        `https://api.github.com/repos/${GITHUB_DEPOT}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
        {
            method: "POST",
            headers: {
                "Accept": "application/vnd.github+json",
                "Authorization": `Bearer ${jeton}`,
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ ref: "main" })
        }
    );

    if (!reponse.ok) {
        throw new Error(`GitHub a répondu ${reponse.status}`);
    }
}

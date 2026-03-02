import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { DATA_PILOTES, DATA_CALENDRIER } from "./config.js";

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
    apiKey: "AIzaSyBYjWjsY5eHOjrQOD2nJhXh0lZuQLwM6YQ",
    authDomain: "motogp-pronostic.firebaseapp.com",
    databaseURL: "https://motogppronostic-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "motogp-pronostic",
    storageBucket: "motogp-pronostic.appspot.com",
    messagingSenderId: "1082916850330",
    appId: "1:1082916850330:web:dbf5d1c7d8e47d86f01b75"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

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
        const pass = document.getElementById("admin-pass").value;
        if (pass !== "1234") return alert("Mot de passe incorrect");

        const session = document.getElementById("type-session").value; 
        const raceCourante = getRaceCourante();
        const raceKey = getRaceKey(raceCourante);

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
        const pass = document.getElementById("admin-pass").value;
        if (pass !== "1234") return alert("Mot de passe incorrect");
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

        for (const pseudo in pronosGlobal) {
            let totalJoueur = 0;
            const gps = pronosGlobal[pseudo];

            for (const rKey in gps) {
                for (const type in gps[rKey]) {
                    const prono = gps[rKey][type];
                    const officiel = resultsGlobal[rKey]?.[type];

                    if (!officiel) continue;
                    
                    let detail = { "1er": 0, "2e": 0, "3e": 0, "Chute": 0, "total": 0 };
                    const podiumReel = [officiel['1er'], officiel['2e'], officiel['3e']];

                    ['1er', '2e', '3e'].forEach(rank => {
                        const piloteProno = parseInt(prono[rank]);
                        if (!piloteProno) return; 

                        const idx = podiumReel.indexOf(piloteProno);

                        if (idx !== -1) {
                            const placeReelle = ['1er', '2e', '3e'][idx];
                            detail[rank] = (placeReelle === rank) ? pointsParPosition[rank] : 1;
                        } else {
                            detail[rank] = -1; 
                        }
                    });

                    if (prono['Chute'] && officiel['Chute']) {
                        const listChutes = Array.isArray(officiel['Chute']) ? officiel['Chute'] : [officiel['Chute']];
                        if (listChutes.includes(parseInt(prono['Chute']))) detail['Chute'] = 2;
                    }

                    detail.total = detail["1er"] + detail["2e"] + detail["3e"] + detail["Chute"];
                    totalJoueur += detail.total;

                    await set(ref(db, `scores_details/${pseudo}/${rKey}/${type}`), detail);
                }
            }
            nouveauxScoresTotaux[pseudo] = totalJoueur;
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
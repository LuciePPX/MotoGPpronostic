import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { DATA_PILOTES, DATA_CALENDRIER } from "./config.js";

// --- Firebase ---
const firebaseConfig = {
 apiKey: "AIzaSyAlWxI_w2R6eyJYBg9h_ynHWAgz3VS51Zk",
 authDomain: "motogppronostic.firebaseapp.com",
 databaseURL: "https://motogppronostic-default-rtdb.europe-west1.firebasedatabase.app",
 projectId: "motogppronostic"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Fonctions communes avec script.js ---
export function getRaceCourante() {
    const maintenant = new Date();
    for (let i = 0; i < DATA_CALENDRIER.length; i++) {
        const race = DATA_CALENDRIER[i];
        const dateRace = new Date(race.race);
        const finRace = new Date(dateRace.getTime() + 2*60*60*1000);
        if (maintenant < finRace) return race;
    }
    return DATA_CALENDRIER.length > 0 ? DATA_CALENDRIER[DATA_CALENDRIER.length-1] : null;
}

export function getRaceKey(race) {
    return race.gp.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
}

function remplirSelect(select) {
 select.innerHTML = `<option value="">-- Choisir --</option>`;
 const pilotes = [...DATA_PILOTES].sort((a,b)=>a.nom.localeCompare(b.nom));
 pilotes.forEach(p=>{
  const opt=document.createElement("option");
  opt.value=p.num;
  opt.textContent=`#${p.num} - ${p.nom}`;
  select.appendChild(opt);
 });
}

// --- Remplir podium et chute ---
["res-1","res-2","res-3"].forEach(id=>{
 remplirSelect(document.getElementById(id));
});
remplirSelect(document.querySelector(".res-chute"));

// --- Ajouter chute ---
document.getElementById("add-crash").onclick = () => {
 const sel = document.createElement("select");
 sel.className = "res-chute";
 remplirSelect(sel);
 document.getElementById("crash-selects-container").appendChild(sel);
};

// --- Publier ---
document.getElementById("btn-publier").onclick = async () => {
 const pass = document.getElementById("admin-pass").value;
 if(pass !== "1234") return alert("Mot de passe incorrect");

 const session = document.getElementById("type-session").value;

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

 if(!results["1er"]) return alert("Choisis au moins le vainqueur");

 const raceCourante = getRaceCourante();
 if(!raceCourante) return alert("Aucune course disponible");
 const raceKey = getRaceKey(raceCourante);

 await set(ref(db, `resultats/${raceKey}/${session}`), results);

 document.getElementById("status-msg").textContent = "✅ Résultats publiés";
};
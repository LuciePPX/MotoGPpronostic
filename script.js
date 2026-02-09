const race = { name: "GP France - Le Mans" };

const pilotes = [
  "Bagnaia", "Martin", "Marquez", "Quartararo", "Binder",
  "Bezzecchi", "Acosta", "Zarco", "Viñales", "Bastianini"
];

const newPlayer = document.getElementById("new-player");
const scoreTable = document.getElementById("score-table");
const predictionTable = document.getElementById("prediction-table");

const listContainer = document.getElementById('pilotes-list');
let pilotesUtilises = []; // Pour empêcher de choisir deux fois le même
let players = [];


function genererPilotes() {
    const listContainer = document.getElementById('pilotes-list');
    listContainer.innerHTML = ''; // Reset la liste
    pilotesUtilises = []; 

    pilotes.forEach(nom => {
        const div = document.createElement('div');
        div.className = 'pilote-card';
        div.id = `p-${nom}`;
        div.draggable = true;
        div.innerText = nom;
        
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', nom);
        });
        
        listContainer.appendChild(div);
    });
}


function genererPilotes() {
    const listContainer = document.getElementById('pilotes-list');
    listContainer.innerHTML = ''; 
    pilotesUtilises = []; 

    pilotes.forEach(nom => {
        const div = document.createElement('div');
        div.className = 'pilote-card';
        div.id = `p-${nom.replace(/\s+/g, '')}`; // ID unique sans espace
        div.draggable = true;
        div.innerText = nom;
        
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', nom);
        });
        
        listContainer.appendChild(div);
    });
}

// Initialisation
genererPilotes();

const steps = document.querySelectorAll('.step');
steps.forEach(step => {
    step.addEventListener('dragover', e => e.preventDefault());
    
    step.addEventListener('drop', e => {
        e.preventDefault();
        const nouveauNom = e.dataTransfer.getData('text/plain');
        
        // 1. Si le pilote est déjà ailleurs sur LE MÊME podium, on l'empêche
        if (pilotesUtilises.includes(nouveauNom)) {
            alert(nouveauNom + " est déjà sur le podium !");
            return;
        }

        // 2. Gestion du remplacement (si la marche est déjà occupée)
        const ancienPiloteElement = step.querySelector('.dropped-name');
        if (ancienPiloteElement) {
            const ancienNom = ancienPiloteElement.innerText;
            // On retire l'ancien nom de la liste des utilisés
            pilotesUtilises = pilotesUtilises.filter(name => name !== ancienNom);
            // On lui redonne son aspect normal dans la liste de gauche
            const cardId = `p-${ancienNom.replace(/\s+/g, '')}`;
            if(document.getElementById(cardId)) {
                document.getElementById(cardId).classList.remove('used');
            }
        }

        // 3. Installation du nouveau pilote
        pilotesUtilises.push(nouveauNom);
        const nouvelleCardId = `p-${nouveauNom.replace(/\s+/g, '')}`;
        document.getElementById(nouvelleCardId).classList.add('used');

        // 4. Mise à jour visuelle de la marche
        const rank = step.getAttribute('data-rank');
        step.innerHTML = `<small style="color:white">${rank}</small><div class="dropped-name">${nouveauNom}</div>`;
        step.style.borderStyle = 'solid';
    });
});

function validerCourse(type) {
    const podiumActuel = type === 'Sprint' ? 'section-sprint' : 'section-race';
    const nomsPoses = document.getElementById(podiumActuel).querySelectorAll('.dropped-name');

    if (nomsPoses.length < 3) {
        alert("Le podium doit être complet (1er, 2e et 3e) !");
        return;
    }

    if (type === 'Sprint') {
        document.getElementById('section-sprint').classList.add('hidden');
        document.getElementById('section-race').classList.remove('hidden');
        document.getElementById('current-title').innerText = "Pronostics : GRAND PRIX";
        
        // RESET pour la course suivante
        genererPilotes();
    } else {
        alert("✅ Pronostics terminés !");
    }
}
/* ===== SELECT GENERATOR ===== */
function createSelect(name, dataI = null, dataC = null) {
  let html = `<select ${dataI !== null ? `data-i="${dataI}"` : ""} ${dataC ? `data-c="${dataC}"` : ""} id="${name || ""}">`;
  html += `<option value="">--</option>`;
  pilotes.forEach(p => {
    html += `<option value="${p}">${p}</option>`;
  });
  html += `</select>`;
  return html;
}

/* ===== RESULTS REAL ===== */
document.getElementById("sprint-row").innerHTML += `
  <td>${createSelect("s1")}</td>
  <td>${createSelect("s2")}</td>
  <td>${createSelect("s3")}</td>
  <td>${createSelect("sc")}</td>
`;

document.getElementById("race-row").innerHTML += `
  <td>${createSelect("r1")}</td>
  <td>${createSelect("r2")}</td>
  <td>${createSelect("r3")}</td>
  <td>${createSelect("rc")}</td>
`;

/* ===== PLAYERS ===== */
function addPlayer() {
  const name = newPlayer.value.trim();
  if (!name) return;
  players.push({ name, points: 0 });
  render();
  newPlayer.value = "";
}

function render() {
  scoreTable.innerHTML = "";
  predictionTable.innerHTML = "";

  players.forEach((p, i) => {
    scoreTable.innerHTML += `<tr><td>${p.name}</td><td>${p.points}</td></tr>`;

    predictionTable.innerHTML += `
    <tr>
      <td>${p.name}</td>
      <td>${createSelect("", i, "s1")}</td>
      <td>${createSelect("", i, "s2")}</td>
      <td>${createSelect("", i, "s3")}</td>
      <td>${createSelect("", i, "sc")}</td>
      <td>${createSelect("", i, "r1")}</td>
      <td>${createSelect("", i, "r2")}</td>
      <td>${createSelect("", i, "r3")}</td>
      <td>${createSelect("", i, "rc")}</td>
    </tr>`;
  });
}

function getResults() {
  return {
    sprint: [s1.value, s2.value, s3.value],
    race: [r1.value, r2.value, r3.value],
    sprintCrash: sc.value,
    raceCrash: rc.value
  };
}

function calculateCourse(predPodium, realPodium) {
  let pts = 0;
  const weights = [3,2,1];

  predPodium.forEach((pilot, idx) => {
    if (!pilot) return;
    if (pilot === realPodium[idx]) pts += weights[idx];
    else if (realPodium.includes(pilot)) pts += 1;
    else pts -= 3;
  });

  return pts;
}

function calculatePoints() {
  const results = getResults();

  players.forEach((p, i) => {
    let selects = document.querySelectorAll(`select[data-i="${i}"]`);
    let pred = {};
    selects.forEach(sel => pred[sel.dataset.c] = sel.value);

    let sprintPts = calculateCourse([pred.s1, pred.s2, pred.s3], results.sprint);
    let racePts = calculateCourse([pred.r1, pred.r2, pred.r3], results.race);

    if (pred.sc === results.sprintCrash && pred.sc !== "") sprintPts += 1;
    if (pred.rc === results.raceCrash && pred.rc !== "") racePts += 1;

    p.points += sprintPts + racePts;
  });

  render();
}

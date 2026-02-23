function creerSelectPilote() {
    const newSelect = document.createElement('select');
    newSelect.className = 'res-chute';
    newSelect.innerHTML = `<option value="">-- Pilote --</option>`;

    const pilotesTries = [...DATA_PILOTES].sort((a, b) => a.nom.localeCompare(b.nom));
    pilotesTries.forEach(p => {
        const option = document.createElement('option');
        option.value = p.num;
        option.textContent = `#${p.num} - ${p.nom}`;
        newSelect.appendChild(option); // ✅
    });

    return newSelect;
}

document.getElementById('add-crash').onclick = () => {
    const container = document.getElementById('crash-selects-container');
    const allPilotes = document.getElementById('res-1').innerHTML; // On récupère le contenu déjà chargé
    const newSelect = document.createElement('select');
    newSelect.className = 'res-chute';
    newSelect.innerHTML = allPilotes;
    container.appendChild(newSelect);
};
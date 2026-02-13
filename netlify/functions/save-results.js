const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { csvLine, fileName } = JSON.parse(event.body);
    const token = process.env.GITHUB_TOKEN;
    const repoOwner = "LuciePPX"; 
    const repoName = "MotoGPpronostic"; 

    const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${fileName}`;

    try {
        // 1. Récupérer le fichier actuel pour avoir son SHA
        let sha = "";
        let content = "gp,type,1er,2e,3e,chute\n"; 

        try {
            const getFile = await axios.get(url, { headers: { Authorization: `token ${token}` } });
            sha = getFile.data.sha;
            content = Buffer.from(getFile.data.content, 'base64').toString();
        } catch (e) { /* Le fichier sera créé s'il n'existe pas */ }

        // 2. Logique de remplacement ou ajout
        let lignes = content.trim().split('\n');
        const nouvelleLigne = `${nomGP},${type},${p1},${p2},${p3},${chute}`;
        
        // On cherche si une ligne avec le même GP ET le même type existe
        let indexExistante = lignes.findIndex(l => l.startsWith(`${nomGP},${type}`));

        if (indexExistante !== -1) {
            lignes[indexExistante] = nouvelleLigne; // On remplace
        } else {
            lignes.push(nouvelleLigne); // On ajoute
        }

        const finalContent = lignes.join('\n');

        await axios.put(url, {
            message: `Résultat ${nomGP} - ${type}`,
            content: Buffer.from(finalContent).toString('base64'),
            sha: sha || undefined
        }, { headers: { Authorization: `token ${token}` } });

        return { statusCode: 200, body: "OK" };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify(error.message) };
    }
};
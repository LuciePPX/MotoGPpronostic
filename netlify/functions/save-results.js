const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 1. EXTRACTION DES DONNÉES ENVOYÉES PAR LE SCRIPT.JS
    // On récupère précisément ce que tu as mis dans le JSON.stringify du client
    const { nomGP, type, p1, p2, p3, chute, fileName } = JSON.parse(event.body);
    
    const token = process.env.GITHUB_TOKEN;
    const repoOwner = "LuciePPX"; 
    const repoName = "MotoGPpronostic"; 

    const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${fileName}`;

    try {
        let sha = "";
        let content = "gp,type,1er,2e,3e,chute\n"; // Entête par défaut

        // 2. RÉCUPÉRATION DU FICHIER EXISTANT
        try {
            const getFile = await axios.get(url, { 
                headers: { Authorization: `token ${token}` } 
            });
            sha = getFile.data.sha;
            content = Buffer.from(getFile.data.content, 'base64').toString();
        } catch (e) { 
            console.log("Le fichier n'existe pas encore, il sera créé.");
        }

        // 3. LOGIQUE DE REMPLACEMENT OU AJOUT
        let lignes = content.trim().split('\n');
        
        // On construit la nouvelle ligne
        const nouvelleLigne = `${nomGP},${type},${p1},${p2},${p3},${chute}`;
        
        // On cherche si une ligne avec le même GP ET le même type existe déjà
        // On utilise startsWith pour comparer le début de la ligne (nomGP,type)
        let indexExistante = lignes.findIndex(l => l.startsWith(`${nomGP},${type}`));

        if (indexExistante !== -1) {
            console.log("Ligne trouvée, remplacement...");
            lignes[indexExistante] = nouvelleLigne; // On remplace la ligne à l'index trouvé
        } else {
            console.log("Nouvelle ligne, ajout...");
            lignes.push(nouvelleLigne); // On ajoute à la fin
        }

        const finalContent = lignes.join('\n');

        // 4. ENVOI VERS GITHUB
        await axios.put(url, {
            message: `Résultat officiel : ${nomGP} - ${type}`,
            content: Buffer.from(finalContent).toString('base64'),
            sha: sha || undefined
        }, { 
            headers: { Authorization: `token ${token}` } 
        });

        return { 
            statusCode: 200, 
            body: JSON.stringify({ message: "Fichier mis à jour avec succès" }) 
        };

    } catch (error) {
        console.error("Erreur détaillée:", error.response ? error.response.data : error.message);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
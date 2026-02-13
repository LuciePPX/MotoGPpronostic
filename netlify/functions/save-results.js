const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { csvLine, fileName } = JSON.parse(event.body);
    const token = process.env.GITHUB_TOKEN;
    const repoOwner = "LuciePPX"; 
    const repoName = "MotoGPpronosti"; 

    const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${fileName}`;

    try {
        // 1. Récupérer le fichier actuel pour avoir son SHA
        let sha = "";
        let existingContent = "";
        try {
            const getFile = await axios.get(url, {
                headers: { Authorization: `token ${token}` }
            });
            sha = getFile.data.sha;
            existingContent = Buffer.from(getFile.data.content, 'base64').toString();
        } catch (e) {
            // Si le fichier n'existe pas encore, on commence avec une entête
            existingContent = "type,1er,2e,3e,chute";
        }

        // 2. Ajouter la nouvelle ligne
        const newContent = existingContent + "\n" + csvLine;
        
        // 3. Envoyer vers GitHub
        await axios.put(url, {
            message: `Mise à jour résultats officiels : ${csvLine.split(',')[0]}`,
            content: Buffer.from(newContent).toString('base64'),
            sha: sha || undefined
        }, {
            headers: { Authorization: `token ${token}` }
        });

        return { statusCode: 200, body: JSON.stringify({ message: "Succès" }) };
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
import json
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

import firebase_admin
from firebase_admin import credentials, db

URL_BASE = "https://motogppronostic-default-rtdb.europe-west1.firebasedatabase.app"
FUSEAU = ZoneInfo("Europe/Paris")


def cle_course(gp):
    # Même transformation que le site : seulement des caractères ASCII
    return re.sub(r"[^\w-]", "", re.sub(r"\s+", "_", gp), flags=re.ASCII)


def en_millisecondes(texte):
    dt = datetime.fromisoformat(texte).replace(tzinfo=FUSEAU)
    return int(dt.timestamp() * 1000)

if __name__ == "__main__":
    # La clé vient du secret GitHub, jamais du code
    cle = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
    firebase_admin.initialize_app(credentials.Certificate(cle), {"databaseURL": URL_BASE})

    chemin = os.path.join(os.path.dirname(__file__), "calendrier.json")
    with open(chemin, encoding="utf-8") as f:
        calendrier = json.load(f)

    donnees = {
        cle_course(c["gp"]): {
            "sprint": en_millisecondes(c["sprint"]),
            "race": en_millisecondes(c["race"]),
        }
        for c in calendrier
    }

    db.reference("calendrier").set(donnees)
    print(f"{len(donnees)} courses enregistrées.")

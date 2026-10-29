import json
import os

import firebase_admin
from firebase_admin import credentials, db, messaging

URL_BASE = "https://motogppronostic-default-rtdb.europe-west1.firebasedatabase.app"
LIEN_SITE = "https://lucieppx.github.io/MotoGPpronostic/"


def initialiser():
    # La clé vient du secret GitHub, jamais écrite dans le code
    cle = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
    firebase_admin.initialize_app(credentials.Certificate(cle), {"databaseURL": URL_BASE})


def tous_les_jetons():
    """Récupère les jetons de tous les appareils, sans doublon."""
    jetons = []
    for pseudo, appareils in (db.reference("tokens").get() or {}).items():
        if isinstance(appareils, dict):
            jetons.extend(appareils.keys())
        elif isinstance(appareils, str):
            jetons.append(appareils)  # ancien format, un seul jeton
    return list(set(jetons))


def envoyer_en_attente():
    notifs = db.reference("notifications").get() or {}
    en_attente = {id_: n for id_, n in notifs.items() if not n.get("envoyee")}

    if not en_attente:
        print("Aucune notification en attente.")
        return

    jetons = tous_les_jetons()
    if not jetons:
        print("Aucun appareil enregistré.")
        return

    for id_, notif in en_attente.items():
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=notif["titre"],
                body=notif["message"]
            ),
            tokens=jetons,
            webpush=messaging.WebpushConfig(
                fcm_options=messaging.WebpushFCMOptions(link=LIEN_SITE)
            )
        )
        reponse = messaging.send_each_for_multicast(message)
        print(f"« {notif['titre']} » : envoyées {reponse.success_count}, échecs {reponse.failure_count}")

        # Marque la notification comme envoyée pour ne jamais la renvoyer
        db.reference(f"notifications/{id_}/envoyee").set(True)


if __name__ == "__main__":
    initialiser()
    envoyer_en_attente()
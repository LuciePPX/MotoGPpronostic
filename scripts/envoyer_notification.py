import json
import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import firebase_admin
from firebase_admin import credentials, db, messaging

URL_BASE = "https://motogppronostic-default-rtdb.europe-west1.firebasedatabase.app"
LIEN_SITE = "https://lucieppx.github.io/MotoGPpronostic/"
FUSEAU = ZoneInfo("Europe/Paris")
HEURE_RAPPEL = 9  # heure du rappel, la veille du sprint
JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def initialiser():
    # La clé vient du secret GitHub, jamais écrite dans le code
    cle = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
    firebase_admin.initialize_app(credentials.Certificate(cle), {"databaseURL": URL_BASE})


def cle_course(gp):
    # Même transformation que le site (ASCII uniquement, comme en JavaScript)
    return re.sub(r"[^\w-]", "", re.sub(r"\s+", "_", gp), flags=re.ASCII)


def heure_paris(texte):
    return datetime.fromisoformat(texte).replace(tzinfo=FUSEAU)


def formater(dt):
    return f"{JOURS[dt.weekday()]} {dt.day:02d}/{dt.month:02d} à {dt.hour}h{dt.minute:02d}"


def tous_les_jetons():
    jetons = []
    for appareils in (db.reference("tokens").get() or {}).values():
        if isinstance(appareils, dict):
            jetons.extend(appareils.keys())
        elif isinstance(appareils, str):
            jetons.append(appareils)  # ancien format, un seul jeton
    return list(set(jetons))


def envoyer_a_tous(titre, corps):
    jetons = tous_les_jetons()
    if not jetons:
        print("Aucun appareil enregistré.")
        return

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=titre, body=corps),
        tokens=jetons,
        webpush=messaging.WebpushConfig(
            fcm_options=messaging.WebpushFCMOptions(link=LIEN_SITE)
        )
    )
    reponse = messaging.send_each_for_multicast(message)
    print(f"« {titre} » : envoyées {reponse.success_count}, échecs {reponse.failure_count}")


def envoyer_resultats(notif):
    """Envoie à chaque joueur le podium commun et ses points personnels."""
    cle, session = notif["course"], notif["session"]

    for pseudo, appareils in (db.reference("tokens").get() or {}).items():
        jetons = list(appareils.keys()) if isinstance(appareils, dict) else [appareils]
        if not jetons:
            continue

        detail = db.reference(f"scores_details/{pseudo}/{cle}/{session}").get()
        if detail:
            perso = f"Tes points : {int(detail.get('total') or 0):+d}"
        else:
            perso = "Tu n'avais pas de prono sur cette session."

        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=notif["titre"],
                body=f"{notif['message']}\n{perso}"
            ),
            tokens=list(set(jetons)),
            webpush=messaging.WebpushConfig(
                fcm_options=messaging.WebpushFCMOptions(link=LIEN_SITE)
            )
        )
        reponse = messaging.send_each_for_multicast(message)
        print(f"{pseudo} : envoyées {reponse.success_count}, échecs {reponse.failure_count}")


def envoyer_notifications_manuelles():
    """Messages écrits dans l'admin, et résultats publiés."""
    notifs = db.reference("notifications").get() or {}
    for id_, notif in notifs.items():
        if notif.get("envoyee"):
            continue
        if notif.get("type") == "resultats":
            envoyer_resultats(notif)
        else:
            envoyer_a_tous(notif["titre"], notif["message"])
        db.reference(f"notifications/{id_}/envoyee").set(True)
        

def envoyer_rappels_courses(maintenant):
    """Rappel la veille du sprint à 9h, une seule fois par course."""
    with open(os.path.join(os.path.dirname(__file__), "calendrier.json"), encoding="utf-8") as f:
        calendrier = json.load(f)

    for course in calendrier:
        sprint = heure_paris(course["sprint"])
        race = heure_paris(course["race"])
        rappel = (sprint - timedelta(days=1)).replace(hour=HEURE_RAPPEL, minute=0)

        # Hors de la fenêtre : trop tôt, ou sprint déjà commencé
        if maintenant < rappel or maintenant >= sprint:
            continue

        cle = cle_course(course["gp"])
        drapeau = db.reference(f"rappels/{cle}")
        if drapeau.get():
            continue  # déjà envoyé

        corps = (
            f"Sprint : {formater(sprint)}. "
            f"Course : {formater(race)}. "
            "Pense à valider tes pronos !"
        )
        envoyer_a_tous(f"Pronos {course['gp']}", corps)
        drapeau.set(True)


if __name__ == "__main__":
    initialiser()
    envoyer_notifications_manuelles()
    envoyer_rappels_courses(datetime.now(FUSEAU))
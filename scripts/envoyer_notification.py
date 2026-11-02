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
DOSSIER = os.path.dirname(os.path.abspath(__file__))
JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]

PILOTES = {
    "5": "Johann Zarco", "7": "Toprak Razgatlioglu", "10": "Luca Marini",
    "11": "Diogo Moreira", "12": "Maverick Viñales", "20": "Fabio Quartararo",
    "21": "Franco Morbidelli", "23": "Enea Bastianini", "25": "Raúl Fernández",
    "33": "Brad Binder", "36": "Joan Mir", "37": "Pedro Acosta",
    "42": "Alex Rins", "43": "Jack Miller", "49": "Fabio Di Giannantonio",
    "54": "Fermín Aldeguer", "63": "Francesco Bagnaia", "72": "Marco Bezzecchi",
    "73": "Álex Márquez", "79": "Ai Ogura", "89": "Jorge Martín", "93": "Marc Márquez",
}


def nom_pilote(num):
    return PILOTES.get(str(num), f"#{num}")


def initialiser():
    # La clé vient du secret GitHub, jamais écrite dans le code
    cle = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
    firebase_admin.initialize_app(credentials.Certificate(cle), {"databaseURL": URL_BASE})


def cle_course(gp):
    # Même transformation que le site (ASCII uniquement)
    return re.sub(r"[^\w-]", "", re.sub(r"\s+", "_", gp), flags=re.ASCII)


def heure_paris(texte):
    return datetime.fromisoformat(texte).replace(tzinfo=FUSEAU)


def formater(dt):
    return f"{JOURS[dt.weekday()]} {dt.day:02d}/{dt.month:02d} à {dt.hour}h{dt.minute:02d}"


def charger_calendrier():
    with open(os.path.join(DOSSIER, "calendrier.json"), encoding="utf-8") as f:
        return json.load(f)


def jetons_par_joueur():
    """Renvoie {pseudo: [jetons]} pour chaque joueur ayant au moins un appareil."""
    resultat = {}
    for pseudo, appareils in (db.reference("tokens").get() or {}).items():
        if isinstance(appareils, dict):
            jetons = list(appareils.keys())
        elif isinstance(appareils, str):
            jetons = [appareils]
        else:
            jetons = []
        if jetons:
            resultat[pseudo] = jetons
    return resultat


def veut(pseudo, type_notif):
    prefs = db.reference(f"preferences/{pseudo}").get() or {}
    return prefs.get(type_notif, True)


def envoyer(jetons, titre, corps):
    jetons = list(set(jetons))
    if not jetons:
        return 0
    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=titre, body=corps),
        tokens=jetons,
        webpush=messaging.WebpushConfig(
            fcm_options=messaging.WebpushFCMOptions(link=LIEN_SITE)
        ),
    )
    reponse = messaging.send_each_for_multicast(message)
    print(f"« {titre} » : envoyées {reponse.success_count}, échecs {reponse.failure_count}")
    return reponse.success_count


def envoyer_a_ceux_qui_veulent(type_notif, titre, corps):
    jetons = []
    for pseudo, liste in jetons_par_joueur().items():
        if veut(pseudo, type_notif):
            jetons.extend(liste)
    return envoyer(jetons, titre, corps)


def envoyer_messages_manuels():
    """Messages écrits dans l'admin, et résultats publiés."""
    notifs = db.reference("notifications").get() or {}
    for id_, notif in notifs.items():
        if notif.get("envoyee"):
            continue

        if notif.get("type") == "resultats":
            succes = envoyer_a_ceux_qui_veulent("resultats", notif["titre"], notif["message"])
        else:
            tous = [j for liste in jetons_par_joueur().values() for j in liste]
            succes = envoyer(tous, notif["titre"], notif["message"])

        # Reste en attente tant que personne ne l'a reçue
        if succes > 0:
            db.reference(f"notifications/{id_}/envoyee").set(True)


def rappels_weekend(maintenant, calendrier):
    """La veille du sprint à 9h."""
    for course in calendrier:
        sprint = heure_paris(course["sprint"])
        rappel = (sprint - timedelta(days=1)).replace(hour=9, minute=0)
        if not (rappel <= maintenant < sprint):
            continue

        cle = cle_course(course["gp"])
        drapeau = db.reference(f"rappels/{cle}")
        if drapeau.get():
            continue

        race = heure_paris(course["race"])
        corps = f"Sprint : {formater(sprint)}. Course : {formater(race)}. Pense à valider tes pronos !"
        if envoyer_a_ceux_qui_veulent("rappel_weekend", f"Pronos {course['gp']}", corps) > 0:
            drapeau.set(True)


def rappels_course(maintenant, calendrier):
    """1h avant le sprint et 1h avant la course."""
    for course in calendrier:
        cle = cle_course(course["gp"])
        for session, texte in (("sprint", course["sprint"]), ("race", course["race"])):
            depart = heure_paris(texte)
            if not (depart - timedelta(hours=1) <= maintenant < depart):
                continue

            drapeau = db.reference(f"rappels_course/{cle}/{session}")
            if drapeau.get():
                continue

            libelle = "Sprint" if session == "sprint" else "Grand Prix"
            titre = f"{libelle} dans 1h : {course['gp']}"
            corps = f"Départ à {depart.hour}h{depart.minute:02d}. Dernier moment pour valider tes pronos !"
            if envoyer_a_ceux_qui_veulent("rappel_course", titre, corps) > 0:
                drapeau.set(True)


def formater_podium(res):
    if not res:
        return "non publié"
    return (
        f"🥇 {nom_pilote(res.get('1er'))} "
        f"🥈 {nom_pilote(res.get('2e'))} "
        f"🥉 {nom_pilote(res.get('3e'))}"
    )


def points_de(detail):
    return int((detail or {}).get("total") or 0)


def resume_personnel(pseudo, cle):
    """Podiums du sprint et de la course, avec les points de ce joueur."""
    sprint = db.reference(f"resultats/{cle}/sprint").get() or {}
    course = db.reference(f"resultats/{cle}/race").get() or {}
    pts_sprint = points_de(db.reference(f"scores_details/{pseudo}/{cle}/sprint").get())
    pts_course = points_de(db.reference(f"scores_details/{pseudo}/{cle}/race").get())

    return (
        f"Sprint : {formater_podium(sprint)}\n"
        f"Course : {formater_podium(course)}\n"
        f"Tes points : sprint {pts_sprint:+d}, course {pts_course:+d}, "
        f"total {pts_sprint + pts_course:+d}"
    )


def resumes_lundi(maintenant, calendrier):
    """Le lundi suivant la course, à 9h. Un message personnalisé par joueur."""
    for course in calendrier:
        race = heure_paris(course["race"])
        jours = (7 - race.weekday()) % 7 or 7
        lundi = (race + timedelta(days=jours)).replace(hour=9, minute=0)
        if not (lundi <= maintenant < lundi + timedelta(hours=24)):
            continue

        cle = cle_course(course["gp"])
        drapeau = db.reference(f"resumes/{cle}")
        if drapeau.get():
            continue

        for pseudo, jetons in jetons_par_joueur().items():
            if veut(pseudo, "resume_lundi"):
                envoyer(jetons, f"Résumé {course['gp']}", resume_personnel(pseudo, cle))
        drapeau.set(True)


if __name__ == "__main__":
    initialiser()
    maintenant = datetime.now(FUSEAU)
    calendrier = charger_calendrier()

    envoyer_messages_manuels()
    rappels_weekend(maintenant, calendrier)
    rappels_course(maintenant, calendrier)
    resumes_lundi(maintenant, calendrier)
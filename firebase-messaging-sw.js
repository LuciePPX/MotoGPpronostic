// Service worker : affiche les notifications quand le site est fermé
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyAlWxI_w2R6eyJYBg9h_ynHWAgz3VS51Zk",
    authDomain: "motogp-pronostic.firebaseapp.com",
    projectId: "motogp-pronostic",
    storageBucket: "motogp-pronostic.appspot.com",
    messagingSenderId: "1082916850330",
    appId: "1:1082916850330:web:dbf5d1c7d8e47d86f01b75"
});

firebase.messaging();
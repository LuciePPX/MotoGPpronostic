// Service worker : affiche les notifications quand le site est fermé
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({

  apiKey: "AIzaSyAlWxI_w2R6eyJYBg9h_ynHWAgz3VS51Zk",
  authDomain: "motogppronostic.firebaseapp.com",
  databaseURL: "https://motogppronostic-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "motogppronostic",
  storageBucket: "motogppronostic.firebasestorage.app",
  messagingSenderId: "1093723718276",
  appId: "1:1093723718276:web:51b754c96ceacd589638d1",
  measurementId: "G-D9M06ECP07"

});

firebase.messaging();
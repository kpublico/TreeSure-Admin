// script.js

// ------------------ IMPORTS ------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ------------------ FIREBASE CONFIG ------------------
const firebaseConfig = {
  apiKey: "AIzaSyBca-tYDQIXxSzOAz2jph3Mse6rJ3Ag9is",
  authDomain: "treesure-6496c.firebaseapp.com",
  databaseURL: "https://treesure-6496c-default-rtdb.firebaseio.com",
  projectId: "treesure-6496c",
  storageBucket: "treesure-6496c.firebasestorage.app",
  messagingSenderId: "324875915553",
  appId: "1:324875915553:web:9c8b1136a2d04594bcae60",
  measurementId: "G-G9V6QMHX1E"
};

// ------------------ INITIALIZE FIREBASE ------------------
const app = initializeApp(firebaseConfig);

// Exported services for use in other modules
export const db = getFirestore(app);
export const auth = getAuth(app);

console.log("✅ Firebase initialized successfully.");

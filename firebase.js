import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBojXWE9MheY6PNsBzaCHWOpZwYkCmA_Vc",
  authDomain: "bp-tracking-system.firebaseapp.com",
  projectId: "bp-tracking-system",
  storageBucket: "bp-tracking-system.firebasestorage.app",
  messagingSenderId: "814437509693",
  appId: "1:814437509693:web:2d349a790f7acf45179854"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

export function loginWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function logoutUser() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

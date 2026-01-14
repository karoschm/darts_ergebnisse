import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDdWY2DfgZmUS1Fx7xQUX_AKJbIC6cyiLc",
    authDomain: "darts-ergebnisse.firebaseapp.com",
    projectId: "darts-ergebnisse",
    storageBucket: "darts-ergebnisse.firebasestorage.app",
    messagingSenderId: "106314090954",
    appId: "1:106314090954:web:e9d61addfc109cb3d5e733"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
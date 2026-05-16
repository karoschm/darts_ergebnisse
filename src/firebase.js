import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

import { firebaseConfig as devConfig } from "./firebase.dev";
import { firebaseConfig as prodConfig } from "./firebase.prod";

const firebaseConfig =
    process.env.NODE_ENV === "production"
        ? prodConfig
        : devConfig;

const app = initializeApp(firebaseConfig);
console.log(firebaseConfig.projectId);

export const db = getFirestore(app);

export default app;
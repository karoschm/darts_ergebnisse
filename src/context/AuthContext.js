import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "../firebase";

const AuthContext = createContext({ authReady: false, uid: null });

export function AuthProvider({ children }) {
    const [authReady, setAuthReady] = useState(false);
    const [uid, setUid] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUid(user.uid);
                setAuthReady(true);
            } else {
                signInAnonymously(auth);
            }
        });

        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ authReady, uid }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

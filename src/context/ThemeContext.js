import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProviderCustom({ children }) {
    const [darkMode, setDarkMode] = useState(
        localStorage.getItem("darkMode") === "true"
    );

    useEffect(() => {
        localStorage.setItem("darkMode", darkMode);
    }, [darkMode]);

    const toggleDarkMode = () => {
        setDarkMode(prev => !prev);
    };

    return (
        <ThemeContext.Provider
            value={{
                darkMode,
                toggleDarkMode
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useThemeMode() {
    return useContext(ThemeContext);
}
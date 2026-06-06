import { createContext, useContext, useState, useEffect } from "react";

const EditContext = createContext();

export function EditProvider({ children }) {
    const [canEdit, setCanEdit] = useState(false);

    // Restore nach Reload
    useEffect(() => {
        const stored = sessionStorage.getItem("canEdit") === "true";
        setCanEdit(stored);
    }, []);

    const updateEditMode = (value) => {
        setCanEdit(value);
        sessionStorage.setItem("canEdit", value);
    };

    return (
        <EditContext.Provider value={{ canEdit, setCanEdit: updateEditMode }}>
            {children}
        </EditContext.Provider>
    );
}

export function useEdit() {
    return useContext(EditContext);
}
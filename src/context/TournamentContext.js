import { createContext, useContext, useState } from "react";

const TournamentContext = createContext(null);

export function TournamentProvider({ children }) {
    const [currentTournamentId, setCurrentTournamentId] = useState(null);

    return (
        <TournamentContext.Provider
            value={{ currentTournamentId, setCurrentTournamentId }}
        >
            {children}
        </TournamentContext.Provider>
    );
}

export function useTournament() {
    const context = useContext(TournamentContext);
    if (!context) {
        throw new Error("useTournament must be used inside TournamentProvider");
    }
    return context;
}

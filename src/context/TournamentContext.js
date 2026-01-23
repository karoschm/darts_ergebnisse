import { createContext, useContext } from "react";
import { useParams } from "react-router-dom";

const TournamentContext = createContext();

export function TournamentProvider({ children }) {
  const { tournamentId } = useParams();

  return (
    <TournamentContext.Provider
      value={{
        currentTournamentId: tournamentId || null,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  return useContext(TournamentContext);
}

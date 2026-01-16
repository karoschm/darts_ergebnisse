import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../context/TournamentContext";
import { getAllTeams, subscribeTournamentStatus } from "../../services/firestoreService";

export default function FinalStandings() {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    const [teams, setTeams] = useState({});

    useEffect(() => {
        if (!currentTournamentId) return;

        const unsub = subscribeTournamentStatus(
            currentTournamentId,
            setStatus
        );

        return () => unsub();
    }, [currentTournamentId]);

    useEffect(() => {
        if (status !== "finished" || !currentTournamentId) return;

        async function getTeams() {
            const loadedTeams = await getAllTeams(currentTournamentId);
            setTeams(loadedTeams);
        }
        getTeams();
    }, [status, currentTournamentId]);

    if (status !== "finished") {
        return <div style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "0 20px"
        }}>
            Turnier ist noch nicht beendet
        </div>
    }

    return (
        <div style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "0 20px"
        }}>
            <h1>Abschließende Platzierungen</h1>
            <label>{teams.A1}</label>
            <ol>
                {Object.entries(teams).sort(([i1, t1], [i2, t2]) => t1.finalRank - t2.finalRank).map(([teamID, team]) => (
                    <li key={teamID}>
                        {team?.name || teamID}
                    </li>
                ))}
            </ol>
        </div>
    );

}
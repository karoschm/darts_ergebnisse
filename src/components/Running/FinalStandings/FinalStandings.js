import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { getAllTeams, subscribeTournamentStatus } from "../../../services/firestoreService";
import FinalRankList from "./FinalRankList";
import Podium from "./Podium";

export default function FinalStandings() {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    // const [teams, setTeams] = useState({});
    const [top3Teams, setTop3Teams] = useState([]);
    const [remainingTeams, setRemainingTeams] = useState([]);

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
            // setTeams(loadedTeams);

            const sortedTeams = Object.entries(loadedTeams)
                .sort(([i1, t1], [i2, t2]) => t1.finalRank - t2.finalRank)
                .map(([teamID, team]) => team?.name || teamID);

            setTop3Teams(sortedTeams.slice(0, 3));
            setRemainingTeams(sortedTeams.slice(3));
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
            padding: "60px"
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
            padding: "20px 20px 60px 20px"
        }}>
            <h1>Abschließende Platzierungen</h1>
            <Podium teams={top3Teams} />
            <FinalRankList teams={remainingTeams} />
        </div>
    );

}
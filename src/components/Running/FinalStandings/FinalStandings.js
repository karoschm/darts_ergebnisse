import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { getAllTeams, subscribeTournamentStatus } from "../../../services/firestoreService";
import FinalRankList from "./FinalRankList";
import Podium from "./Podium";
import { useTheme, useMediaQuery } from "@mui/material";

export default function FinalStandings() {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    const [top3Teams, setTop3Teams] = useState([]);
    const [remainingTeams, setRemainingTeams] = useState([]);
    
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
                .filter(([, team]) => !team?.isBye)
                .map(([teamID, team]) => ({ rank: team.finalRank, name: team?.name || teamID }))
                .sort((t1, t2) => t1.rank - t2.rank);

            // Bei geteiltem 3. Platz (kein Spiel um Platz 3) können mehr als 3 Teams
            // einen finalRank <= 3 haben — Aufteilung erfolgt daher über den Rang,
            // nicht über einen festen Array-Index.
            setTop3Teams(sortedTeams.filter(t => t.rank <= 3));
            setRemainingTeams(sortedTeams.filter(t => t.rank > 3));
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
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useEffect } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTournament } from "../../../context/TournamentContext";
import { addTeamGame, generateQuarterfinals, getNumberMatchdays, saveSchedule, subscribeAllMatchdays, subscribeTeams, subscribeTournamentStatus, updateTournamentStatus } from "../../../services/firestoreService";
import StandingsTable from "./StandingsTable";
import MatchdayTabs from "./MatchdayTabs";

export default function Preliminary() {
    const navigate = useNavigate();
    const { currentTournamentId } = useTournament();
    const [teams, setTeams] = useState({});
    const [status, setStatus] = useState("");
    const [preliminaryTabValue, setPreliminaryTabValue] = useState(0);
    const [numberMatchdays, setNumberMatchdays] = useState(0);
    const [allMatchdaysPlayed, setAllMatchdaysPlayed] = useState(false);

    useEffect(() => {
        if (!currentTournamentId) return;

        const unsubscribes = [];

        async function fetchData() {
            const unsubscribeTeams = subscribeTeams(currentTournamentId, (liveTeams) => {
                setTeams(liveTeams);
            });
            unsubscribes.push(unsubscribeTeams);

            const unsubscribeStatus = subscribeTournamentStatus(
                currentTournamentId,
                setStatus
            );
            unsubscribes.push(unsubscribeStatus);

            const unsubscribeAllMatchdays = subscribeAllMatchdays(
                currentTournamentId,
                (matchdays) => {
                    if (matchdays.length === 0) {
                        setAllMatchdaysPlayed(false);
                        return;
                    }
        
                    const allPlayed = matchdays.every(md => {
                        const matches = md.matches || {};
                        return Object.values(matches).every(match => match.played === true);
                    });
        
                    setAllMatchdaysPlayed(allPlayed);
                }
            );
            unsubscribes.push(unsubscribeAllMatchdays);

            setNumberMatchdays(await getNumberMatchdays(currentTournamentId));

            return () => {
                unsubscribes.forEach(unsub => unsub());
            };
        }
        fetchData();
    }, [status, currentTournamentId]);

    const handlePreliminaryTabChange = (event, newTabValue) => {
        event.preventDefault();
        setPreliminaryTabValue(newTabValue);
    }

    const handleStartPreliminary = (e) => {
        e.preventDefault();
        updateTournamentStatus(currentTournamentId, "group");
    }

    const handleFinishPreliminary = (e) => {
        e.preventDefault();
        generateQuarterfinals(currentTournamentId);
        updateTournamentStatus(currentTournamentId, "qf");
    }

    function generateRoundRobinSchedule(teamIDs) {
        if (teamIDs.length % 2 !== 0) {
            throw new Error("Anzahl der Teams muss gerade sein");
        }

        const teams = [...teamIDs];
        const n = teams.length;
        const rounds = n - 1;
        const matchesPerRound = n / 2;

        const schedule = [];

        // Kopie für Rotation
        let rotation = [...teams];

        for (let round = 0; round < rounds; round++) {
            const matches = [];

            for (let i = 0; i < matchesPerRound; i++) {
                const team1 = rotation[i];
                const team2 = rotation[n - 1 - i];

                matches.push({ team1, team2 });
            }

            schedule.push(matches);

            // 🔄 Rotation (erstes Team fixieren)
            rotation = [
                rotation[0],
                rotation[n - 1],
                ...rotation.slice(1, n - 1),
            ];
        }

        return schedule;
    }

    function shuffleSchedule(schedule) {
        return [...schedule].sort(() => Math.random() - 0.5);
    }

    function generateSchedule() {
        const teamIDs = Object.entries(teams).map(([index, team]) => team.id);

        let fullSchedule = generateRoundRobinSchedule(teamIDs);

        // optional mischen
        fullSchedule = shuffleSchedule(fullSchedule);

        // nur gewünschte Anzahl Spieltage nehmen
        return fullSchedule.slice(0, numberMatchdays);
    }

    const handleMakeSchedule = (e) => {
        e.preventDefault();
        const newSchedule = generateSchedule();
        saveSchedule(currentTournamentId, newSchedule);
        newSchedule.map((teams, matchday) => {
            Object.entries(teams).map(([i, { team1, team2 }]) => {
                addTeamGame(currentTournamentId, team1, team2, matchday);
            });
        });
    }

    return (
        <form
            style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "0 20px"
            }}
        >
            <h1>
                Vorrunde
            </h1>
            <StandingsTable teams={teams} />
            <br></br>
            <br></br>
            <button
                onClick={handleMakeSchedule}
                disabled={status !== "setup"}
            >
                Vorrundenspielplan generieren
            </button>
            <button
                onClick={handleStartPreliminary}
                disabled={status !== "setup"}
            >
                Vorrunde beginnen
            </button>
            <br></br>
            <Tabs
                value={preliminaryTabValue}
                onChange={handlePreliminaryTabChange}
                variant="fullWidth"
            >
                {[...Array(numberMatchdays).keys()].map(md => (
                    <Tab label={md + 1} value={md} />
                ))
                }
            </Tabs>
            {[...Array(numberMatchdays).keys()].map(md => (
                <div
                    key={md}
                    role="tabpanel"
                    hidden={preliminaryTabValue !== md}
                >
                    {preliminaryTabValue === md && (
                        <MatchdayTabs md={(md + 1).toString()} />
                    )}
                </div>
            ))}
            <br/>
            <br/>
            <button
                onClick={handleFinishPreliminary}
                disabled={!allMatchdaysPlayed || (status !== "group")}
            >
                Vorrunde abschließen
            </button>
        </form>
    );
}
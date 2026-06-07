import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useEffect, useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import {
    addTeamGame,
    getNumberMatchdays,
    getTournamentData,
    saveSchedule,
    subscribeAllMatchdays,
    subscribeTeams,
    subscribeTournamentStatus,
    updateTournamentStatus,
    generateFirstKORound,
    nextStatus
} from "../../../services/firestoreService";
import StandingsTable from "./StandingsTable";
import MatchdayTabs from "./MatchdayTabs";
import { Button, useTheme, useMediaQuery } from "@mui/material";

export default function Preliminary({ isViewMode }) {
    const { currentTournamentId } = useTournament();
    const [teams, setTeams] = useState([]);
    const [status, setStatus] = useState("");
    const [preliminaryTabValue, setPreliminaryTabValue] = useState(0);
    const [numberMatchdays, setNumberMatchdays] = useState(0);
    const [allMatchdaysPlayed, setAllMatchdaysPlayed] = useState(false);
    const [scheduleAvailable, setScheduleAvailable] = useState(false);
    const [koRounds, setKoRounds] = useState(0);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    useEffect(() => {
        if (!currentTournamentId) return;

        const unsubscribes = [];

        async function fetchData() {
            const unsubscribeTeams = subscribeTeams(currentTournamentId, setTeams);
            unsubscribes.push(unsubscribeTeams);

            const unsubscribeStatus = subscribeTournamentStatus(currentTournamentId, setStatus);
            unsubscribes.push(unsubscribeStatus);

            const unsubscribeAllMatchdays = subscribeAllMatchdays(
                currentTournamentId,
                (matchdays) => {
                    if (matchdays.length === 0) {
                        setAllMatchdaysPlayed(false);
                        setScheduleAvailable(false);
                        return;
                    }
                    setScheduleAvailable(true);
                    const allPlayed = matchdays.every(md =>
                        Object.values(md.matches || {}).every(match => match.played === true)
                    );
                    setAllMatchdaysPlayed(allPlayed);
                }
            );
            unsubscribes.push(unsubscribeAllMatchdays);

            setNumberMatchdays(await getNumberMatchdays(currentTournamentId));

            const data = await getTournamentData(currentTournamentId);
            setKoRounds(data?.koRounds ?? 0);
        }

        fetchData();
        return () => unsubscribes.forEach(unsub => unsub());
    }, [currentTournamentId]);

    const handlePreliminaryTabChange = (event, newTabValue) => {
        event.preventDefault();
        setPreliminaryTabValue(newTabValue);
    };

    const handleStartPreliminary = (e) => {
        e.preventDefault();
        updateTournamentStatus(currentTournamentId, "group");
    };

    const handleFinishPreliminary = async (e) => {
        e.preventDefault();
        if (koRounds === 0) {
            await updateTournamentStatus(currentTournamentId, "finished");
        } else {
            await generateFirstKORound(currentTournamentId, koRounds);
            await updateTournamentStatus(currentTournamentId, nextStatus("group", koRounds));
        }
    };

    function generateRoundRobinSchedule(teamIDs) {
        if (teamIDs.length % 2 !== 0) {
            throw new Error("Anzahl der Teams muss gerade sein");
        }

        const n = teamIDs.length;
        const rounds = n - 1;
        const matchesPerRound = n / 2;
        const schedule = [];
        let rotation = [...teamIDs];

        for (let round = 0; round < rounds; round++) {
            const matches = [];
            for (let i = 0; i < matchesPerRound; i++) {
                matches.push({ team1: rotation[i], team2: rotation[n - 1 - i] });
            }
            schedule.push(matches);
            rotation = [rotation[0], rotation[n - 1], ...rotation.slice(1, n - 1)];
        }

        return schedule;
    }

    function shuffleSchedule(schedule) {
        return [...schedule].sort(() => Math.random() - 0.5);
    }

    function generateSchedule() {
        // Alle Teams inkl. BYE für die Spielplanerstellung verwenden
        const teamIDs = teams.map(team => team.id);
        let fullSchedule = generateRoundRobinSchedule(teamIDs);
        fullSchedule = shuffleSchedule(fullSchedule);
        return fullSchedule.slice(0, numberMatchdays);
    }

    const handleMakeSchedule = (e) => {
        e.preventDefault();
        const newSchedule = generateSchedule();
        saveSchedule(currentTournamentId, newSchedule);
        newSchedule.forEach((matchList, matchday) => {
            Object.values(matchList).forEach(({ team1, team2 }) => {
                addTeamGame(currentTournamentId, team1, team2, matchday);
            });
        });
    };

    const finishLabel = koRounds === 0 ? "Turnier abschließen" : "Vorrunde abschließen";

    return (
        <form
            style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "20px 20px 60px 20px"
            }}
        >
            <StandingsTable teams={teams} />
            <br />
            <div style={{ display: "flex", gap: "15px", justifyContent: "center", marginTop: "10px" }}>
                {!isViewMode && (
                    <div>
                        <Button
                            onClick={handleMakeSchedule}
                            disabled={status !== "setup"}
                        >
                            Vorrundenspielplan generieren
                        </Button>
                        <Button
                            onClick={handleStartPreliminary}
                            disabled={status !== "setup" || !scheduleAvailable}
                        >
                            Vorrunde beginnen
                        </Button>
                    </div>
                )}
            </div>
            <br />
            <Tabs
                value={preliminaryTabValue}
                onChange={handlePreliminaryTabChange}
                variant={isMobile ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                sx={{ width: "100%" }}
            >
                {[...Array(numberMatchdays).keys()].map(md => (
                    <Tab key={`tab_${md + 1}`} label={md + 1} value={md} />
                ))}
            </Tabs>

            {[...Array(numberMatchdays).keys()].map(md => (
                <div
                    key={md}
                    role="tabpanel"
                    hidden={preliminaryTabValue !== md}
                    style={{
                        flex: 1, minWidth: 0, display: "flex",
                        flexDirection: "column", alignItems: "center", textAlign: "center"
                    }}
                >
                    {preliminaryTabValue === md && (
                        <MatchdayTabs md={(md + 1).toString()} isViewMode={isViewMode} />
                    )}
                </div>
            ))}
            <br />
            {!isViewMode && (
                <Button
                    onClick={handleFinishPreliminary}
                    disabled={!allMatchdaysPlayed || status !== "group"}
                >
                    {finishLabel}
                </Button>
            )}
        </form>
    );
}
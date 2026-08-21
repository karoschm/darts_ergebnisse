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
import { Button, Typography, useTheme, useMediaQuery } from "@mui/material";

export default function Preliminary({ isViewMode }) {
    const { currentTournamentId } = useTournament();
    const [teams, setTeams] = useState([]);
    const [status, setStatus] = useState("");
    const [preliminaryTabValue, setPreliminaryTabValue] = useState(0);
    const [numberMatchdays, setNumberMatchdays] = useState(0);
    const [allMatchdaysPlayed, setAllMatchdaysPlayed] = useState(false);
    const [scheduleAvailable, setScheduleAvailable] = useState(false);
    const [koRounds, setKoRounds] = useState(0);
    const [preliminaryScoreMode, setPreliminaryScoreMode] = useState("points");
    const [winLegs, setWinLegs] = useState(3);
    const [groupCount, setGroupCount] = useState(1);
    const [qualifiersPerGroup, setQualifiersPerGroup] = useState(0);

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
            setPreliminaryScoreMode(data?.preliminaryScoreMode ?? "points");
            setWinLegs(data?.winLegs ?? 3);
            setGroupCount(data?.groupCount ?? 1);
            setQualifiersPerGroup(data?.qualifiersPerGroup ?? Math.pow(2, data?.koRounds ?? 0));
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
            await generateFirstKORound(currentTournamentId, koRounds, preliminaryScoreMode, groupCount, qualifiersPerGroup);
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
        if (groupCount <= 1) {
            // Alle Teams inkl. BYE für die Spielplanerstellung verwenden (unverändertes Verhalten)
            const teamIDs = teams.map(team => team.id);
            let fullSchedule = generateRoundRobinSchedule(teamIDs);
            fullSchedule = shuffleSchedule(fullSchedule);
            return fullSchedule.slice(0, numberMatchdays).map(round =>
                round.map(match => ({ ...match, group: 0 }))
            );
        }

        // Mehrere Gruppen: pro Gruppe ein eigener, unabhängig gemischter Rundenplan
        // (gleich große Gruppen vorausgesetzt, daher gleiche Rundenzahl je Gruppe),
        // matchdayweise über die Gruppen hinweg zusammengeführt.
        const schedulesByGroup = [];
        for (let g = 0; g < groupCount; g++) {
            const groupTeamIDs = teams.filter(t => !t.isBye && (t.group ?? 0) === g).map(t => t.id);
            let groupSchedule = generateRoundRobinSchedule(groupTeamIDs);
            groupSchedule = shuffleSchedule(groupSchedule);
            schedulesByGroup.push(groupSchedule);
        }

        const roundsCount = schedulesByGroup[0]?.length ?? 0;
        const merged = [];
        for (let r = 0; r < roundsCount; r++) {
            const roundMatches = [];
            schedulesByGroup.forEach((schedule, g) => {
                (schedule[r] || []).forEach(match => roundMatches.push({ ...match, group: g }));
            });
            merged.push(roundMatches);
        }
        return merged.slice(0, numberMatchdays);
    }

    const handleMakeSchedule = (e) => {
        e.preventDefault();
        const newSchedule = generateSchedule();
        saveSchedule(currentTournamentId, newSchedule, preliminaryScoreMode, winLegs);
        newSchedule.forEach((matchList, matchday) => {
            Object.values(matchList).forEach(({ team1, team2 }) => {
                addTeamGame(currentTournamentId, team1, team2, matchday, preliminaryScoreMode, winLegs);
            });
        });
    };

    const finishLabel = koRounds === 0 ? "Turnier abschließen" : "Vorrunde abschließen";
    const scoreModeLabel = preliminaryScoreMode === "legs"
        ? `Wertung: Gewinnlegs (First to ${winLegs})`
        : "Wertung: Punkte";

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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {scoreModeLabel}
            </Typography>
            <StandingsTable teams={teams} scoreMode={preliminaryScoreMode} groupCount={groupCount} />
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
                        <MatchdayTabs
                            md={(md + 1).toString()}
                            isViewMode={isViewMode}
                            scoreMode={preliminaryScoreMode}
                            winLegs={winLegs}
                            groupCount={groupCount}
                        />
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
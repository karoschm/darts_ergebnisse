import { TableCell, TableHead, TableRow } from "@mui/material";
import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { generateFinal, getAllTeams, saveKOScore, subscribeKnockoutRound, subscribeTournamentStatus, updateAllKOsPlayed, updateTournamentStatus } from "../../../services/firestoreService";

export default function SemifinalTab() {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    const [semifinals, setSemifinals] = useState({ matches: {} })
    const [allSFsPlayed, setAllSFsPlayed] = useState(false);
    const [teamNames, setTeamNames] = useState({});
    const [winLegs, setWinLegs] = useState(4);

    const sfMatches = semifinals?.matches?.SF1;

    const sfReady = Boolean(sfMatches?.team1 && sfMatches?.team2);

    useEffect(() => {
        if (!currentTournamentId) return;

        let unsubscribeKnockout;
        let unsubscribeStatus;

        async function init() {
            // Teamnamen einmal laden
            const loadedTeams = await getAllTeams(currentTournamentId);
            const names = loadedTeams.reduce((acc, doc) => {
                acc[doc.id] = doc.name || "";
                return acc;
            }, {});
            setTeamNames(names);

            unsubscribeKnockout = subscribeKnockoutRound(
                currentTournamentId,
                "semifinals",
                (data) => {
                    setSemifinals(data);

                    // Abgeleitet: prüfen, ob alle Matches played === true
                    const matches = data.matches || {};
                    const allPlayed = Object.values(matches).every(match => match.played === true);
                    setAllSFsPlayed(allPlayed);
                }
            );

            unsubscribeStatus = subscribeTournamentStatus(
                currentTournamentId,
                setStatus
            );
        }

        init();

        return () => {
            if (unsubscribeKnockout) unsubscribeKnockout();
            if (unsubscribeStatus) unsubscribeStatus();
        };
    }, [status, currentTournamentId]);

    function handleLegScoreChange(matchKey, team, newScore, opponent) {
        setSemifinals(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                [`score_${team}`]: newScore
            }
        }));
        saveKOScore(currentTournamentId, "semifinals", matchKey, team, newScore, opponent, winLegs);
    }

    function handleWinLegsChange(newWinLegs) {
        setWinLegs(newWinLegs);
        updateAllKOsPlayed(currentTournamentId, "semifinals", newWinLegs);
    }

    function getSemiFinalWinners() {
        const winnersLosers = { "winners": [], "losers": [] };

        Object.values(semifinals.matches).forEach(match => {
            if (!match.played) return; // Sicherheit

            const team1 = match.team1;
            const team2 = match.team2;

            if (match[`legs_${team1}`] > match[`legs_${team2}`]) {
                winnersLosers["winners"].push(team1);
                winnersLosers["losers"].push(team2);
            } else {
                winnersLosers["winners"].push(team2);
                winnersLosers["losers"].push(team1);
            }
        });

        return winnersLosers; // Array mit IDs der siegreichen Teams
    }

    const handleFinishSemifinal = () => {
        const { winners, losers } = getSemiFinalWinners();
        generateFinal(currentTournamentId, winners, losers);
        updateTournamentStatus(currentTournamentId, "final");
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
            <label>First to</label>
            <input
                type={"number"}
                value={winLegs}
                disabled={status !== "sf"}
                onChange={e => handleWinLegsChange(Number(e.target.value))}
            />
            <br />
            {status !== "group" && (
                <div>
                    <table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Match</TableCell>
                                <TableCell>Legs</TableCell>
                                <TableCell>Team 1</TableCell>
                                <TableCell></TableCell>
                                <TableCell>Team 2</TableCell>
                                <TableCell>Legs</TableCell>
                            </TableRow>
                        </TableHead>
                        {sfReady ? (
                            <tbody>
                                {Object.entries(semifinals.matches)
                                    .sort(([mId1, m1], [mId2, m2]) => mId1.localeCompare(mId2))
                                    .map(([matchId, match]) => (
                                        <TableRow key={matchId}>
                                            <TableCell>{matchId}</TableCell>
                                            <TableCell>
                                                <input
                                                    type={"number"}
                                                    value={match[`legs_${match.team1}`]}
                                                    disabled={status !== "sf"}
                                                    onChange={e => 
                                                        handleLegScoreChange(
                                                            matchId,
                                                            match.team1,
                                                            Number(e.target.value),
                                                            match.team2
                                                            )
                                                        }
                                                    min={0}
                                                    max={winLegs}
                                                />
                                            </TableCell>
                                            <TableCell>{teamNames[match.team1]}</TableCell>
                                            <TableCell>vs</TableCell>
                                            <TableCell>{teamNames[match.team2]}</TableCell>
                                            <TableCell>
                                                <input
                                                    type={"number"}
                                                    value={match[`legs_${match.team2}`]}
                                                    disabled={status !== "sf"}
                                                    onChange={e => 
                                                        handleLegScoreChange(
                                                            matchId,
                                                            match.team2,
                                                            Number(e.target.value),
                                                            match.team1
                                                            )
                                                        }
                                                    min={0}
                                                    max={winLegs}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </tbody>
                        ) : (
                            <tbody>
                                <TableRow>
                                    <TableCell>SF1</TableCell>
                                    <td />
                                    <TableCell>Sieger QF1</TableCell>
                                    <TableCell>vs</TableCell>
                                    <TableCell>Sieger QF4</TableCell>
                                    <td />
                                </TableRow>
                                <TableRow>
                                    <TableCell>SF2</TableCell>
                                    <td />
                                    <TableCell>Sieger QF2</TableCell>
                                    <TableCell>vs</TableCell>
                                    <TableCell>Sieger QF3</TableCell>
                                    <td />
                                </TableRow>
                            </tbody>
                        )}
                    </table>
                    <br />
                    <button
                        onClick={handleFinishSemifinal}
                        disabled={!allSFsPlayed || (status !== "sf")}
                    >
                        Halbfinale abschließen
                    </button>
                </div>
            )}
        </div>
    )
}
import { Button, Table, TableBody, TableCell, TableHead, TableRow, TextField } from "@mui/material";
import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { generateSemifinals, getAllTeams, saveKOScore, subscribeKnockoutRound, subscribeTournamentStatus, updateAllKOsPlayed, updateTournamentStatus } from "../../../services/firestoreService";

export default function QuarterfinalTab() {
    const { currentTournamentId } = useTournament();
    const [teamNames, setTeamNames] = useState({});
    const [status, setStatus] = useState("");
    const [quarterfinals, setQuarterfinals] = useState({ matches: {} });
    const [allQFsPlayed, setAllQFsPlayed] = useState(false);
    const [winLegs, setWinLegs] = useState(3);

    const qfMatches = quarterfinals?.matches?.QF1;

    const qfReady = Boolean(qfMatches?.team1 && qfMatches?.team2);

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
                "quarterfinals",
                (data) => {
                    setQuarterfinals(data);

                    const matches = data.matches || {};
                    const allPlayed = Object.values(matches).every(match => match.played === true);
                    setAllQFsPlayed(allPlayed);
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
        setQuarterfinals(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                [`score_${team}`]: newScore
            }
        }));
        saveKOScore(currentTournamentId, "quarterfinals", matchKey, team, newScore, opponent, winLegs);
    }

    function handleWinLegsChange(newWinLegs) {
        setWinLegs(newWinLegs);
        updateAllKOsPlayed(currentTournamentId, "quarterfinals", newWinLegs);
    }

    function getQuarterFinalResults() {
        const winnersLosers = { winners: [], losers: [] };

        Object.entries(quarterfinals.matches)
            .sort(([mId1, m1], [mId2, m2]) => mId1.localeCompare(mId2))
            .forEach(([id, match]) => {
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

    const handleFinishQuarterfinal = () => {
        const winnersLosers = getQuarterFinalResults()
        generateSemifinals(currentTournamentId, winnersLosers["winners"], winnersLosers["losers"]);
        updateTournamentStatus(currentTournamentId, "sf");
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
            <label>Gewinnlegs: First to</label>
            <TextField
                style={{ width: "60px", paddingTop: "10px" }}
                type={"number"}
                value={winLegs}
                disabled={status !== "qf"}
                onChange={e => handleWinLegsChange(Number(e.target.value))}
                inputProps={{ min: 0 }}
            />
            <br />
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell align="center" width="15%">Match</TableCell>
                        <TableCell align="right" width="10%">Legs</TableCell>
                        <TableCell align="right" width="25%">Team 1</TableCell>
                        <TableCell align="center" width="10%"></TableCell>
                        <TableCell align="left" width="25%">Team 2</TableCell>
                        <TableCell align="left" width="10%">Legs</TableCell>
                    </TableRow>
                </TableHead>
                {qfReady ? (
                    <TableBody>
                        {Object.entries(quarterfinals.matches)
                            .sort(([mId1, m1], [mId2, m2]) => mId1.localeCompare(mId2))
                            .map(([matchId, match]) => (
                                <TableRow key={matchId}>
                                    <TableCell align="center">{matchId}</TableCell>
                                    <TableCell align="right">
                                        <TextField
                                            type={"number"}
                                            value={match[`legs_${match.team1}`]}
                                            disabled={status !== "qf"}
                                            onChange={e => handleLegScoreChange(
                                                matchId, match.team1, Number(e.target.value), match.team2
                                            )}
                                            inputProps={{ min: 0, max: winLegs }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">{teamNames[match.team1]}</TableCell>
                                    <TableCell align="center">vs</TableCell>
                                    <TableCell align="left">{teamNames[match.team2]}</TableCell>
                                    <TableCell align="left">
                                        <TextField
                                            type={"number"}
                                            value={match[`legs_${match.team2}`]}
                                            disabled={status !== "qf"}
                                            onChange={e => handleLegScoreChange(
                                                matchId, match.team2, Number(e.target.value), match.team1
                                            )}
                                            inputProps={{ min: 0, max: winLegs }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                ) : (
                    <TableBody>
                        <TableRow>
                            <TableCell>QF1</TableCell>
                            <TableCell />
                            <TableCell>VR Platz 1</TableCell>
                            <TableCell>vs</TableCell>
                            <TableCell>VR Platz 8</TableCell>
                            <TableCell />
                        </TableRow>
                        <TableRow>
                            <TableCell>QF2</TableCell>
                            <TableCell />
                            <TableCell>VR Platz 2</TableCell>
                            <TableCell>vs</TableCell>
                            <TableCell>VR Platz 7</TableCell>
                            <TableCell />
                        </TableRow>
                        <TableRow>
                            <TableCell>QF3</TableCell>
                            <TableCell />
                            <TableCell>VR Platz 3</TableCell>
                            <TableCell>vs</TableCell>
                            <TableCell>VR Platz 6</TableCell>
                            <TableCell />
                        </TableRow>
                        <TableRow>
                            <TableCell>QF4</TableCell>
                            <TableCell />
                            <TableCell>VR Platz 4</TableCell>
                            <TableCell>vs</TableCell>
                            <TableCell>VR Platz 5</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableBody>
                )}
            </Table>
            <br />
            <Button
                onClick={handleFinishQuarterfinal}
                disabled={!allQFsPlayed || (status !== "qf")}
            >
                Viertelfinale abschließen
            </Button>
        </div>
    )
}
import { Button, Table, TableBody, TableCell, TableHead, TableRow, TextField } from "@mui/material";
import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { getAllTeams, saveKOScore, subscribeKnockoutRound, subscribeTournamentStatus, updateAllKOsPlayed, updateRankingFinals, updateTournamentStatus } from "../../../services/firestoreService";

export default function FinalTab() {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    const [finals, setFinals] = useState({ matches: {} })
    const [allFinalsPlayed, setAllFinalsPlayed] = useState(false);
    const [teamNames, setTeamNames] = useState({});
    const [winLegs, setWinLegs] = useState(5);

    const finalMatch = finals?.matches?.final;
    const place3Match = finals?.matches?.place3;

    const finalReady = Boolean(finalMatch?.team1 && finalMatch?.team2);
    const place3Ready = Boolean(place3Match?.team1 && place3Match?.team2);

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
                "final",
                (data) => {
                    setFinals(data);

                    // Abgeleitet: prüfen, ob alle Matches played === true
                    const matches = data.matches || {};
                    const allPlayed = Object.values(matches).every(match => match.played === true);
                    setAllFinalsPlayed(allPlayed);
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
        setFinals(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                [`score_${team}`]: newScore
            }
        }));
        saveKOScore(currentTournamentId, "final", matchKey, team, newScore, opponent, winLegs);
    }

    function handleWinLegsChange(newWinLegs) {
        setWinLegs(newWinLegs);
        updateAllKOsPlayed(currentTournamentId, "final", newWinLegs);
    }

    const handleFinishFinal = (e) => {
        e.preventDefault();
        updateRankingFinals(currentTournamentId);
        updateTournamentStatus(currentTournamentId, "finished");
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
                disabled={status !== "final"}
                onChange={e => handleWinLegsChange(Number(e.target.value))}
                inputProps={{ min: 0 }}
            />
            <br />
            <h2>Finale</h2>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell align="right" width="15%">Legs</TableCell>
                        <TableCell align="right" width="30%">Team 1</TableCell>
                        <TableCell align="center" width="10%"></TableCell>
                        <TableCell align="left" width="30%">Team 2</TableCell>
                        <TableCell align="left" width="15%">Legs</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {finalReady ? (
                        <TableRow>
                            <TableCell align="right">
                                <TextField
                                    type={"number"}
                                    value={finals.matches.final[`legs_${finals.matches.final.team1}`]}
                                    disabled={status !== "final"}
                                    onChange={e =>
                                        handleLegScoreChange(
                                            "final",
                                            finals.matches.final.team1,
                                            Number(e.target.value),
                                            finals.matches.final.team2
                                        )
                                    }
                                    inputProps={{ min: 0, max: winLegs }}
                                />
                            </TableCell>
                            <TableCell align="right">{teamNames[finals.matches.final.team1]}</TableCell>
                            <TableCell align="center">vs</TableCell>
                            <TableCell align="left">{teamNames[finals.matches.final.team2]}</TableCell>
                            <TableCell align="left">
                                <TextField
                                    type={"number"}
                                    value={finals.matches.final[`legs_${finals.matches.final.team2}`]}
                                    disabled={status !== "final"}
                                    onChange={e =>
                                        handleLegScoreChange(
                                            "final",
                                            finals.matches.final.team2,
                                            Number(e.target.value),
                                            finals.matches.final.team1
                                        )
                                    }
                                    inputProps={{ min: 0, max: winLegs }}
                                />
                            </TableCell>
                        </TableRow>
                    ) : (
                        <TableRow>
                            <td />
                            <TableCell>Sieger SF1</TableCell>
                            <TableCell>vs</TableCell>
                            <TableCell>Sieger SF 2</TableCell>
                            <td />
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <br />
            <br />
            <h2>Spiel um Platz 3</h2>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell align="right" width="15%">Legs</TableCell>
                        <TableCell align="right" width="30%">Team 1</TableCell>
                        <TableCell align="center" width="10%"></TableCell>
                        <TableCell align="left" width="30%">Team 2</TableCell>
                        <TableCell align="left" width="15%">Legs</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {place3Ready ? (
                        <TableRow>
                            <TableCell align="right">
                                <TextField
                                    type={"number"}
                                    value={finals.matches.place3[`legs_${finals.matches.place3.team1}`]}
                                    disabled={status !== "final"}
                                    onChange={e =>
                                        handleLegScoreChange(
                                            "place3",
                                            finals.matches.place3.team1,
                                            Number(e.target.value),
                                            finals.matches.place3.team2
                                        )
                                    }
                                    inputProps={{ min: 0, max: winLegs }}
                                />
                            </TableCell>
                            <TableCell align="right">{teamNames[finals.matches.place3.team1]}</TableCell>
                            <TableCell align="center">vs</TableCell>
                            <TableCell align="left">{teamNames[finals.matches.place3.team2]}</TableCell>
                            <TableCell align="left">
                                <TextField
                                    type={"number"}
                                    value={finals.matches.place3[`legs_${finals.matches.place3.team2}`]}
                                    disabled={status !== "final"}
                                    onChange={e =>
                                        handleLegScoreChange(
                                            "place3",
                                            finals.matches.place3.team2,
                                            Number(e.target.value),
                                            finals.matches.place3.team1
                                        )
                                    }
                                    inputProps={{ min: 0, max: winLegs }}
                                />
                            </TableCell>
                        </TableRow>
                    ) : (
                        <TableRow>
                            <td />
                            <TableCell>Verlierer SF1</TableCell>
                            <TableCell>vs</TableCell>
                            <TableCell>Verlierer SF 2</TableCell>
                            <td />
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <br />
            <Button
                onClick={handleFinishFinal}
                disabled={!finalReady || !place3Ready || !allFinalsPlayed || status !== "final"}
            >
                Turnier abschließen
            </Button>
        </div>
    )
}
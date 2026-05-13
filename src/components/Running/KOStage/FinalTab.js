import { Button, Table, TableBody, TableCell, TableHead, TableRow, TextField, useTheme, useMediaQuery } from "@mui/material";
import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { getAllTeams, saveKOScore, subscribeKnockoutRound, subscribeTournamentStatus, updateAllKOsPlayed, updateRankingFinals, updateTournamentStatus } from "../../../services/firestoreService";

export default function FinalTab(isViewMode) {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    const [finals, setFinals] = useState({ matches: {} })
    const [allFinalsPlayed, setAllFinalsPlayed] = useState(false);
    const [teamNames, setTeamNames] = useState({});
    const [winLegs, setWinLegs] = useState(5);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
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

    return isMobile ? (
        <div style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "20px 20px 60px 20px"
        }}
        >
            <label>Gewinnlegs: First to</label>
            <TextField
                style={{ width: "60px", paddingTop: "10px" }}
                type={"number"}
                value={winLegs}
                disabled={status !== "final" || isViewMode}
                onChange={e => handleWinLegsChange(Number(e.target.value))}
                inputProps={{ min: 0 }}
            />
            <br />
            <h2>Finale</h2>
            {finalReady ? (
                <div
                    key="finale"
                    style={{
                        border: "1px solid #ccc",
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 12,
                    }}
                >
                    <div style={{
                        flex: 1,
                        display: "flex",
                        justifyContent: "space-between",
                        textAlign: "center"
                    }}>
                        <div>{teamNames[finals.matches.final.team1]}</div>

                        <TextField
                            style={{ width: "50%" }}
                            type="number"
                            value={finals.matches.final[`legs_${finals.matches.final.team1}`]}
                            disabled={status !== "final" || isViewMode}
                            onChange={e =>
                                handleLegScoreChange(
                                    "final",
                                    finals.matches.final.team1,
                                    Number(e.target.value),
                                    finals.matches.final.team2
                                )
                            }
                            inputProps={{ min: 0, max: winLegs }}
                            fullWidth
                        />
                    </div>

                    <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                    <div style={{
                        flex: 1,
                        display: "flex",
                        justifyContent: "space-between",
                        textAlign: "center"
                    }}>
                        <div>{teamNames[finals.matches.final.team2]}</div>

                        <TextField
                            style={{ width: "50%" }}
                            type="number"
                            value={finals.matches.final[`legs_${finals.matches.final.team2}`]}
                            disabled={status !== "final" || isViewMode}
                            onChange={e =>
                                handleLegScoreChange(
                                    "final",
                                    finals.matches.final.team2,
                                    Number(e.target.value),
                                    finals.matches.final.team1
                                )
                            }
                            inputProps={{ min: 0, max: winLegs }}
                            fullWidth
                        />
                    </div>
                </div>
            ) : (
                <div
                    key="finale_not_ready"
                    style={{
                        border: "1px solid #ccc",
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 12,
                    }}
                >
                    <div>Sieger SF1</div>
                    <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                    <div>Sieger SF2</div>
                </div>
            )}
            <br />
            <br />
            <h2>Spiel um Platz 3</h2>
            {place3Ready ? (
                <div
                    key="place3"
                    style={{
                        border: "1px solid #ccc",
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 12,
                    }}
                >
                    <div style={{
                        flex: 1,
                        display: "flex",
                        justifyContent: "space-between",
                        textAlign: "center"
                    }}>
                        <div>{teamNames[finals.matches.place3.team1]}</div>

                        <TextField
                            style={{ width: "50%" }}
                            type="number"
                            value={finals.matches.place3[`legs_${finals.matches.place3.team1}`]}
                            disabled={status !== "final" || isViewMode}
                            onChange={e =>
                                handleLegScoreChange(
                                    "place3",
                                    finals.matches.place3.team1,
                                    Number(e.target.value),
                                    finals.matches.place3.team2
                                )
                            }
                            inputProps={{ min: 0, max: winLegs }}
                            fullWidth
                        />
                    </div>

                    <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                    <div style={{
                        flex: 1,
                        display: "flex",
                        justifyContent: "space-between",
                        textAlign: "center"
                    }}>
                        <div>{teamNames[finals.matches.place3.team2]}</div>

                        <TextField
                            style={{ width: "50%" }}
                            type="number"
                            value={finals.matches.place3[`legs_${finals.matches.place3.team2}`]}
                            disabled={status !== "final" || isViewMode}
                            onChange={e =>
                                handleLegScoreChange(
                                    "place3",
                                    finals.matches.place3.team2,
                                    Number(e.target.value),
                                    finals.matches.place3.team1
                                )
                            }
                            inputProps={{ min: 0, max: winLegs }}
                            fullWidth
                        />
                    </div>
                </div>
            ) : (
                <div
                    key="place3_not_ready"
                    style={{
                        border: "1px solid #ccc",
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 12,
                    }}
                >
                    <div>Verlierer SF1</div>
                    <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                    <div>Verlierer SF2</div>
                </div>
            )}
            <br />
            {!isViewMode && (
                <Button
                    onClick={handleFinishFinal}
                    disabled={!finalReady || !place3Ready || !allFinalsPlayed || status !== "final"}
                >
                    Turnier abschließen
                </Button>
            )}
        </div>
    ) : (
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
                disabled={status !== "final" || isViewMode}
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
                                    disabled={status !== "final" || isViewMode}
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
                                    disabled={status !== "final" || isViewMode}
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
                            <TableCell>Sieger SF2</TableCell>
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
                                    disabled={status !== "final" || isViewMode}
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
                                    disabled={status !== "final" || isViewMode}
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
            {!isViewMode && (
                <Button
                    onClick={handleFinishFinal}
                    disabled={!finalReady || !place3Ready || !allFinalsPlayed || status !== "final"}
                >
                    Turnier abschließen
                </Button>
            )}
        </div>
    )
}
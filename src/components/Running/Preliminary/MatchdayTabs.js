import { Button, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, useTheme, useMediaQuery } from "@mui/material";
import { useState, useEffect } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { getAllTeams, saveScore, setMatchPlayed, subscribeMatchday, subscribeTournamentStatus } from "../../../services/firestoreService";


export default function MatchdayTabs({ md }) {
    const { currentTournamentId } = useTournament();
    const [matches, setMatches] = useState({});
    const [teamNames, setTeamNames] = useState({});
    const [status, setStatus] = useState("");

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    useEffect(() => {
        if (!currentTournamentId) return;

        let unsubscribeMatchday;
        let unsubscribeStatus;

        async function init() {
            // Teamnamen einmal laden
            const loadedTeams = await getAllTeams(currentTournamentId);
            const names = loadedTeams.reduce((acc, doc) => {
                acc[doc.id] = doc.name || "";
                return acc;
            }, {});
            setTeamNames(names);

            // Matchday live abonnieren
            unsubscribeMatchday = subscribeMatchday(
                currentTournamentId,
                md,
                (liveMatches) => {
                    setMatches(liveMatches);
                }
            );

            unsubscribeStatus = subscribeTournamentStatus(
                currentTournamentId,
                setStatus
            );
        }

        init();

        return () => {
            if (unsubscribeMatchday) unsubscribeMatchday();
            if (unsubscribeStatus) unsubscribeStatus();
        };
    }, [currentTournamentId, md]);

    function handleScoreChange(matchKey, team, newScore, opponent) {
        setMatches(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                [`score_${team}`]: newScore
            }
        }));
        saveScore(currentTournamentId, md, matchKey, team, newScore, opponent);
    }

    function enterResult(matchKey) {
        setMatches(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                played: true
            }
        }));
        setMatchPlayed(currentTournamentId, md, matchKey);
    }

    return isMobile ? (
        <div>
            {Object.keys(matches).map((mNumber) => {
                const match = matches[mNumber];
                const team1 = match.team1;
                const team2 = match.team2;

                return (
                    <div
                        key={mNumber}
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
                            <div>{teamNames[team1]}</div>

                            <TextField
                                style={{ width: "50%" }}
                                type="number"
                                value={match[`score_${team1}`]}
                                disabled={status !== "group"}
                                onChange={e =>
                                    handleScoreChange(mNumber, team1, Number(e.target.value), team2)
                                }
                                fullWidth
                                inputProps={{ min: 0, max: 501 }}
                            />
                        </div>

                        <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                        <div style={{
                            flex: 1,
                            display: "flex",
                            justifyContent: "space-between",
                            textAlign: "center"
                        }}>
                            <div>{teamNames[team2]}</div>

                            <TextField
                                style={{ width: "50%" }}
                                type="number"
                                value={match[`score_${team2}`]}
                                disabled={status !== "group"}
                                onChange={e =>
                                    handleScoreChange(mNumber, team2, Number(e.target.value), team1)
                                }
                                fullWidth
                                inputProps={{ min: 0, max: 501 }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    ) : (
        <Table style={{
            borderCollapse: "collapse",
            alignContent: "center"
        }}>
            <TableBody>
                {Object.keys(matches).sort((a, b) => a.localeCompare(b)).map((mNumber) => {
                    const match = matches[mNumber];
                    const team1 = match.team1;
                    const team2 = match.team2;
                    const scoreTeam1 = match[`score_${team1}`];
                    const scoreTeam2 = match[`score_${team2}`];
                    const gamePlayed = match.played

                    return gamePlayed ? (
                        <TableRow key={mNumber}>
                            <TableCell align="right" width="10%">
                                <TextField
                                    type="number"
                                    style={{ width: "60px", textAlign: "center" }}
                                    disabled={status !== "group"}
                                    value={scoreTeam1}
                                    onChange={e =>
                                        handleScoreChange(mNumber, team1, Number(e.target.value), team2)
                                    }
                                    onBlur={e =>
                                        saveScore(currentTournamentId, md, mNumber, team1, Number(e.target.value), team2)
                                    }
                                    inputProps={{ min: 0, max: 501 }}
                                />
                            </TableCell>

                            <TableCell align="right" width="25%">
                                {teamNames[team1]}
                            </TableCell>

                            <TableCell align="center" width="10%">
                                vs
                            </TableCell>

                            <TableCell align="left" width="25%">
                                {teamNames[team2]}
                            </TableCell>

                            <TableCell align="left" width="10%">
                                <TextField
                                    type="number"
                                    style={{ width: "60px", textAlign: "center" }}
                                    disabled={status !== "group"}
                                    value={scoreTeam2}
                                    onChange={e =>
                                        handleScoreChange(mNumber, team2, Number(e.target.value), team1)
                                    }
                                    onBlur={e =>
                                        saveScore(currentTournamentId, md, mNumber, team2, Number(e.target.value), team1)
                                    }
                                    inputProps={{ min: 0, max: 501 }}
                                />
                            </TableCell>

                            <TableCell width="20%" />

                        </TableRow>
                    ) : (
                        <TableRow key={mNumber}>

                            <TableCell width="10%" />

                            <TableCell align="right" width="25%">
                                {teamNames[team1]}
                            </TableCell>

                            <TableCell align="center" width="10%">
                                vs
                            </TableCell>

                            <TableCell align="left" width="25%">
                                {teamNames[team2]}
                            </TableCell>

                            <TableCell width="10%" />

                            <TableCell width="20%">
                                <Button
                                    onClick={() => enterResult(mNumber)}
                                    disabled={status !== "group"}
                                >
                                    Ergebnis eintragen
                                </Button>
                            </TableCell>

                        </TableRow>
                    )
                })
                }
            </TableBody>
        </Table>
    );
}
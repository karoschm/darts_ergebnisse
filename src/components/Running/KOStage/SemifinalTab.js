import { Button, Table, TableBody, TableCell, TableHead, TableRow, TextField, useTheme, useMediaQuery } from "@mui/material";
import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { generateFinal, getAllTeams, saveKOScore, subscribeKnockoutRound, subscribeTournamentStatus, updateAllKOsPlayed, updateTournamentStatus } from "../../../services/firestoreService";

export default function SemifinalTab({ isViewMode }) {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    const [semifinals, setSemifinals] = useState({ matches: {} })
    const [allSFsPlayed, setAllSFsPlayed] = useState(false);
    const [teamNames, setTeamNames] = useState({});
    const [winLegs, setWinLegs] = useState(4);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
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
                disabled={status !== "sf" || isViewMode}
                onChange={e => handleWinLegsChange(Number(e.target.value))}
                inputProps={{ min: 0 }}
            />
            <br />
            {sfReady ? (
                <div>
                    {Object.entries(semifinals.matches)
                        .sort(([mId1, m1], [mId2, m2]) => mId1.localeCompare(mId2))
                        .map(([matchId, match]) => {
                            const team1 = match.team1;
                            const team2 = match.team2;

                            return (
                                <div
                                    key={matchId}
                                    style={{
                                        border: "1px solid #ccc",
                                        borderRadius: 10,
                                        padding: 12,
                                        marginBottom: 12,
                                    }}
                                >
                                    <div style={{ textAlign: "left", margin: "6px 20%" }}>{matchId}</div>
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
                                            value={match[`legs_${match.team1}`]}
                                            disabled={status !== "sf" || isViewMode}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    matchId,
                                                    match.team1,
                                                    Number(e.target.value),
                                                    match.team2
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
                                        <div>{teamNames[team2]}</div>

                                        <TextField
                                            style={{ width: "50%" }}
                                            type="number"
                                            value={match[`legs_${match.team2}`]}
                                            disabled={status !== "sf" || isViewMode}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    matchId,
                                                    match.team2,
                                                    Number(e.target.value),
                                                    match.team1
                                                )
                                            }
                                            inputProps={{ min: 0, max: winLegs }}
                                            fullWidth
                                        />
                                    </div>
                                </div>
                            );
                        })}
                </div>
            ) : (
                <div>
                    <div
                        key="sf1_not_ready"
                        style={{
                            border: "1px solid #ccc",
                            borderRadius: 10,
                            padding: 12,
                            marginBottom: 12,
                        }}
                    >
                        <div>Sieger QF1</div>
                        <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                        <div>Sieger QF4</div>
                    </div>
                    <div
                        key="sf2_not_ready"
                        style={{
                            border: "1px solid #ccc",
                            borderRadius: 10,
                            padding: 12,
                            marginBottom: 12,
                        }}
                    >
                        <div>Sieger QF2</div>
                        <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                        <div>Sieger QF3</div>
                    </div>
                </div>
            )}

            <Button
                onClick={handleFinishSemifinal}
                disabled={!allSFsPlayed || (status !== "sf")}
            >
                Halbfinale abschließen
            </Button>
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
                disabled={status !== "sf" || isViewMode}
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
                {sfReady ? (
                    <TableBody>
                        {Object.entries(semifinals.matches)
                            .sort(([mId1, m1], [mId2, m2]) => mId1.localeCompare(mId2))
                            .map(([matchId, match]) => (
                                <TableRow key={matchId}>
                                    <TableCell align="center">{matchId}</TableCell>
                                    <TableCell align="right">
                                        <TextField
                                            type={"number"}
                                            value={match[`legs_${match.team1}`]}
                                            disabled={status !== "sf" || isViewMode}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    matchId,
                                                    match.team1,
                                                    Number(e.target.value),
                                                    match.team2
                                                )
                                            }
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
                                            disabled={status !== "sf" || isViewMode}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    matchId,
                                                    match.team2,
                                                    Number(e.target.value),
                                                    match.team1
                                                )
                                            }
                                            inputProps={{ min: 0, max: winLegs }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
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
            </Table>
            <br />
            {!isViewMode && (
                <Button
                    onClick={handleFinishSemifinal}
                    disabled={!allSFsPlayed || (status !== "sf")}
                >
                    Halbfinale abschließen
                </Button>
            )}
        </div>
    )
}
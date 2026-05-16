import { Button, Table, TableBody, TableCell, TableHead, TableRow, TextField, useTheme, useMediaQuery, Card, Typography, Tooltip } from "@mui/material";
import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { generateSemifinals, getAllTeams, saveKOScore, subscribeKnockoutRound, subscribeTournamentStatus, updateAllKOsPlayed, updateTournamentStatus } from "../../../services/firestoreService";


export default function QuarterfinalTab({ isViewMode }) {
    const { currentTournamentId } = useTournament();
    const [teamNames, setTeamNames] = useState({});
    const [status, setStatus] = useState("");
    const [quarterfinals, setQuarterfinals] = useState({ matches: {} });
    const [allQFsPlayed, setAllQFsPlayed] = useState(false);
    const [winLegs, setWinLegs] = useState(3);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
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
                disabled={status !== "qf" || isViewMode}
                onChange={e => handleWinLegsChange(Number(e.target.value))}
                inputProps={{ min: 0 }}
            />
            <br />
            {qfReady ? (
                <div>
                    {Object.entries(quarterfinals.matches)
                        .sort(([mId1, m1], [mId2, m2]) => mId1.localeCompare(mId2))
                        .map(([matchId, match]) => {
                            const team1 = match.team1;
                            const team2 = match.team2;

                            return (
                                <Card
                                    key={matchId}
                                    sx={{
                                        width: "90vw",
                                        mx: "auto",
                                        mb: 2
                                    }}
                                >
                                    <div style={{ textAlign: "center", margin: "2px" }}>{matchId}</div>
                                    <div style={{
                                        flex: 1,
                                        display: "flex",
                                        justifyContent: "space-between"
                                    }}>
                                        <Typography
                                            sx={{
                                                minWidth: 0,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                fontSize:
                                                    teamNames[team1].length > 20
                                                        ? "0.75rem"
                                                        : "1rem"
                                            }}
                                            style={{ flex: 3 }}
                                        >
                                            {teamNames[team1]}
                                        </Typography>

                                        <TextField
                                            style={{ flex: 1, minWidth: "60px" }}
                                            type="number"
                                            value={match[`legs_${match.team1}`]}
                                            disabled={isViewMode}
                                            onChange={e => handleLegScoreChange(
                                                matchId, match.team1, Number(e.target.value), match.team2
                                            )}
                                            fullWidth
                                            inputProps={{ min: 0, max: winLegs }}
                                        />
                                    </div>

                                    <div style={{ textAlign: "right", margin: "4px" }}>vs</div>
                                    <div style={{
                                        flex: 1,
                                        display: "flex",
                                        justifyContent: "space-between",
                                    }}>
                                        <Typography
                                            sx={{
                                                minWidth: 0,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                fontSize:
                                                    teamNames[team2].length > 20
                                                        ? "0.75rem"
                                                        : "1rem"
                                            }}
                                            style={{ flex: 3 }}
                                        >
                                            {teamNames[team2]}
                                        </Typography>

                                        <TextField
                                            style={{ flex: 1, minWidth: "60px" }}
                                            type="number"
                                            value={match[`legs_${match.team2}`]}
                                            disabled={isViewMode}
                                            onChange={e => handleLegScoreChange(
                                                matchId, match.team2, Number(e.target.value), match.team1
                                            )}
                                            fullWidth
                                            inputProps={{ min: 0, max: winLegs }}
                                        />
                                    </div>
                                </Card>
                            );
                        })}
                </div>
            ) : (
                <div>
                    <Card
                        key="qf1_not_ready"
                        sx={{
                            width: "90vw",
                            mx: "auto",
                            mb: 2
                        }}
                    >
                        <div>VR Platz 1</div>
                        <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                        <div>VR Platz 8</div>
                    </Card>
                    <Card
                        key="qf2_not_ready"
                        sx={{
                            width: "90vw",
                            mx: "auto",
                            mb: 2
                        }}
                    >
                        <div>VR Platz 2</div>
                        <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                        <div>VR Platz 7</div>
                    </Card>
                    <Card
                        key="qf3_not_ready"
                        sx={{
                            width: "90vw",
                            mx: "auto",
                            mb: 2
                        }}
                    >
                        <div>VR Platz 3</div>
                        <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                        <div>VR Platz 6</div>
                    </Card>
                    <Card
                        key="qf4_not_ready"
                        sx={{
                            width: "90vw",
                            mx: "auto",
                            mb: 2
                        }}
                    >
                        <div>VR Platz 4</div>
                        <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                        <div>VR Platz 5</div>
                    </Card>
                </div>
            )}

            {!isViewMode && (
                <Button
                    onClick={handleFinishQuarterfinal}
                    disabled={!allQFsPlayed || (status !== "qf")}
                >
                    Viertelfinale abschließen
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
                disabled={status !== "qf" || isViewMode}
                onChange={e => handleWinLegsChange(Number(e.target.value))}
                inputProps={{ min: 0 }}
            />
            <br />
            <Table
                sx={{
                    width: "80vw",
                    mx: "auto",
                    mb: 2,
                    maxWidth: 800
                }}
                style={{
                    borderCollapse: "collapse",
                    alignContent: "center"
                }}
            >
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
                                            disabled={status !== "qf" || isViewMode}
                                            onChange={e => handleLegScoreChange(
                                                matchId, match.team1, Number(e.target.value), match.team2
                                            )}
                                            inputProps={{ min: 0, max: winLegs }}
                                        />
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            fontSize:
                                                teamNames[match.team1].length > 25
                                                    ? "0.75rem"
                                                    : "1rem"
                                        }}
                                        align="right"
                                        width="25%"
                                    >
                                        <Tooltip title={teamNames[match.team1]} enterDelay={1000}>
                                            {teamNames[match.team1]}
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell align="center">vs</TableCell>
                                    <TableCell
                                        sx={{
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            fontSize:
                                                teamNames[match.team2].length > 25
                                                    ? "0.75rem"
                                                    : "1rem"
                                        }}
                                        align="left"
                                        width="25%"
                                    >
                                        <Tooltip title={teamNames[match.team2]}  enterDelay={1000}>
                                            {teamNames[match.team2]}
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell align="left">
                                        <TextField
                                            type={"number"}
                                            value={match[`legs_${match.team2}`]}
                                            disabled={status !== "qf" || isViewMode}
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
                            <TableCell align="center">QF1</TableCell>
                            <TableCell />
                            <TableCell align="right">VR Platz 1</TableCell>
                            <TableCell align="center">vs</TableCell>
                            <TableCell>VR Platz 8</TableCell>
                            <TableCell />
                        </TableRow>
                        <TableRow>
                            <TableCell align="center">QF2</TableCell>
                            <TableCell />
                            <TableCell align="right">VR Platz 2</TableCell>
                            <TableCell align="center">vs</TableCell>
                            <TableCell>VR Platz 7</TableCell>
                            <TableCell />
                        </TableRow>
                        <TableRow>
                            <TableCell align="center">QF3</TableCell>
                            <TableCell />
                            <TableCell align="right">VR Platz 3</TableCell>
                            <TableCell align="center">vs</TableCell>
                            <TableCell>VR Platz 6</TableCell>
                            <TableCell />
                        </TableRow>
                        <TableRow>
                            <TableCell align="center">QF4</TableCell>
                            <TableCell />
                            <TableCell align="right">VR Platz 4</TableCell>
                            <TableCell align="center">vs</TableCell>
                            <TableCell>VR Platz 5</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableBody>
                )}
            </Table>
            <br />
            {!isViewMode && (
                <Button
                    onClick={handleFinishQuarterfinal}
                    disabled={!allQFsPlayed || (status !== "qf")}
                >
                    Viertelfinale abschließen
                </Button>
            )}
        </div>
    )
}
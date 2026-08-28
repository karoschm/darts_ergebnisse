import { Button, Table, TableBody, TableCell, TableHead, TableRow, TextField, useTheme, useMediaQuery, Card, Typography, Tooltip } from "@mui/material";
import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { getAllTeams, saveKOScore, subscribeKnockoutRound, subscribeTournamentStatus, updateAllKOsPlayed, updateRankingFinals, updateTournamentStatus } from "../../../services/firestoreService";

export default function FinalTab({ isViewMode }) {
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

    // rawValue ist während der Eingabe bewusst der rohe String (auch ""), damit das
    // Feld beim Löschen des alten Werts leer angezeigt wird statt sofort auf "0" zu
    // springen. Ein leeres Feld wird noch nicht gespeichert, sondern erst sobald wieder
    // eine Zahl eingegeben wurde.
    function handleLegScoreChange(matchKey, team, rawValue, opponent) {
        setFinals(prev => ({
            ...prev,
            matches: {
                ...prev.matches,
                [matchKey]: {
                    ...prev.matches[matchKey],
                    [`legs_${team}`]: rawValue
                }
            }
        }));
        if (rawValue === "") return;
        saveKOScore(currentTournamentId, "final", matchKey, team, Number(rawValue), opponent, winLegs);
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
            <Tooltip title={(status != "final") ? "Das Turnier befindet sich in einer anderen Stufe" : isViewMode ? "Keine Bearbeitung möglich" : ""}>
                <span>
                    <TextField
                        style={{ width: "60px", paddingTop: "10px" }}
                        type={"number"}
                        value={winLegs}
                        disabled={status !== "final" || isViewMode}
                        onChange={e => handleWinLegsChange(Number(e.target.value))}
                        inputProps={{ min: 0 }}
                    />
                </span>
            </Tooltip>
            <br />
            <h2>Finale</h2>
            {finalReady ? (
                <Card
                    key={"finale"}
                    sx={{
                        width: "90vw",
                        mx: "auto",
                        mb: 2
                    }}
                >
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
                                    teamNames[finals.matches.final.team1].length > 20
                                        ? "0.75rem"
                                        : "1rem"
                            }}
                            style={{ flex: 3 }}
                        >
                            {teamNames[finals.matches.final.team1]}
                        </Typography>

                        <TextField
                            style={{ flex: 1, minWidth: "60px" }}
                            type="number"
                            value={finals.matches.final[`legs_${finals.matches.final.team1}`]}
                            disabled={status !== "final" || isViewMode}
                            onChange={e =>
                                handleLegScoreChange(
                                    "final",
                                    finals.matches.final.team1,
                                    e.target.value,
                                    finals.matches.final.team2
                                )
                            }
                            inputProps={{ min: 0, max: winLegs }}
                            fullWidth
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
                                    teamNames[finals.matches.final.team2].length > 20
                                        ? "0.75rem"
                                        : "1rem"
                            }}
                            style={{ flex: 3 }}
                        >
                            {teamNames[finals.matches.final.team2]}
                        </Typography>

                        <TextField
                            style={{ flex: 1, minWidth: "60px" }}
                            type="number"
                            value={finals.matches.final[`legs_${finals.matches.final.team2}`]}
                            disabled={status !== "final" || isViewMode}
                            onChange={e =>
                                handleLegScoreChange(
                                    "final",
                                    finals.matches.final.team2,
                                    e.target.value,
                                    finals.matches.final.team1
                                )
                            }
                            inputProps={{ min: 0, max: winLegs }}
                            fullWidth
                        />
                    </div>
                </Card>
            ) : (
                <Card
                    key="finale_not_ready"
                    sx={{
                        width: "90vw",
                        mx: "auto",
                        mb: 2
                    }}
                >
                    <div>Sieger SF1</div>
                    <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                    <div>Sieger SF2</div>
                </Card>
            )}
            <br />
            <br />
            <h2>Spiel um Platz 3</h2>
            {place3Ready ? (
                <Card
                    key={"place3"}
                    sx={{
                        width: "90vw",
                        mx: "auto",
                        mb: 2
                    }}
                >
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
                                    teamNames[finals.matches.place3.team1].length > 20
                                        ? "0.75rem"
                                        : "1rem"
                            }}
                            style={{ flex: 3 }}
                        >
                            {teamNames[finals.matches.place3.team1]}
                        </Typography>

                        <TextField
                            style={{ flex: 1, minWidth: "60px" }}
                            type="number"
                            value={finals.matches.place3[`legs_${finals.matches.place3.team1}`]}
                            disabled={status !== "final" || isViewMode}
                            onChange={e =>
                                handleLegScoreChange(
                                    "place3",
                                    finals.matches.place3.team1,
                                    e.target.value,
                                    finals.matches.place3.team2
                                )
                            }
                            inputProps={{ min: 0, max: winLegs }}
                            fullWidth
                        />
                    </div>

                    <div style={{ textAlign: "right", margin: "4px" }}>vs</div>
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
                                    teamNames[finals.matches.place3.team2].length > 20
                                        ? "0.75rem"
                                        : "1rem"
                            }}
                            style={{ flex: 3 }}
                        >
                            {teamNames[finals.matches.place3.team2]}
                        </Typography>

                        <TextField
                            style={{ flex: 1, minWidth: "60px" }}
                            type="number"
                            value={finals.matches.place3[`legs_${finals.matches.place3.team2}`]}
                            disabled={status !== "final" || isViewMode}
                            onChange={e =>
                                handleLegScoreChange(
                                    "place3",
                                    finals.matches.place3.team2,
                                    e.target.value,
                                    finals.matches.place3.team1
                                )
                            }
                            inputProps={{ min: 0, max: winLegs }}
                            fullWidth
                        />
                    </div>
                </Card>
            ) : (
                <Card
                    key="place3_not_ready"
                    sx={{
                        width: "90vw",
                        mx: "auto",
                        mb: 2
                    }}
                >
                    <div>Verlierer SF1</div>
                    <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                    <div>Verlierer SF2</div>
                </Card>
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
            <Tooltip
                title={
                    isViewMode ?
                        "Keine Bearbeitung möglich (Beobachtungsmodus)" :
                        (status != "final") ?
                            "Das Turnier befindet sich in einer anderen Stufe" :
                            ""
                }
            >
                <span>
                    <TextField
                        style={{ width: "60px", paddingTop: "10px" }}
                        type={"number"}
                        value={winLegs}
                        disabled={status !== "final" || isViewMode}
                        onChange={e => handleWinLegsChange(Number(e.target.value))}
                        inputProps={{ min: 0 }}
                    />
                </span>
            </Tooltip>
            <br />
            <h2>Finale</h2>
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
                                <Tooltip
                                    title={
                                        isViewMode ?
                                            "Keine Bearbeitung möglich (Beobachtungsmodus)" :
                                            (status != "final") ?
                                                "Das Turnier befindet sich in einer anderen Stufe" :
                                                ""
                                    }
                                >
                                    <span>
                                        <TextField
                                            type={"number"}
                                            value={finals.matches.final[`legs_${finals.matches.final.team1}`]}
                                            disabled={status !== "final" || isViewMode}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    "final",
                                                    finals.matches.final.team1,
                                                    e.target.value,
                                                    finals.matches.final.team2
                                                )
                                            }
                                            inputProps={{ min: 0, max: winLegs }}
                                        />
                                    </span>
                                </Tooltip>
                            </TableCell>
                            <TableCell
                                sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontSize:
                                        teamNames[finals.matches.final.team1].length > 25
                                            ? "0.75rem"
                                            : "1rem"
                                }}
                                align="right"
                                width="25%"
                            >
                                <Tooltip title={teamNames[finals.matches.final.team1]} enterDelay={1000}>
                                    {teamNames[finals.matches.final.team1]}
                                </Tooltip>
                            </TableCell>
                            <TableCell align="center">vs</TableCell>
                            <TableCell
                                sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontSize:
                                        teamNames[finals.matches.final.team2].length > 25
                                            ? "0.75rem"
                                            : "1rem"
                                }}
                                align="left"
                                width="25%"
                            >
                                <Tooltip title={teamNames[finals.matches.final.team2]} enterDelay={1000}>
                                    {teamNames[finals.matches.final.team2]}
                                </Tooltip>
                            </TableCell>
                            <TableCell align="left">
                                <Tooltip
                                    title={
                                        isViewMode ?
                                            "Keine Bearbeitung möglich (Beobachtungsmodus)" :
                                            (status != "final") ?
                                                "Das Turnier befindet sich in einer anderen Stufe" :
                                                ""
                                    }
                                >
                                    <span>
                                        <TextField
                                            type={"number"}
                                            value={finals.matches.final[`legs_${finals.matches.final.team2}`]}
                                            disabled={status !== "final" || isViewMode}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    "final",
                                                    finals.matches.final.team2,
                                                    e.target.value,
                                                    finals.matches.final.team1
                                                )
                                            }
                                            inputProps={{ min: 0, max: winLegs }}
                                        />
                                    </span>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    ) : (
                        <TableRow>
                            <TableCell />
                            <TableCell align="right">Sieger SF1</TableCell>
                            <TableCell align="center">vs</TableCell>
                            <TableCell>Sieger SF2</TableCell>
                            <TableCell />
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <br />
            <br />
            <h2>Spiel um Platz 3</h2>
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
                                <Tooltip
                                    title={
                                        isViewMode ?
                                            "Keine Bearbeitung möglich (Beobachtungsmodus)" :
                                            (status != "final") ?
                                                "Das Turnier befindet sich in einer anderen Stufe" :
                                                ""
                                    }
                                >
                                    <span>
                                        <TextField
                                            type={"number"}
                                            value={finals.matches.place3[`legs_${finals.matches.place3.team1}`]}
                                            disabled={status !== "final" || isViewMode}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    "place3",
                                                    finals.matches.place3.team1,
                                                    e.target.value,
                                                    finals.matches.place3.team2
                                                )
                                            }
                                            inputProps={{ min: 0, max: winLegs }}
                                        />
                                    </span>
                                </Tooltip>
                            </TableCell>
                            <TableCell
                                sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontSize:
                                        teamNames[finals.matches.place3.team1].length > 25
                                            ? "0.75rem"
                                            : "1rem"
                                }}
                                align="right"
                                width="25%"
                            >
                                <Tooltip title={teamNames[finals.matches.place3.team1]} enterDelay={1000}>
                                    {teamNames[finals.matches.place3.team1]}
                                </Tooltip>
                            </TableCell>
                            <TableCell align="center">vs</TableCell>
                            <TableCell
                                sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontSize:
                                        teamNames[finals.matches.place3.team2].length > 25
                                            ? "0.75rem"
                                            : "1rem"
                                }}
                                align="left"
                                width="25%"
                            >
                                <Tooltip title={teamNames[finals.matches.place3.team2]} enterDelay={1000}>
                                    {teamNames[finals.matches.place3.team2]}
                                </Tooltip>
                            </TableCell>
                            <TableCell align="left">
                                <Tooltip
                                    title={
                                        isViewMode ?
                                            "Keine Bearbeitung möglich (Beobachtungsmodus)" :
                                            (status != "final") ?
                                                "Das Turnier befindet sich in einer anderen Stufe" :
                                                ""
                                    }
                                >
                                    <span>
                                        <TextField
                                            type={"number"}
                                            value={finals.matches.place3[`legs_${finals.matches.place3.team2}`]}
                                            disabled={status !== "final" || isViewMode}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    "place3",
                                                    finals.matches.place3.team2,
                                                    e.target.value,
                                                    finals.matches.place3.team1
                                                )
                                            }
                                            inputProps={{ min: 0, max: winLegs }}
                                        />
                                    </span>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    ) : (
                        <TableRow>
                            <TableCell />
                            <TableCell align="right">Verlierer SF1</TableCell>
                            <TableCell align="center">vs</TableCell>
                            <TableCell>Verlierer SF 2</TableCell>
                            <TableCell />
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
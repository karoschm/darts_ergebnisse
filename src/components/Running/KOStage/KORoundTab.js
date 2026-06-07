import {
    Button, Table, TableBody, TableCell, TableHead, TableRow,
    TextField, Typography, useTheme, useMediaQuery, Card, Tooltip
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import {
    getAllTeams,
    saveKOScore,
    subscribeKnockoutRound,
    subscribeTournamentStatus,
    updateAllKOsPlayed,
    updateTournamentStatus,
    generateNextKORound,
    updateRankingFinals,
    getTournamentData,
    nextStatus,
    koStageKey,
    koRoundLabel
} from "../../../services/firestoreService";

/**
 * Generische KO-Runden-Komponente.
 * Ersetzt QuarterfinalTab, SemifinalTab und FinalTab.
 *
 * Props:
 *   roundIndex    — 1-basierter Index (1 = erste KO-Runde)
 *   koRounds      — Gesamtzahl KO-Runden
 *   hasThirdPlace — ob Platz-3-Spiel existiert (nur letzte Runde)
 *   stageKey      — z.B. "round_1"
 *   isViewMode    — Bearbeitungsfunktionen gesperrt
 */
export default function KORoundTab({ roundIndex, koRounds, hasThirdPlace, stageKey, isViewMode }) {
    const { currentTournamentId } = useTournament();
    const [teamNames, setTeamNames] = useState({});
    const [status, setStatus] = useState("");
    const [roundData, setRoundData] = useState({ matches: {} });
    const [allMatchesPlayed, setAllMatchesPlayed] = useState(false);
    const [winLegs, setWinLegs] = useState(3);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const isFinal = roundIndex === koRounds;
    const statusKey = `ko_${roundIndex}`;
    const matchCount = Math.pow(2, koRounds - roundIndex); // z.B. koRounds=3, round=1 → 4 Matches
    const label = koRoundLabel(koRounds, roundIndex);

    // Hauptmatches ohne Platz-3
    const mainMatches = Object.entries(roundData.matches || {})
        .filter(([key]) => key !== "place3")
        .sort(([a], [b]) => a.localeCompare(b));
    const place3Match = roundData.matches?.place3;

    const roundReady = mainMatches.length > 0 && mainMatches[0][1]?.team1;

    useEffect(() => {
        if (!currentTournamentId) return;

        let unsubscribeKnockout;
        let unsubscribeStatus;

        async function init() {
            const loadedTeams = await getAllTeams(currentTournamentId);
            const names = loadedTeams.reduce((acc, doc) => {
                acc[doc.id] = doc.name || "";
                return acc;
            }, {});
            setTeamNames(names);

            unsubscribeKnockout = subscribeKnockoutRound(
                currentTournamentId,
                stageKey,
                (data) => {
                    setRoundData(data);
                    const matches = Object.entries(data.matches || {})
                        .filter(([key]) => key !== "place3");
                    const place3 = data.matches?.place3;
                    const mainPlayed = matches.length > 0 && matches.every(([, m]) => m.played);
                    const p3Played = !isFinal || !hasThirdPlace || !place3 || place3.played;
                    setAllMatchesPlayed(mainPlayed && p3Played);
                }
            );

            unsubscribeStatus = subscribeTournamentStatus(currentTournamentId, setStatus);
        }

        init();
        return () => {
            if (unsubscribeKnockout) unsubscribeKnockout();
            if (unsubscribeStatus) unsubscribeStatus();
        };
    }, [currentTournamentId, stageKey]);

    function handleLegScoreChange(matchKey, team, newScore, opponent) {
        saveKOScore(currentTournamentId, stageKey, matchKey, team, newScore, opponent, winLegs);
    }

    function handleWinLegsChange(newWinLegs) {
        setWinLegs(newWinLegs);
        updateAllKOsPlayed(currentTournamentId, stageKey, newWinLegs);
    }

    const handleFinishRound = async () => {
        await updateAllKOsPlayed(currentTournamentId, stageKey, winLegs);

        if (isFinal) {
            const data = await getTournamentData(currentTournamentId);
            await updateRankingFinals(currentTournamentId, data.hasThirdPlace);
            await updateTournamentStatus(currentTournamentId, "finished");
            return;
        }

        const winners = [];
        const losers = [];
        mainMatches.forEach(([, m]) => {
            if (m[`legs_${m.team1}`] > m[`legs_${m.team2}`]) {
                winners.push(m.team1); losers.push(m.team2);
            } else {
                winners.push(m.team2); losers.push(m.team1);
            }
        });

        const data = await getTournamentData(currentTournamentId);
        await generateNextKORound(
            currentTournamentId, roundIndex, winners, losers, data.koRounds, data.hasThirdPlace
        );
        await updateTournamentStatus(currentTournamentId, nextStatus(statusKey, data.koRounds));
    };

    const editTooltip = isViewMode
        ? "Keine Bearbeitung möglich (Beobachtungsmodus)"
        : status !== statusKey
            ? "Das Turnier befindet sich in einer anderen Stufe"
            : "";

    const finishLabel = isFinal ? "Turnier abschließen" : `${label} abschließen`;

    // Platzhalter-Zeilen wenn Runde noch nicht generiert wurde
    function renderPlaceholders() {
        const qualifiedCount = Math.pow(2, koRounds); // Gesamtanzahl qualifizierter Teams
        const rows = [];
        for (let i = 0; i < matchCount; i++) {
            const rank1 = i + 1;
            const rank2 = qualifiedCount - i; // Gegner: letzter gegen ersten etc.
            rows.push({ rank1, rank2, key: `placeholder_${i}` });
        }
        return rows;
    }

    if (isMobile) {
        return (
            <div style={{
                flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
                alignItems: "center", textAlign: "center", padding: "20px 20px 60px 20px"
            }}>
                <label>Gewinnlegs: First to</label>
                <TextField
                    style={{ width: "60px", paddingTop: "10px" }}
                    type="number"
                    value={winLegs}
                    disabled={status !== statusKey || isViewMode}
                    onChange={e => handleWinLegsChange(Number(e.target.value))}
                    inputProps={{ min: 0 }}
                />
                <br />

                {roundReady ? (
                    <div>
                        {mainMatches
                            .sort(([i1, t1], [i2, t2]) => Number(i1.replace("M", "")) - Number(i2.replace("M", "")))
                            .map(([matchId, match]) => (
                                <MobileMatchCard
                                    key={matchId}
                                    matchId={matchId}
                                    match={match}
                                    teamNames={teamNames}
                                    winLegs={winLegs}
                                    disabled={status !== statusKey || isViewMode}
                                    onScoreChange={handleLegScoreChange}
                                />
                            ))}
                        {isFinal && hasThirdPlace && place3Match && (
                            <>
                                <Typography variant="subtitle1" sx={{ mt: 2 }}>Spiel um Platz 3</Typography>
                                <MobileMatchCard
                                    matchId="place3"
                                    match={place3Match}
                                    teamNames={teamNames}
                                    winLegs={winLegs}
                                    disabled={status !== statusKey || isViewMode}
                                    onScoreChange={handleLegScoreChange}
                                />
                            </>
                        )}
                    </div>
                ) : (
                    <div>
                        {renderPlaceholders().map(({ rank1, rank2, key }) => (
                            <Card key={key} sx={{ width: "90vw", mx: "auto", mb: 2 }}>
                                <div>VR Platz {rank1}</div>
                                <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                                <div>VR Platz {rank2}</div>
                            </Card>
                        ))}
                    </div>
                )}

                {!isViewMode && (
                    <Button onClick={handleFinishRound} disabled={!allMatchesPlayed || status !== statusKey}>
                        {finishLabel}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div style={{
            flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
            alignItems: "center", textAlign: "center", padding: "20px 20px 60px 20px"
        }}>
            <label>Gewinnlegs: First to</label>
            <Tooltip title={editTooltip}>
                <span>
                    <TextField
                        style={{ width: "60px", paddingTop: "10px" }}
                        type="number"
                        value={winLegs}
                        disabled={status !== statusKey || isViewMode}
                        onChange={e => handleWinLegsChange(Number(e.target.value))}
                        inputProps={{ min: 0 }}
                    />
                </span>
            </Tooltip>
            <br />

            <Table sx={{ width: "80vw", mx: "auto", mb: 2, maxWidth: 800 }}
                style={{ borderCollapse: "collapse", alignContent: "center" }}>
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

                {roundReady ? (
                    <TableBody>
                        {mainMatches
                            .sort(([i1, t1], [i2, t2]) => Number(i1.replace("M", "")) - Number(i2.replace("M", "")))
                            .map(([matchId, match]) => (
                                <DesktopMatchRow
                                    key={matchId}
                                    matchId={matchId}
                                    match={match}
                                    teamNames={teamNames}
                                    winLegs={winLegs}
                                    editTooltip={editTooltip}
                                    disabled={status !== statusKey || isViewMode}
                                    onScoreChange={handleLegScoreChange}
                                />
                            ))}
                        {isFinal && hasThirdPlace && place3Match && (
                            <>
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Typography variant="subtitle2" align="center">Spiel um Platz 3</Typography>
                                    </TableCell>
                                </TableRow>
                                <DesktopMatchRow
                                    matchId="place3"
                                    match={place3Match}
                                    teamNames={teamNames}
                                    winLegs={winLegs}
                                    editTooltip={editTooltip}
                                    disabled={status !== statusKey || isViewMode}
                                    onScoreChange={handleLegScoreChange}
                                />
                            </>
                        )}
                    </TableBody>
                ) : (
                    <TableBody>
                        {renderPlaceholders().map(({ rank1, rank2, key }) => (
                            <TableRow key={key}>
                                <TableCell align="center">M{rank1}</TableCell>
                                <TableCell />
                                <TableCell align="right">VR Platz {rank1}</TableCell>
                                <TableCell align="center">vs</TableCell>
                                <TableCell>VR Platz {rank2}</TableCell>
                                <TableCell />
                            </TableRow>
                        ))}
                    </TableBody>
                )}
            </Table>
            <br />
            {!isViewMode && (
                <Button onClick={handleFinishRound} disabled={!allMatchesPlayed || status !== statusKey}>
                    {finishLabel}
                </Button>
            )}
        </div>
    );
}

// ─── Hilfkomponenten ──────────────────────────────────────────────────────────

function MobileMatchCard({ matchId, match, teamNames, winLegs, disabled, onScoreChange }) {
    const team1 = match.team1;
    const team2 = match.team2;

    return (
        <Card sx={{ width: "90vw", mx: "auto", mb: 2 }}>
            <div style={{ textAlign: "center", margin: "2px" }}>{matchId}</div>
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{
                    flex: 3, minWidth: 0, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontSize: teamNames[team1]?.length > 20 ? "0.75rem" : "1rem"
                }}>
                    {teamNames[team1]}
                </Typography>
                <TextField
                    style={{ flex: 1, minWidth: "60px" }}
                    type="number"
                    value={match[`legs_${team1}`]}
                    disabled={disabled}
                    onChange={e => onScoreChange(matchId, team1, Number(e.target.value), team2)}
                    fullWidth
                    inputProps={{ min: 0, max: winLegs }}
                />
            </div>
            <div style={{ textAlign: "right", margin: "4px" }}>vs</div>
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{
                    flex: 3, minWidth: 0, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontSize: teamNames[team2]?.length > 20 ? "0.75rem" : "1rem"
                }}>
                    {teamNames[team2]}
                </Typography>
                <TextField
                    style={{ flex: 1, minWidth: "60px" }}
                    type="number"
                    value={match[`legs_${team2}`]}
                    disabled={disabled}
                    onChange={e => onScoreChange(matchId, team2, Number(e.target.value), team1)}
                    fullWidth
                    inputProps={{ min: 0, max: winLegs }}
                />
            </div>
        </Card>
    );
}

function DesktopMatchRow({ matchId, match, teamNames, winLegs, editTooltip, disabled, onScoreChange }) {
    const team1 = match.team1;
    const team2 = match.team2;

    return (
        <TableRow key={matchId}>
            <TableCell align="center">{matchId}</TableCell>
            <TableCell align="right">
                <Tooltip title={editTooltip}>
                    <span>
                        <TextField
                            type="number"
                            value={match[`legs_${team1}`]}
                            disabled={disabled}
                            onChange={e => onScoreChange(matchId, team1, Number(e.target.value), team2)}
                            inputProps={{ min: 0, max: winLegs }}
                        />
                    </span>
                </Tooltip>
            </TableCell>
            <TableCell
                align="right" width="25%"
                sx={{
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontSize: teamNames[team1]?.length > 25 ? "0.75rem" : "1rem"
                }}
            >
                <Tooltip title={teamNames[team1]} enterDelay={1000}>
                    <span>{teamNames[team1]}</span>
                </Tooltip>
            </TableCell>
            <TableCell align="center">vs</TableCell>
            <TableCell
                align="left" width="25%"
                sx={{
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontSize: teamNames[team2]?.length > 25 ? "0.75rem" : "1rem"
                }}
            >
                <Tooltip title={teamNames[team2]} enterDelay={1000}>
                    <span>{teamNames[team2]}</span>
                </Tooltip>
            </TableCell>
            <TableCell align="left">
                <Tooltip title={editTooltip}>
                    <span>
                        <TextField
                            type="number"
                            value={match[`legs_${team2}`]}
                            disabled={disabled}
                            onChange={e => onScoreChange(matchId, team2, Number(e.target.value), team1)}
                            inputProps={{ min: 0, max: winLegs }}
                        />
                    </span>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}
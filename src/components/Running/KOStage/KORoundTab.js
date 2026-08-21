import {
    Button, Table, TableBody, TableCell, TableHead, TableRow,
    TextField, Typography, useTheme, useMediaQuery, Card, Tooltip
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
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

    // Hält Felder fest, die lokal bearbeitet/gespeichert wurden, aber vom Server
    // noch nicht bestätigt sind ("matchKey_feld" -> Wert). Ein eingehender Snapshot
    // überschreibt so lange nicht diesen Wert, bis der Server denselben Wert liefert
    // (verhindert, dass parallele Schreibvorgänge anderer Geräte laufende Eingaben
    // oder frisch gespeicherte, aber noch nicht zurückgespiegelte Werte überschreiben).
    const dirtyFieldsRef = useRef({});

    function mergeSnapshot(incomingMatches) {
        const dirty = dirtyFieldsRef.current;
        const merged = {};
        for (const [matchKey, incomingMatch] of Object.entries(incomingMatches)) {
            merged[matchKey] = { ...incomingMatch };
            for (const field of Object.keys(incomingMatch)) {
                const dirtyKey = `${matchKey}_${field}`;
                if (dirtyKey in dirty) {
                    if (dirty[dirtyKey] === incomingMatch[field]) {
                        delete dirty[dirtyKey];
                    } else {
                        merged[matchKey][field] = dirty[dirtyKey];
                    }
                }
            }
        }
        return merged;
    }

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

    const koStageMatchMap = {
        1: [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
        ],
        2: [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
        ],
        3: [
            1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1
        ],
        4: [
            1, 2, 3, 4, 4, 3, 2, 1, 1, 2, 3, 4, 4, 3, 2, 1, 1, 2, 3, 4, 4, 3, 2, 1, 1, 2, 3, 4, 4, 3, 2, 1
        ],
        5: [
            1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1
        ]
    }

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
                    const mergedMatches = mergeSnapshot(data.matches || {});
                    setRoundData({ ...data, matches: mergedMatches });
                    const matches = Object.entries(mergedMatches)
                        .filter(([key]) => key !== "place3");
                    const place3 = mergedMatches.place3;
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

    // Nur lokalen State aktualisieren — Speichern erfolgt erst bei onBlur (handleLegScoreBlur),
    // damit nicht bei jedem Tastendruck/Pfeiltasten-Klick eine eigene Transaktion feuert.
    function handleLegScoreChange(matchKey, team, newScore) {
        dirtyFieldsRef.current[`${matchKey}_legs_${team}`] = newScore;
        setRoundData(prev => ({
            ...prev,
            matches: {
                ...prev.matches,
                [matchKey]: { ...prev.matches[matchKey], [`legs_${team}`]: newScore }
            }
        }));
    }

    function handleLegScoreBlur(matchKey, team, newScore, opponent) {
        dirtyFieldsRef.current[`${matchKey}_legs_${team}`] = newScore;
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

    function winnerPlaceholderLabel(id) {
        if (roundIndex === 1) return 'VR Platz ' + id;
        return `Sieger ${koRoundLabel(koRounds, roundIndex - 1)} ${id}`;
    }

    function loserPlaceholderLabel(id) {
        return `Verlierer ${koRoundLabel(koRounds, roundIndex - 1)} ${id}`;
    }

    function matchLabel(id) {
        return `${label} ${id}`;
    }

    // Platzhalter-Zeilen wenn Runde noch nicht generiert wurde
    function renderPlaceholders() {
        const qualifiedCount = Math.pow(2, koRounds); // Gesamtanzahl qualifizierter Teams
        const rows = [];
        for (let i = 0; i < matchCount; i++) {
            if(qualifiedCount === matchCount * 2) {
                const id1 = i + 1;
                const id2 = qualifiedCount - i;
                rows.push({ id1, id2, key: `placeholder_${i}` });
            }
            else {
                const id1 = koStageMatchMap[5-koRounds+roundIndex][i];
                const id2 = koStageMatchMap[5-koRounds+roundIndex][(matchCount*2)-i-1];
                rows.push({ id1, id2, key: `placeholder_${i}` });
            }
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

                {isFinal && (
                    <Typography variant="h2" align="center" sx={{ my: 1, fontWeight: "bold" }}>Finale</Typography>
                )}

                {roundReady ? (
                    <div>
                        {mainMatches
                            .sort(([i1, t1], [i2, t2]) => Number(i1.replace("M", "")) - Number(i2.replace("M", "")))
                            .map(([matchId, match]) => (
                                <MobileMatchCard
                                    key={matchId}
                                    matchId={matchId}
                                    matchLabel={matchLabel(Number(matchId.replace("M", "")))}
                                    match={match}
                                    teamNames={teamNames}
                                    winLegs={winLegs}
                                    disabled={status !== statusKey || isViewMode}
                                    onScoreChange={handleLegScoreChange}
                                    onScoreBlur={handleLegScoreBlur}
                                    showMatchId={!isFinal}
                                />
                            ))}
                        {isFinal && hasThirdPlace && place3Match && (
                            <>
                                <br />
                                <Typography variant="h2" sx={{ my: 1, fontWeight: "bold" }}>Spiel um Platz 3</Typography>
                                <MobileMatchCard
                                    matchId="place3"
                                    match={place3Match}
                                    teamNames={teamNames}
                                    winLegs={winLegs}
                                    disabled={status !== statusKey || isViewMode}
                                    onScoreChange={handleLegScoreChange}
                                    onScoreBlur={handleLegScoreBlur}
                                    showMatchId={false}
                                />
                            </>
                        )}
                    </div>
                ) : (
                    <div>
                        {renderPlaceholders().map(({ id1, id2, key }) => (
                            <Card key={key} sx={{ width: "90vw", mx: "auto", mb: 2 }}>
                                {!isFinal && <div style={{ textAlign: "left", margin: "2px" }}>{matchLabel(id1)}</div>}
                                <div>{winnerPlaceholderLabel(id1)}</div>
                                <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                                <div>{winnerPlaceholderLabel(id2)}</div>
                            </Card>
                        ))}
                        {isFinal && hasThirdPlace && (
                            <>
                                <br />
                                <Typography variant="h2" sx={{ my: 1, fontWeight: "bold" }}>Spiel um Platz 3</Typography>
                                {renderPlaceholders().map(({ id1, id2 }) => (
                                    <Card key="placeholder_place3" sx={{ width: "90vw", mx: "auto", mb: 2 }}>
                                        <div>{loserPlaceholderLabel(id1)}</div>
                                        <div style={{ textAlign: "left", margin: "6px 5%" }}>vs</div>
                                        <div>{loserPlaceholderLabel(id2)}</div>
                                    </Card>
                                ))}
                            </>
                        )}
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

            {isFinal && (
                <Typography variant="h2" align="center" sx={{ mt: 1, fontWeight: "bold" }}>Finale</Typography>
            )}

            <Table sx={{ width: "80vw", mx: "auto", mb: 2, maxWidth: 800 }}
                style={{ borderCollapse: "collapse", alignContent: "center" }}>
                <TableHead>
                    <TableRow>
                        {!isFinal && (<TableCell align="center" width="15%">Match</TableCell>)}
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
                                    matchLabel={matchLabel(Number(matchId.replace("M", "")))}
                                    match={match}
                                    teamNames={teamNames}
                                    winLegs={winLegs}
                                    editTooltip={editTooltip}
                                    disabled={status !== statusKey || isViewMode}
                                    onScoreChange={handleLegScoreChange}
                                    onScoreBlur={handleLegScoreBlur}
                                    showMatchId={!isFinal}
                                />
                            ))}
                    </TableBody>
                ) : (
                    <TableBody>
                        {renderPlaceholders().map(({ id1, id2, key }) => (
                            <TableRow key={key}>
                                {!isFinal && (<TableCell align="center">{matchLabel(id1)}</TableCell>)}
                                <TableCell />
                                <TableCell align="right">{winnerPlaceholderLabel(id1)}</TableCell>
                                <TableCell align="center">vs</TableCell>
                                <TableCell>{winnerPlaceholderLabel(id2)}</TableCell>
                                <TableCell />
                            </TableRow>
                        ))}
                    </TableBody>
                )}
            </Table>
            <br />
            <br />

            {isFinal && hasThirdPlace && (
                <>
                    <Typography variant="h2" align="center" sx={{ mt: 1, fontWeight: "bold" }}>Spiel um Platz 3</Typography>
                    <Table sx={{ width: "80vw", mx: "auto", mb: 2, maxWidth: 800 }}
                        style={{ borderCollapse: "collapse", alignContent: "center" }}>
                        <TableHead>
                            <TableRow>
                                <TableCell align="right" width="10%">Legs</TableCell>
                                <TableCell align="right" width="25%">Team 1</TableCell>
                                <TableCell align="center" width="10%"></TableCell>
                                <TableCell align="left" width="25%">Team 2</TableCell>
                                <TableCell align="left" width="10%">Legs</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {place3Match?.team1 ? (
                                <DesktopMatchRow
                                    matchId="place3"
                                    match={place3Match}
                                    teamNames={teamNames}
                                    winLegs={winLegs}
                                    editTooltip={editTooltip}
                                    disabled={status !== statusKey || isViewMode}
                                    onScoreChange={handleLegScoreChange}
                                    onScoreBlur={handleLegScoreBlur}
                                    showMatchId={false}
                                />
                            ) : (
                                renderPlaceholders().map(({ id1, id2 }) => (
                                    <TableRow key="placeholder_place3">
                                        <TableCell />
                                        <TableCell align="right">{loserPlaceholderLabel(id1)}</TableCell>
                                        <TableCell align="center">vs</TableCell>
                                        <TableCell>{loserPlaceholderLabel(id2)}</TableCell>
                                        <TableCell />
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </>
            )}
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

function MobileMatchCard({ matchId, matchLabel, match, teamNames, winLegs, disabled, onScoreChange, onScoreBlur, showMatchId = true }) {
    const team1 = match.team1;
    const team2 = match.team2;

    return (
        <Card sx={{ width: "90vw", mx: "auto", mb: 2 }}>
            {showMatchId && <div style={{ textAlign: "center", margin: "2px" }}>{matchLabel}</div>}
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
                    onChange={e => onScoreChange(matchId, team1, Number(e.target.value))}
                    onBlur={e => onScoreBlur(matchId, team1, Number(e.target.value), team2)}
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
                    onChange={e => onScoreChange(matchId, team2, Number(e.target.value))}
                    onBlur={e => onScoreBlur(matchId, team2, Number(e.target.value), team1)}
                    fullWidth
                    inputProps={{ min: 0, max: winLegs }}
                />
            </div>
        </Card>
    );
}

function DesktopMatchRow({ matchId, matchLabel, match, teamNames, winLegs, editTooltip, disabled, onScoreChange, onScoreBlur, showMatchId = true }) {
    const team1 = match.team1;
    const team2 = match.team2;

    return (
        <TableRow key={matchId}>
            {showMatchId && <TableCell align="center">{matchLabel}</TableCell>}
            <TableCell align="right">
                <Tooltip title={editTooltip}>
                    <span>
                        <TextField
                            type="number"
                            value={match[`legs_${team1}`]}
                            disabled={disabled}
                            onChange={e => onScoreChange(matchId, team1, Number(e.target.value))}
                            onBlur={e => onScoreBlur(matchId, team1, Number(e.target.value), team2)}
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
                            onChange={e => onScoreChange(matchId, team2, Number(e.target.value))}
                            onBlur={e => onScoreBlur(matchId, team2, Number(e.target.value), team1)}
                            inputProps={{ min: 0, max: winLegs }}
                        />
                    </span>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}
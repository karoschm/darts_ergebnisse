import { Button, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, useTheme, useMediaQuery, Card, Tooltip } from "@mui/material";
import { useState, useEffect, useRef, Fragment } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { getAllTeams, saveScore, setMatchPlayed, subscribeMatchday, subscribeTournamentStatus, setMatchdayEditing, clearMatchdayEditing, groupLabel } from "../../../services/firestoreService";
import useDirtyField from "../../../hooks/useDirtyField";
import { getClientId } from "../../../hooks/useClientId";

// Nach dieser Zeit gilt ein "editingAt"-Zeitstempel als veraltet (z.B. Tab ohne Blur geschlossen)
const EDITING_STALE_MS = 12000;

export default function MatchdayTabs({ md, isViewMode, scoreMode = "points", winLegs = 3, groupCount = 1 }) {
    const { currentTournamentId } = useTournament();
    const [matches, setMatches] = useState({});
    const [teamNames, setTeamNames] = useState({});
    const [status, setStatus] = useState("");

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const { markDirty, mergeSnapshot } = useDirtyField();
    const focusedMatchRef = useRef(null);
    const clientIdRef = useRef(getClientId());

    const fieldPrefix = scoreMode === "legs" ? "legs" : "score";
    const maxScore = scoreMode === "legs" ? winLegs : 501;

    useEffect(() => {
        if (!currentTournamentId) return;

        let unsubscribeMatchday;
        let unsubscribeStatus;

        async function init() {
            const loadedTeams = await getAllTeams(currentTournamentId);
            const names = loadedTeams.reduce((acc, doc) => {
                acc[doc.id] = doc.name || "";
                return acc;
            }, {});
            setTeamNames(names);

            unsubscribeMatchday = subscribeMatchday(currentTournamentId, md, (data) => {
                setMatches(mergeSnapshot(data));
            });
            unsubscribeStatus = subscribeTournamentStatus(currentTournamentId, setStatus);
        }

        init();
        return () => {
            if (unsubscribeMatchday) unsubscribeMatchday();
            if (unsubscribeStatus) unsubscribeStatus();
            if (focusedMatchRef.current) {
                clearMatchdayEditing(currentTournamentId, md, focusedMatchRef.current);
                focusedMatchRef.current = null;
            }
        };
    }, [currentTournamentId, md]);

    // Nur lokalen State aktualisieren — Speichern erfolgt erst bei onBlur (handleScoreBlur),
    // damit nicht bei jedem Tastendruck/Pfeiltasten-Klick eine eigene Transaktion feuert
    // (führte sonst zu überholenden Schreibvorgängen und sichtbarem Zurückspringen des Scores).
    function handleScoreChange(matchKey, team, newScore) {
        markDirty(matchKey, `${fieldPrefix}_${team}`, newScore);
        setMatches(prev => ({
            ...prev,
            [matchKey]: { ...prev[matchKey], [`${fieldPrefix}_${team}`]: newScore }
        }));
    }

    function handleScoreFocus(matchKey) {
        focusedMatchRef.current = matchKey;
        setMatchdayEditing(currentTournamentId, md, matchKey, clientIdRef.current);
    }

    function handleScoreBlur(matchKey, team, newScore, opponent) {
        markDirty(matchKey, `${fieldPrefix}_${team}`, newScore);
        saveScore(currentTournamentId, md, matchKey, team, newScore, opponent, scoreMode, winLegs);
        clearMatchdayEditing(currentTournamentId, md, matchKey);
        if (focusedMatchRef.current === matchKey) focusedMatchRef.current = null;
    }

    // Zeigt an, ob ein *anderes* Gerät gerade dieses Match bearbeitet (best-effort, kein Lock)
    function isBeingEditedByOther(match) {
        if (!match.editingBy || match.editingBy === clientIdRef.current) return false;
        const editingAt = match.editingAt?.toDate?.();
        if (!editingAt) return false;
        return Date.now() - editingAt.getTime() < EDITING_STALE_MS;
    }

    function enterResult(matchKey) {
        markDirty(matchKey, "played", true);
        setMatches(prev => ({
            ...prev,
            [matchKey]: { ...prev[matchKey], played: true }
        }));
        setMatchPlayed(currentTournamentId, md, matchKey);
    }

    // BYE-Spiel: nur "[Teamname] spielfrei" anzeigen
    function renderByeMatch(mNumber, match) {
        const realTeam = match.team1 === "BYE" ? match.team2 : match.team1;
        const teamName = teamNames[realTeam] || realTeam;

        if (isMobile) {
            return (
                <Card key={mNumber} sx={{ width: "90vw", mx: "auto", mb: 2, p: 1 }}>
                    <Typography fontStyle="italic" color="text.secondary">
                        {teamName} spielfrei
                    </Typography>
                </Card>
            );
        }

        return (
            <TableRow key={mNumber}>
                <TableCell colSpan={6} align="center">
                    <Typography fontStyle="italic" color="text.secondary">
                        {teamName} spielfrei
                    </Typography>
                </TableCell>
            </TableRow>
        );
    }

    const matchEntries = groupCount > 1
        ? Object.keys(matches).sort((a, b) => {
            const groupDiff = (matches[a].group ?? 0) - (matches[b].group ?? 0);
            return groupDiff !== 0 ? groupDiff : a.localeCompare(b);
        })
        : Object.keys(matches).sort((a, b) => a.localeCompare(b));

    // Gruppenüberschrift rendern, sobald sich die Gruppe zur vorigen Zeile ändert
    // (mehrere Gruppen teilen sich denselben Spieltag, ohne das wäre unklar, wer gegen wen spielt)
    function maybeGroupHeading(mNumber, index) {
        if (groupCount <= 1) return null;
        const group = matches[mNumber].group ?? 0;
        const prevGroup = index > 0 ? (matches[matchEntries[index - 1]].group ?? 0) : null;
        if (group === prevGroup) return null;
        return (
            <Typography key={`group_heading_${group}`} variant="h6" sx={{ mt: 2, mb: 1, width: "100%" }}>
                Gruppe {groupLabel(group)}
            </Typography>
        );
    }

    if (isMobile) {
        return (
            <div>
                <br />
                {matchEntries.map((mNumber, index) => {
                    const match = matches[mNumber];
                    const heading = maybeGroupHeading(mNumber, index);
                    if (match.isByeMatch) return <div key={`wrap_${mNumber}`}>{heading}{renderByeMatch(mNumber, match)}</div>;

                    const team1 = match.team1;
                    const team2 = match.team2;

                    return (
                        <div key={`wrap_${mNumber}`}>
                            {heading}
                            <Card sx={{ width: "90vw", mx: "auto", mb: 2 }}>
                                <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
                                    <Typography
                                        sx={{
                                            flex: 3, minWidth: 0, overflow: "hidden",
                                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            fontSize: teamNames[team1]?.length > 20 ? "0.75rem" : "1rem"
                                        }}
                                    >
                                        {teamNames[team1]}
                                    </Typography>
                                    <TextField
                                        style={{ flex: 1, minWidth: "60px" }}
                                        type="number"
                                        value={match[`${fieldPrefix}_${team1}`]}
                                        disabled={status !== "group" || isViewMode}
                                        onChange={e => handleScoreChange(mNumber, team1, Number(e.target.value))}
                                        onFocus={() => handleScoreFocus(mNumber)}
                                        onBlur={e => handleScoreBlur(mNumber, team1, Number(e.target.value), team2)}
                                        fullWidth
                                        inputProps={{ min: 0, max: maxScore }}
                                    />
                                </div>
                                <div style={{ textAlign: "right", margin: "4px" }}>vs</div>
                                <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
                                    <Typography
                                        sx={{
                                            flex: 3, minWidth: 0, overflow: "hidden",
                                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            fontSize: teamNames[team2]?.length > 20 ? "0.75rem" : "1rem"
                                        }}
                                    >
                                        {teamNames[team2]}
                                    </Typography>
                                    <TextField
                                        style={{ flex: 1, minWidth: "60px" }}
                                        type="number"
                                        value={match[`${fieldPrefix}_${team2}`]}
                                        disabled={status !== "group" || isViewMode}
                                        onChange={e => handleScoreChange(mNumber, team2, Number(e.target.value))}
                                        onFocus={() => handleScoreFocus(mNumber)}
                                        onBlur={e => handleScoreBlur(mNumber, team2, Number(e.target.value), team1)}
                                        fullWidth
                                        inputProps={{ min: 0, max: maxScore }}
                                    />
                                </div>
                                {isBeingEditedByOther(match) && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center" }}>
                                        Wird gerade auf einem anderen Gerät bearbeitet…
                                    </Typography>
                                )}
                            </Card>
                        </div>
                    );
                })}
            </div>
        );
    }

    function maybeGroupHeadingRow(mNumber, index) {
        if (groupCount <= 1) return null;
        const group = matches[mNumber].group ?? 0;
        const prevGroup = index > 0 ? (matches[matchEntries[index - 1]].group ?? 0) : null;
        if (group === prevGroup) return null;
        return (
            <TableRow key={`group_heading_${group}`}>
                <TableCell colSpan={6}>
                    <Typography variant="h6" sx={{ mt: index > 0 ? 2 : 0 }}>
                        Gruppe {groupLabel(group)}
                    </Typography>
                </TableCell>
            </TableRow>
        );
    }

    return (
        <Table sx={{ width: "80vw", mx: "auto", mb: 2, maxWidth: 800 }} style={{ borderCollapse: "collapse" }}>
            <TableBody>
                {matchEntries.map((mNumber, index) => {
                    const match = matches[mNumber];
                    const headingRow = maybeGroupHeadingRow(mNumber, index);
                    if (match.isByeMatch) return <Fragment key={`wrap_${mNumber}`}>{headingRow}{renderByeMatch(mNumber, match)}</Fragment>;

                    const team1 = match.team1;
                    const team2 = match.team2;
                    const scoreTeam1 = match[`${fieldPrefix}_${team1}`];
                    const scoreTeam2 = match[`${fieldPrefix}_${team2}`];
                    const gamePlayed = match.played;

                    const editTooltip = isViewMode
                        ? "Keine Bearbeitung möglich (Beobachtungsmodus)"
                        : status !== "group"
                            ? "Das Turnier befindet sich in einer anderen Stufe"
                            : "";

                    return (
                    <Fragment key={`wrap_${mNumber}`}>
                        {headingRow}
                        {gamePlayed ? (
                        <TableRow>
                            <TableCell align="right" width="10%">
                                <Tooltip title={editTooltip}>
                                    <span>
                                        <TextField
                                            type="number"
                                            style={{ width: "60px" }}
                                            disabled={status !== "group" || isViewMode}
                                            value={scoreTeam1}
                                            onChange={e => handleScoreChange(mNumber, team1, Number(e.target.value))}
                                            onFocus={() => handleScoreFocus(mNumber)}
                                            onBlur={e => handleScoreBlur(mNumber, team1, Number(e.target.value), team2)}
                                            inputProps={{ min: 0, max: maxScore }}
                                        />
                                    </span>
                                </Tooltip>
                            </TableCell>
                            <TableCell align="right" width="25%" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: teamNames[team1]?.length > 25 ? "0.75rem" : "1rem" }}>
                                <Tooltip title={teamNames[team1]} enterDelay={1000}>
                                    <span>{teamNames[team1]}</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell align="center" width="10%">vs</TableCell>
                            <TableCell align="left" width="25%" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: teamNames[team2]?.length > 25 ? "0.75rem" : "1rem" }}>
                                <Tooltip title={teamNames[team2]} enterDelay={1000}>
                                    <span>{teamNames[team2]}</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell align="left" width="10%">
                                <Tooltip title={editTooltip}>
                                    <span>
                                        <TextField
                                            type="number"
                                            style={{ width: "60px" }}
                                            disabled={status !== "group" || isViewMode}
                                            value={scoreTeam2}
                                            onChange={e => handleScoreChange(mNumber, team2, Number(e.target.value))}
                                            onFocus={() => handleScoreFocus(mNumber)}
                                            onBlur={e => handleScoreBlur(mNumber, team2, Number(e.target.value), team1)}
                                            inputProps={{ min: 0, max: maxScore }}
                                        />
                                    </span>
                                </Tooltip>
                            </TableCell>
                            <TableCell width="20%">
                                {isBeingEditedByOther(match) && (
                                    <Typography variant="caption" color="text.secondary">
                                        Wird gerade auf einem anderen Gerät bearbeitet…
                                    </Typography>
                                )}
                            </TableCell>
                        </TableRow>
                    ) : (
                        <TableRow>
                            <TableCell width="10%" />
                            <TableCell align="right" width="25%">{teamNames[team1]}</TableCell>
                            <TableCell align="center" width="10%">vs</TableCell>
                            <TableCell align="left" width="25%">{teamNames[team2]}</TableCell>
                            <TableCell width="10%" />
                            <TableCell width="20%">
                                {!isViewMode && (
                                    <Button onClick={() => enterResult(mNumber)} disabled={status !== "group"}>
                                        Ergebnis eintragen
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                        )}
                    </Fragment>
                    );
                })}
            </TableBody>
        </Table>
    );
}
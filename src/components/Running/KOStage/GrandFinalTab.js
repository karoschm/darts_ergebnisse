import {
    Button, Table, TableBody, TableCell, TableHead, TableRow,
    TextField, Typography, useTheme, useMediaQuery, CircularProgress
} from "@mui/material";
import { useEffect, useState, useRef } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { getClientId } from "../../../hooks/useClientId";
import {
    getAllTeams,
    saveKOScore,
    subscribeKnockoutRound,
    updateKOStageWinLegs,
    updateAllKOsPlayed,
    updateTournamentStatus,
    getTournamentData,
    generateGrandFinalReset,
    updateRankingDoubleElim,
    markRoundFinished,
    setKOEditing,
    clearKOEditing,
    GRAND_FINAL_STAGE
} from "../../../services/firestoreService";
import useDirtyField from "../../../hooks/useDirtyField";
import { MobileMatchCard, DesktopMatchRow } from "./KORoundTab";

// Nach dieser Zeit gilt ein "editingAt"-Zeitstempel als veraltet (z.B. Tab ohne Blur geschlossen)
const EDITING_STALE_MS = 12000;

/**
 * Grand Final (und ggf. Bracket-Reset-Spiel) für Doppel-KO-Turniere. Eigene, schlanke
 * Komponente statt Erweiterung von KORoundTab, da der Rundenabschluss hier eine
 * Sonderlogik hat (ggf. zweites Spiel statt Turnierende) und es kein Platzhalter-/
 * Platz-3-Konzept gibt — anders als bei den generischen WB-/LB-Runden.
 *
 * Props:
 *   stageKey      — GRAND_FINAL_STAGE oder GRAND_FINAL_RESET_STAGE
 *   bracketReset  — ob für dieses Turnier ein Bracket Reset konfiguriert ist
 *   isViewMode    — Bearbeitungsfunktionen gesperrt
 */
export default function GrandFinalTab({ stageKey, bracketReset, isViewMode }) {
    const { currentTournamentId } = useTournament();
    const [teamNames, setTeamNames] = useState({});
    const [roundData, setRoundData] = useState({ matches: {} });
    const [allMatchesPlayed, setAllMatchesPlayed] = useState(false);
    const [winLegs, setWinLegs] = useState(3);
    const [loading, setLoading] = useState(true);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const { markDirty, mergeSnapshot } = useDirtyField();
    const focusedMatchRef = useRef(null);
    const clientIdRef = useRef(getClientId());

    const isReset = stageKey !== GRAND_FINAL_STAGE;
    const label = isReset ? "Grand Final — Entscheidungsspiel" : "Grand Final";
    const roundGateBlocked = !!roundData.roundFinished;
    const editingDisabled = roundGateBlocked || isViewMode;

    const match = roundData.matches?.M1;

    useEffect(() => {
        if (!currentTournamentId) return;

        let unsubscribeKnockout;

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
                    const merged = mergeSnapshot({
                        ...(data.matches || {}),
                        meta: { winLegs: data.winLegs ?? 3 }
                    });
                    const { meta, ...mergedMatches } = merged;
                    setRoundData({ ...data, matches: mergedMatches });
                    setWinLegs(meta.winLegs);
                    const m = mergedMatches.M1;
                    setAllMatchesPlayed(!!m?.played);
                    setLoading(false);
                }
            );
        }

        init();
        return () => {
            if (unsubscribeKnockout) unsubscribeKnockout();
            if (focusedMatchRef.current) {
                clearKOEditing(currentTournamentId, stageKey, focusedMatchRef.current);
                focusedMatchRef.current = null;
            }
        };
    }, [currentTournamentId, stageKey]);

    function handleLegScoreChange(matchKey, team, newScore) {
        markDirty(matchKey, `legs_${team}`, newScore);
        setRoundData(prev => ({
            ...prev,
            matches: {
                ...prev.matches,
                [matchKey]: { ...prev.matches[matchKey], [`legs_${team}`]: newScore }
            }
        }));
    }

    function handleLegScoreFocus(matchKey) {
        focusedMatchRef.current = matchKey;
        setKOEditing(currentTournamentId, stageKey, matchKey, clientIdRef.current);
    }

    function handleLegScoreBlur(matchKey, team, newScore, opponent) {
        markDirty(matchKey, `legs_${team}`, newScore);
        saveKOScore(currentTournamentId, stageKey, matchKey, team, newScore, opponent, winLegs);
        clearKOEditing(currentTournamentId, stageKey, matchKey);
        if (focusedMatchRef.current === matchKey) focusedMatchRef.current = null;
    }

    function isBeingEditedByOther(m) {
        if (!m.editingBy || m.editingBy === clientIdRef.current) return false;
        const editingAt = m.editingAt?.toDate?.();
        if (!editingAt) return false;
        return Date.now() - editingAt.getTime() < EDITING_STALE_MS;
    }

    function handleWinLegsChange(newWinLegs) {
        markDirty("meta", "winLegs", newWinLegs);
        setWinLegs(newWinLegs);
        updateKOStageWinLegs(currentTournamentId, stageKey, newWinLegs);
        updateAllKOsPlayed(currentTournamentId, stageKey, newWinLegs);
    }

    const handleFinish = async () => {
        await updateAllKOsPlayed(currentTournamentId, stageKey, winLegs);
        if (!match) return;

        const winner = match[`legs_${match.team1}`] > match[`legs_${match.team2}`] ? match.team1 : match.team2;
        const loser = winner === match.team1 ? match.team2 : match.team1;

        if (!isReset) {
            const data = await getTournamentData(currentTournamentId);
            if (bracketReset && winner === data.lbChampion) {
                // LB-Champion gewinnt Spiel 1: WB-Champion muss zum Sieg ein zweites
                // Mal gewinnen (Bracket Reset) — Turnier ist noch nicht entschieden.
                await markRoundFinished(currentTournamentId, stageKey);
                await generateGrandFinalReset(currentTournamentId, winner, loser);
                return;
            }
        }

        // Spiel 2 (Reset) ist immer entscheidend; Spiel 1 ist entscheidend, wenn der
        // WB-Champion gewinnt oder kein Bracket Reset konfiguriert ist.
        await markRoundFinished(currentTournamentId, stageKey);
        await updateRankingDoubleElim(currentTournamentId);
        await updateTournamentStatus(currentTournamentId, "finished");
    };

    if (loading) {
        return (
            <div style={{
                flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", padding: "60px 20px"
            }}>
                <CircularProgress />
            </div>
        );
    }

    if (!match) {
        return (
            <div style={{
                flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
                alignItems: "center", textAlign: "center", padding: "60px 20px"
            }}>
                <Typography color="text.secondary" fontStyle="italic">
                    Teilnehmer stehen erst fest, sobald Gewinner- und Loser-Bracket abgeschlossen sind.
                </Typography>
            </div>
        );
    }

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
                disabled={editingDisabled}
                onChange={e => handleWinLegsChange(Number(e.target.value))}
                inputProps={{ min: 0 }}
            />
            <br />
            <Typography variant="h2" align="center" sx={{ my: 1, fontWeight: "bold" }}>{label}</Typography>

            {isMobile ? (
                <MobileMatchCard
                    matchId="M1"
                    match={match}
                    teamNames={teamNames}
                    winLegs={winLegs}
                    disabled={editingDisabled}
                    onScoreChange={handleLegScoreChange}
                    onScoreFocus={handleLegScoreFocus}
                    onScoreBlur={handleLegScoreBlur}
                    showMatchId={false}
                    beingEditedByOther={isBeingEditedByOther(match)}
                />
            ) : (
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
                        <DesktopMatchRow
                            matchId="M1"
                            match={match}
                            teamNames={teamNames}
                            winLegs={winLegs}
                            editTooltip=""
                            disabled={editingDisabled}
                            onScoreChange={handleLegScoreChange}
                            onScoreFocus={handleLegScoreFocus}
                            onScoreBlur={handleLegScoreBlur}
                            showMatchId={false}
                            beingEditedByOther={isBeingEditedByOther(match)}
                        />
                    </TableBody>
                </Table>
            )}

            {!isViewMode && (
                <Button onClick={handleFinish} disabled={!allMatchesPlayed || roundGateBlocked} sx={{ mt: 2 }}>
                    {isReset ? "Turnier abschließen" : "Grand Final abschließen"}
                </Button>
            )}
        </div>
    );
}

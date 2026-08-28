import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, writeBatch, runTransaction, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

// ─── PIN Utilities ────────────────────────────────────────────────────────────

export async function hashPin(pin, tournamentId) {
    const msgBuffer = new TextEncoder().encode(pin + tournamentId);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// Versucht den PIN serverseitig zu bestätigen: der Client erfährt den echten
// Hash nie, nur ob der Write gegen die Firestore-Rule erfolgreich war.
export async function verifyPinAndUnlock(tournamentId, pin) {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;

    const pinHashAttempt = await hashPin(pin, tournamentId);
    const editorRef = doc(db, "tournaments", tournamentId, "authorizedEditors", uid);

    try {
        await setDoc(editorRef, { pinHashAttempt, grantedAt: new Date().toISOString() });
        return true;
    } catch (err) {
        if (err.code === "permission-denied") return false;
        throw err;
    }
}

// ─── KO Round Helpers ─────────────────────────────────────────────────────────

// Runden-Bezeichnungen: Index = Anzahl verbleibender Runden bis zum Finale
export const KO_ROUND_NAMES = {
    1: "Finale",
    2: "Halbfinale",
    3: "Viertelfinale",
    4: "Achtelfinale",
    5: "Last 32",
    6: "Last 64",
};

// stage-String für Runde i (1 = erste/früheste KO-Runde)
export function koStageKey(roundIndex) {
    return `round_${roundIndex}`;
}

// Status-String für Runde i
export function koStatusKey(roundIndex) {
    return `ko_${roundIndex}`;
}

// Bezeichnung einer KO-Runde anhand von Gesamt-KO-Runden und aktuellem Index
// roundIndex: 1 = erste Runde, koRounds = Finale
export function koRoundLabel(koRounds, roundIndex) {
    const roundsFromFinal = koRounds - roundIndex + 1;
    return KO_ROUND_NAMES[roundsFromFinal] ?? `Runde ${roundIndex}`;
}

// Gruppenbezeichnung anhand des 0-basierten Gruppenindex ("A", "B", ...)
export function groupLabel(groupIndex) {
    return String.fromCharCode(65 + groupIndex);
}

// ─── Doppel-KO / Loser-Bracket Helpers ─────────────────────────────────────────

// stage-/status-String für Loser-Bracket-Runde i (1 = erste LB-Runde)
export function loserStageKey(lbRoundIndex) {
    return `l_round_${lbRoundIndex}`;
}

export function loserStatusKey(lbRoundIndex) {
    return `lko_${lbRoundIndex}`;
}

export const GRAND_FINAL_STAGE = "grandfinal";
export const GRAND_FINAL_RESET_STAGE = "grandfinal2";
export const GRAND_FINAL_STATUS = "gf";
export const GRAND_FINAL_RESET_STATUS = "gf2";

/**
 * Liefert die Loser-Bracket-Rundenstruktur für ein Doppel-KO-Turnier mit `koRounds`
 * Winner-Bracket-Runden (Teamanzahl = 2^koRounds). Reine Funktion, einzige Quelle
 * der Wahrheit für LB-Rundenanzahl/-größe (genutzt von Running.js, KORoundTab.js
 * und advanceLoserBracket).
 *
 * Jede WB-Runde i (1..koRounds) hat 2^(koRounds-i) Verlierer. Ab WB-Runde 2 wechseln
 * sich "reduce"-Runden (bisherige LB-Survivor spielen nur gegeneinander) und
 * "drop"-Runden (Sieger der reduce-Runde + frische Verlierer aus WB-Runde `sourceWb`
 * spielen gegeneinander) ab. Bei koRounds < 2 gibt es kein Loser-Bracket (das
 * WB-Finale ist bereits das Grand Final).
 */
export function getLbSchedule(koRounds) {
    if (koRounds < 2) return [];
    const rounds = [];
    let survivorCount = Math.pow(2, koRounds - 1); // Größe von L_1
    for (let wbRound = 2; wbRound <= koRounds; wbRound++) {
        const loserCount = Math.pow(2, koRounds - wbRound);
        rounds.push({ type: "reduce", teamsIn: survivorCount, sourceWb: null });
        survivorCount = survivorCount / 2;
        rounds.push({ type: "drop", teamsIn: survivorCount + loserCount, sourceWb: wbRound });
        survivorCount = (survivorCount + loserCount) / 2;
    }
    return rounds;
}

// Bezeichnung einer Loser-Bracket-Runde. Die letzte LB-Runde (LB-Champion) heißt
// immer "Loser-Finale", alle anderen laufend durchnummeriert ("Loser-Runde N").
// Bewusst NICHT von der Teamanzahl abgeleitet (analog KO_ROUND_NAMES/koRoundLabel):
// eine "reduce"- und die direkt folgende "drop"-Runde derselben Welle haben oft
// dieselbe Teamanzahl (z.B. beide 4 Teams bei 8 Teams gesamt), was mit einer von
// der Teamanzahl abgeleiteten Bezeichnung zu zwei Runden mit identischem Tab-Titel
// führen würde — für den Nutzer nicht von echten Duplikaten zu unterscheiden.
export function loserRoundLabel(koRounds, lbRoundIndex) {
    const schedule = getLbSchedule(koRounds);
    if (lbRoundIndex === schedule.length) return "Loser-Finale";
    return `Loser-Runde ${lbRoundIndex}`;
}

/**
 * Rang, ab dem die Verlierer der LB-Runde `lbRoundIndex` eingeordnet werden
 * (mehrere gleichzeitige Verlierer bekommen fortlaufende Ränge ab hier, analog zur
 * bestehenden WB-Verlierer-Formel). Herleitung: von den insgesamt 2^koRounds Teams
 * sind vor Runde `lbRoundIndex` bereits alle Verlierer der vorherigen LB-Runden
 * endgültig ausgeschieden (WB-Runden-Verlierer, die noch nicht im LB gespielt haben,
 * gelten nicht als ausgeschieden) — die verbleibenden Plätze werden von hinten nach
 * vorn aufgefüllt.
 */
export function lbEliminationBaseRank(koRounds, lbRoundIndex) {
    const schedule = getLbSchedule(koRounds);
    const totalTeams = Math.pow(2, koRounds);
    let eliminatedBefore = 0;
    for (let i = 0; i < lbRoundIndex - 1; i++) {
        eliminatedBefore += schedule[i].teamsIn / 2;
    }
    const thisLoserCount = schedule[lbRoundIndex - 1].teamsIn / 2;
    return totalTeams - eliminatedBefore - thisLoserCount + 1;
}

// Nächster Status nach dem aktuellen
export function nextStatus(currentStatus, koRounds, mode = "roundrobin", koFormat = "single") {
    if (currentStatus === "setup" && mode === "directko") return koRounds > 0 ? koStatusKey(1) : "finished";
    if (mode === "directko" && koFormat === "double") {
        // Im Doppel-KO ist `status` nur ein "zuletzt erreichte Runde"-Marker (WB- und
        // LB-Runden laufen parallel, es gibt keine lineare Abfolge) — wird von den
        // Aufrufern (KORoundTab/GrandFinalTab) direkt mit dem Zielstatus gesetzt,
        // diese Funktion muss dafür nur total bleiben.
        return currentStatus;
    }
    if (currentStatus === "group") return koRounds > 0 ? koStatusKey(1) : "finished";
    const match = currentStatus.match(/^ko_(\d+)$/);
    if (match) {
        const current = Number(match[1]);
        return current < koRounds ? koStatusKey(current + 1) : "finished";
    }
    return "finished";
}

// Menschenlesbare Bezeichnung der aktuellen Stufe für einen Status (z.B. für
// Turnierlisten). Deckt dieselben Fälle wie statusToStage ab.
export function statusToStageLabel(status, koRounds, mode = "roundrobin", koFormat = "single") {
    if (status === "setup" && mode !== "directko") return "Nicht gestartet";
    if (status === "setup" && mode === "directko") return koRoundLabel(koRounds, 1);
    if (mode === "directko" && koFormat === "double") {
        if (status === "finished") return "Abgeschlossen";
        if (status === GRAND_FINAL_STATUS) return "Grand Final";
        if (status === GRAND_FINAL_RESET_STATUS) return "Grand Final (Reset)";
        const lbMatch = status.match(/^lko_(\d+)$/);
        if (lbMatch) return loserRoundLabel(koRounds, Number(lbMatch[1]));
        const wbMatch = status.match(/^ko_(\d+)$/);
        if (wbMatch) return koRoundLabel(koRounds, Number(wbMatch[1]));
        return koRoundLabel(koRounds, 1);
    }
    if (status === "group") return "Gruppenphase";
    if (status === "finished") return "Abgeschlossen";
    const match = status?.match(/^ko_(\d+)$/);
    if (match) return koRoundLabel(koRounds, Number(match[1]));
    return "Nicht gestartet";
}

// Stage-String für URL aus Status
export function statusToStage(status, koRounds, mode = "roundrobin", koFormat = "single") {
    if (status === "setup" && mode === "directko") return koStageKey(1);
    if (mode === "directko" && koFormat === "double") {
        if (status === "finished") return "standings";
        if (status === GRAND_FINAL_STATUS) return GRAND_FINAL_STAGE;
        if (status === GRAND_FINAL_RESET_STATUS) return GRAND_FINAL_RESET_STAGE;
        const lbMatch = status.match(/^lko_(\d+)$/);
        if (lbMatch) return loserStageKey(Number(lbMatch[1]));
        const wbMatch = status.match(/^ko_(\d+)$/);
        if (wbMatch) return koStageKey(Number(wbMatch[1]));
        return koStageKey(1);
    }
    if (status === "setup" || status === "group") return "preliminary";
    if (status === "finished") return "standings";
    const match = status.match(/^ko_(\d+)$/);
    if (match) return koStageKey(Number(match[1]));
    return "preliminary";
}

// ─── Tournament ───────────────────────────────────────────────────────────────

export async function addTournament(tournamentName, numberTeams, numberMatchdays, koRounds, hasThirdPlace, pin, preliminaryScoreMode = "points", winLegs = 3, mode = "roundrobin", seeding = "random", groupCount = 1, qualifiersPerGroup = null, koFormat = "single", bracketReset = false) {
    const uid = auth.currentUser?.uid;
    if (!uid) return `${tournamentName}_ERROR`;

    const tournamentRef = doc(db, "tournaments", tournamentName);
    const tournamentSnap = await getDoc(tournamentRef);
    if (tournamentSnap.exists()) return `${tournamentName}_EXISTS`;

    const pinHash = await hashPin(pin, tournamentName);
    // Gruppen (3c) und Direkt-KO (3b) schließen sich gegenseitig aus
    const effectiveGroupCount = mode === "directko" ? 1 : groupCount;

    try {
        await setDoc(tournamentRef, {
            status: "setup",
            teamCount: numberTeams,
            matchdays: mode === "directko" ? 0 : numberMatchdays,
            koRounds,
            hasThirdPlace: koRounds > 0 ? hasThirdPlace : false,
            preliminaryScoreMode,
            winLegs,
            mode,
            groupCount: effectiveGroupCount,
            ...(effectiveGroupCount > 1 ? { qualifiersPerGroup: qualifiersPerGroup ?? Math.pow(2, koRounds) } : {}),
            ...(mode === "directko" ? {
                seeding,
                koFormat,
                ...(koFormat === "double" ? {
                    bracketReset,
                    wbRoundLosers: {},
                    lbRoundWinners: {},
                    wbChampion: null,
                    lbChampion: null
                } : {})
            } : {}),
            createdAt: new Date().toISOString()
        });
        await setDoc(doc(db, "tournaments", tournamentName, "private", "pin"), { hash: pinHash });
        // pinHashAttempt muss dem gerade geschriebenen Hash entsprechen, damit die
        // authorizedEditors-Create-Rule greift (Ersteller kennt den PIN ja bereits).
        await setDoc(doc(db, "tournaments", tournamentName, "authorizedEditors", uid), {
            pinHashAttempt: pinHash,
            grantedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error("addTournament fehlgeschlagen:", err);
        if (err.code === "already-exists") return `${tournamentName}_EXISTS`;
        return `${tournamentName}_ERROR`;
    }
    // Direkt-KO: braucht ein BYE-Team, wenn die Teamanzahl keine Zweierpotenz ist
    // (die "übrigen" Plätze im Bracket bekommen ein Freilos in Runde 1).
    const includeByeTeam = mode === "directko"
        ? Math.pow(2, koRounds) > numberTeams
        : numberTeams % 2 !== 0;
    await createTeams(tournamentRef.id, numberTeams, includeByeTeam);
    return tournamentRef.id;
}

export async function checkIfTournamentExists(tournamentID) {
    const snapshot = await getDocs(
        collection(db, "tournaments", tournamentID, "teams")
    );
    return !snapshot.empty;
}

export async function getAllTournaments() {
    const snapshot = await getDocs(collection(db, "tournaments"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getNumberMatchdays(tournamentID) {
    const tournamentRef = doc(db, "tournaments", tournamentID);
    const tournamentSnap = await getDoc(tournamentRef);
    return Number(tournamentSnap.data().matchdays);
}

export async function getTournamentStatus(tournamentID) {
    const tournamentRef = doc(db, "tournaments", tournamentID);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) return null;
    return tournamentSnap.data().status;
}

export async function getTournamentData(tournamentID) {
    const tournamentRef = doc(db, "tournaments", tournamentID);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) return null;
    return tournamentSnap.data();
}

export async function updateTournamentStatus(tournamentID, newStatus) {
    const tournamentRef = doc(db, "tournaments", tournamentID);
    await updateDoc(tournamentRef, { status: newStatus });
}


export async function deleteTournament(tournamentID) {
    const batch = writeBatch(db);

    const subcollections = ["teams", "matchdays", "knockout", "private", "authorizedEditors"];
    for (const sub of subcollections) {
        const snapshot = await getDocs(
            collection(db, "tournaments", tournamentID, sub)
        );
        snapshot.docs.forEach(d => batch.delete(d.ref));
    }

    batch.delete(doc(db, "tournaments", tournamentID));
    await batch.commit();
}

// ─── Teams ────────────────────────────────────────────────────────────────────

async function createTeams(tournamentID, numberTeams, includeByeTeam) {
    const batch = writeBatch(db);

    for (let i = 1; i <= numberTeams; i++) {
        const id = `A${i}`;
        const ref = doc(db, "tournaments", tournamentID, "teams", id);
        batch.set(ref, {
            name: id,
            wins: 0,
            losses: 0,
            own_score: 0,
            opponent_score: 0,
            preliminaryRank: -1,
            reachedStage: "preliminary",
            finalRank: -1,
            isBye: false,
            group: 0
        });
    }
 
    // BYE-Team, falls benötigt (ungerade Teamanzahl in der Vorrunde, oder
    // Direkt-KO-Bracket, das größer ist als die tatsächliche Teamanzahl)
    if (includeByeTeam) {
        const byeRef = doc(db, "tournaments", tournamentID, "teams", "BYE");
        batch.set(byeRef, {
            name: "BYE",
            wins: 0,
            losses: 0,
            own_score: 0,
            opponent_score: 0,
            preliminaryRank: -1,
            reachedStage: "preliminary",
            finalRank: -1,
            isBye: true
        });
    }
 
    await batch.commit();
}

export async function getAllTeams(tournamentID) {
    const snapshot = await getDocs(collection(db, "tournaments", tournamentID, "teams"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateTeamNames(tournamentID, teamNames) {
    Object.entries(teamNames).forEach(async ([id, name]) => {
        const teamRef = doc(db, "tournaments", tournamentID, "teams", id);
        await updateDoc(teamRef, { name: name ? name : id });
    });
}

// Weist Teams ihrer Vorrunden-Gruppe zu (0-basierter Index, siehe groupLabel).
export async function updateTeamGroups(tournamentID, teamGroups) {
    const batch = writeBatch(db);
    Object.entries(teamGroups).forEach(([id, group]) => {
        batch.update(doc(db, "tournaments", tournamentID, "teams", id), { group });
    });
    await batch.commit();
}

// ─── Matchdays ────────────────────────────────────────────────────────────────

export async function saveSchedule(tournamentID, schedule, scoreMode = "points", winLegs = 3) {
    const fieldPrefix = scoreMode === "legs" ? "legs" : "score";

    for (const [idx, md] of schedule.entries()) {
        const matchday = String(idx + 1);
        const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", matchday);
        const matchdaySnap = await getDoc(matchdayRef);
        if (matchdaySnap.exists()) await deleteDoc(matchdayRef);

        const matchesObject = Object.fromEntries(
            Object.entries(md).map(([i, { team1, team2, group = 0 }]) => {
                const isByeMatch = team1 === "BYE" || team2 === "BYE";
                const realTeam = team1 === "BYE" ? team2 : team1;
                const byeTeam = team1 === "BYE" ? team1 : team2;

                if (isByeMatch) {
                    // Echtes Team gewinnt gegen BYE (Punktemodus: niedriger gewinnt → 0:1,
                    // Legsmodus: höher gewinnt → winLegs:0)
                    return [i, {
                        team1: realTeam,
                        team2: byeTeam,
                        [`${fieldPrefix}_${realTeam}`]: scoreMode === "legs" ? winLegs : 0,
                        [`${fieldPrefix}_${byeTeam}`]: scoreMode === "legs" ? 0 : 1,
                        played: true,
                        isByeMatch: true,
                        group
                    }];
                }

                return [i, {
                    team1,
                    team2,
                    [`${fieldPrefix}_${team1}`]: 0,
                    [`${fieldPrefix}_${team2}`]: 0,
                    played: false,
                    isByeMatch: false,
                    group
                }];
            })
        );

        await setDoc(
            doc(db, "tournaments", tournamentID, "matchdays", matchday),
            { matches: matchesObject }
        );
    }
}

// Rechnet Siege/Niederlagen/Gesamtscores aus den Matches eines Teams neu.
// Punktemodus: niedrigerer Score gewinnt. Legsmodus: höherer Score gewinnt.
// Gemeinsam genutzt von addTeamGame/saveScore.
function computeTeamStats(matches, scoreMode = "points") {
    let wins = 0, losses = 0, ownScore = 0, opponentScore = 0;
    Object.values(matches).forEach(match => {
        ownScore += match.own_score;
        opponentScore += match.opponent_score;
        if (match.own_score === match.opponent_score) return;
        const ownWins = scoreMode === "legs"
            ? match.own_score > match.opponent_score
            : match.own_score < match.opponent_score;
        if (ownWins) wins++;
        else losses++;
    });
    return { wins, losses, own_score: ownScore, opponent_score: opponentScore };
}

// Nur für echte Spiele (kein Freilos) — ein Freilos bekommt bewusst nie einen Eintrag in
// teams/{id}.matches: jedes Team hat in einer ungerade großen Gruppe genau einmal spielfrei,
// das soll in Sieg-/Niederlage-/Score-Statistik komplett unsichtbar bleiben, kein künstlicher
// Sieg für irgendjemanden (siehe Preliminary.js generateSchedule/handleMakeSchedule).
export async function addTeamGame(tournamentID, team1ID, team2ID, matchday, scoreMode = "points", winLegs = 3) {
    const team1Ref = doc(db, "tournaments", tournamentID, "teams", team1ID);
    const team2Ref = doc(db, "tournaments", tournamentID, "teams", team2ID);
    await runTransaction(db, async (transaction) => {
        transaction.set(team1Ref, {
            matches: { [matchday + 1]: { opponent: team2ID, own_score: 0, opponent_score: 0 } },
            wins: 0, losses: 0, own_score: 0, opponent_score: 0
        }, { merge: true });

        transaction.set(team2Ref, {
            matches: { [matchday + 1]: { opponent: team1ID, own_score: 0, opponent_score: 0 } }
        }, { merge: true });
    });
}

export async function getAllMatchdays(tournamentID) {
    const snapshot = await getDocs(collection(db, "tournaments", tournamentID, "matchdays"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getMatchdayMatches(tournamentID, md) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md);
    const matchdaySnap = await getDoc(matchdayRef);
    if (!matchdaySnap.exists()) return [];
    return matchdaySnap.data().matches;
}

export async function saveScore(tournamentID, md, matchKey, team1, newScore, team2, scoreMode = "points", winLegs = 3) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md);
    const team1Ref = doc(db, "tournaments", tournamentID, "teams", team1);
    const team2Ref = doc(db, "tournaments", tournamentID, "teams", team2);
    const fieldPrefix = scoreMode === "legs" ? "legs" : "score";

    await runTransaction(db, async (transaction) => {
        const matchdaySnap = await transaction.get(matchdayRef);
        const team1Snap = await transaction.get(team1Ref);
        const team2Snap = await transaction.get(team2Ref);

        const currentMatch = matchdaySnap.data().matches[`${matchKey}`];
        const oppScore = currentMatch[`${fieldPrefix}_${team2}`];
        // War das Match schon als "gespielt" markiert (z.B. über den "Ergebnis eintragen"-Button),
        // bleibt es das auch bei einem (praktisch unmöglichen) Unentschieden im Legs-Modus —
        // sonst verschwindet das Eingabefeld wieder und der Button taucht erneut auf.
        const played = currentMatch.played || (scoreMode === "legs"
            ? (newScore === winLegs || oppScore === winLegs) && newScore !== oppScore
            : newScore !== null && newScore !== "" && oppScore !== null && oppScore !== "");
        transaction.update(matchdayRef, {
            [`matches.${matchKey}.${fieldPrefix}_${team1}`]: newScore,
            [`matches.${matchKey}.played`]: played
        });

        const team1Matches = { ...team1Snap.data().matches };
        team1Matches[md] = { ...team1Matches[md], own_score: newScore };
        transaction.update(team1Ref, { matches: team1Matches, ...computeTeamStats(team1Matches, scoreMode) });

        const team2Matches = { ...team2Snap.data().matches };
        team2Matches[md] = { ...team2Matches[md], opponent_score: newScore };
        transaction.update(team2Ref, { matches: team2Matches, ...computeTeamStats(team2Matches, scoreMode) });
    });
}

export async function setMatchPlayed(tournamentID, md, matchKey) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md.toString());
    await updateDoc(matchdayRef, { [`matches.${matchKey}.played`]: true });
}

// Best-effort "wird gerade bearbeitet"-Signal, kein Fehlerabbruch bei Race Conditions
// (z.B. Matchday-Dokument existiert kurzzeitig noch nicht) — rein informativ, nicht blockierend.
export async function setMatchdayEditing(tournamentID, md, matchKey, uid) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md.toString());
    await updateDoc(matchdayRef, {
        [`matches.${matchKey}.editingBy`]: uid,
        [`matches.${matchKey}.editingAt`]: serverTimestamp()
    }).catch(() => {});
}

export async function clearMatchdayEditing(tournamentID, md, matchKey) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md.toString());
    await updateDoc(matchdayRef, {
        [`matches.${matchKey}.editingBy`]: null,
        [`matches.${matchKey}.editingAt`]: null
    }).catch(() => {});
}

// ─── Knockout ─────────────────────────────────────────────────────────────────

export async function getKnockout(tournamentID, stage) {
    const ref = doc(db, "tournaments", tournamentID, "knockout", stage);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return [];
    return snapshot.data();
}

export async function saveKOScore(tournamentID, stage, matchKey, team, newScore, opponent, winLegs) {
    const koStageRef = doc(db, "tournaments", tournamentID, "knockout", stage);

    await runTransaction(db, async (transaction) => {
        const koStageSnap = await transaction.get(koStageRef);
        const opp_score = koStageSnap.data().matches[`${matchKey}`][`legs_${opponent}`];

        transaction.update(koStageRef, {
            [`matches.${matchKey}.legs_${team}`]: newScore,
            [`matches.${matchKey}.played`]: (newScore === winLegs || opp_score === winLegs) && newScore !== opp_score
        });
    });
}

export async function updateKOStageWinLegs(tournamentID, stage, winLegs) {
    const koStageRef = doc(db, "tournaments", tournamentID, "knockout", stage);
    await updateDoc(koStageRef, { winLegs });
}

// Markiert eine WB-/LB-/Grand-Final-Runde als abgeschlossen (nur im Doppel-KO für die
// Editierbarkeits-Gate relevant, siehe KORoundTab/GrandFinalTab).
export async function markRoundFinished(tournamentID, stage) {
    const koStageRef = doc(db, "tournaments", tournamentID, "knockout", stage);
    await updateDoc(koStageRef, { roundFinished: true });
}

// Best-effort "wird gerade bearbeitet"-Signal, kein Fehlerabbruch bei Race Conditions
// (z.B. KO-Runden-Dokument existiert kurzzeitig noch nicht) — rein informativ, nicht blockierend.
export async function setKOEditing(tournamentID, stage, matchKey, uid) {
    const koStageRef = doc(db, "tournaments", tournamentID, "knockout", stage);
    await updateDoc(koStageRef, {
        [`matches.${matchKey}.editingBy`]: uid,
        [`matches.${matchKey}.editingAt`]: serverTimestamp()
    }).catch(() => {});
}

export async function clearKOEditing(tournamentID, stage, matchKey) {
    const koStageRef = doc(db, "tournaments", tournamentID, "knockout", stage);
    await updateDoc(koStageRef, {
        [`matches.${matchKey}.editingBy`]: null,
        [`matches.${matchKey}.editingAt`]: null
    }).catch(() => {});
}

export async function updateAllKOsPlayed(tournamentID, stage, winLegs) {
    const koStageRef = doc(db, "tournaments", tournamentID, "knockout", stage);
    const koStageSnap = await getDoc(koStageRef);
    const koStageMatches = koStageSnap.data().matches;

    const updates = {};
    Object.entries(koStageMatches).forEach(([matchKey, m]) => {
        // Freilos-Spiele bleiben unabhängig vom (nachträglich geänderten) winLegs immer gewertet
        if (m.isByeMatch) {
            updates[`matches.${matchKey}.played`] = true;
            return;
        }
        const team1_score = m[`legs_${m.team1}`];
        const team2_score = m[`legs_${m.team2}`];
        updates[`matches.${matchKey}.played`] =
            ((team1_score > team2_score && team1_score === winLegs) ||
             (team2_score > team1_score && team2_score === winLegs)) &&
            team1_score !== team2_score;
    });

    const batch = writeBatch(db);
    batch.update(koStageRef, updates);
    await batch.commit();
}

/**
 * Generische Funktion zum Generieren der nächsten KO-Runde.
 *
 * roundIndex: 1 = erste KO-Runde (z.B. Achtelfinale bei koRounds=4)
 * qualifiedTeams: sortiertes Array von Team-IDs (nach Vorrunden-Rang)
 *                 oder winners-Array aus der vorherigen Runde
 * isFirstRound: true wenn aus der Vorrunde qualifiziert wird
 * koRounds: Gesamtzahl KO-Runden (für Platz-3-Logik)
 * hasThirdPlace: ob Platz-3-Spiel gespielt wird
 * losers: Array von Team-IDs der Verlierer (nur für letzte Runde relevant)
 */
// Kern-Generierung, generisch über einen expliziten Stage-Key (statt ihn intern aus
// einem Runden-Index abzuleiten) — so kann dieselbe Paarungslogik sowohl fürs
// Winner- als auch fürs Loser-Bracket verwendet werden.
async function generateBracketRound(tournamentID, stageKey, qualifiedTeams, { isFinal = false, hasThirdPlace = false, losers = [] } = {}) {
    const matchCount = qualifiedTeams.length / 2;

    const matches = {};

    for (let i = 0; i < matchCount; i++) {
        // Klassische KO-Paarung: 1 vs letzter, 2 vs vorletzter, ...
        const team1 = qualifiedTeams[i];
        const team2 = qualifiedTeams[qualifiedTeams.length - 1 - i];
        const matchKey = `M${i + 1}`;
        matches[matchKey] = {
            team1,
            team2,
            [`legs_${team1}`]: 0,
            [`legs_${team2}`]: 0,
            played: false,
            isByeMatch: false
        };
    }

    // Platz-3-Spiel in der letzten Runde
    if (isFinal && hasThirdPlace && losers.length === 2) {
        matches["place3"] = {
            team1: losers[0],
            team2: losers[1],
            [`legs_${losers[0]}`]: 0,
            [`legs_${losers[1]}`]: 0,
            played: false
        };
    }

    await setDoc(doc(db, "tournaments", tournamentID, "knockout", stageKey), { matches, winLegs: 3, roundFinished: false });
}

export async function generateKORound(tournamentID, roundIndex, qualifiedTeams, koRounds, hasThirdPlace, losers = []) {
    const isFinal = roundIndex === koRounds;
    await generateBracketRound(tournamentID, koStageKey(roundIndex), qualifiedTeams, { isFinal, hasThirdPlace, losers });
}

// Erzeugt eine Loser-Bracket-Runde (nie mit Platz-3-Spiel — 3./4. Platz ergibt sich
// im Doppel-KO automatisch aus der LB-Struktur, siehe assignSharedFinalRanks).
export async function generateLoserBracketRound(tournamentID, lbRoundIndex, orderedTeams) {
    await generateBracketRound(tournamentID, loserStageKey(lbRoundIndex), orderedTeams);
}

/**
 * Orchestriert das Loser-Bracket: liest getLbSchedule(koRounds) sowie die auf dem
 * Turnierdokument gesammelten wbRoundLosers/lbRoundWinners, und generiert genau die
 * nächste LB-Runde, deren Voraussetzungen jetzt vollständig vorliegen. Idempotent
 * (prüft per getKnockout, ob die Zielrunde schon existiert) — sicher aus sowohl dem
 * WB- als auch dem LB-Rundenabschluss-Handler aufrufbar.
 */
export async function advanceLoserBracket(tournamentID, koRounds) {
    const schedule = getLbSchedule(koRounds);
    if (schedule.length === 0) return;
    const data = await getTournamentData(tournamentID);
    let survivors = data.wbRoundLosers?.["1"] ?? null;

    for (let r = 1; r <= schedule.length; r++) {
        const stageKey = loserStageKey(r);
        const existing = await getKnockout(tournamentID, stageKey);
        if (existing.matches) {
            const winners = data.lbRoundWinners?.[String(r)];
            if (!winners) return; // Runde r erzeugt, aber noch nicht abgeschlossen
            survivors = winners;
            continue;
        }
        if (survivors === null) return; // wartet noch auf L_1 (WB-Runde 1 nicht fertig)
        const round = schedule[r - 1];
        let teams = survivors;
        if (round.type === "drop") {
            const newLosers = data.wbRoundLosers?.[String(round.sourceWb)];
            if (!newLosers) return; // wartet noch auf diese WB-Runde
            teams = [...survivors, ...newLosers];
        }
        await generateLoserBracketRound(tournamentID, r, teams);
        return;
    }
}

/**
 * Erzeugt das Grand Final, sobald sowohl WB- als auch LB-Champion feststehen.
 * Idempotent.
 */
export async function generateGrandFinal(tournamentID) {
    const data = await getTournamentData(tournamentID);
    if (!data.wbChampion || !data.lbChampion) return;
    const existing = await getKnockout(tournamentID, GRAND_FINAL_STAGE);
    if (existing.matches) return;
    await generateBracketRound(tournamentID, GRAND_FINAL_STAGE, [data.wbChampion, data.lbChampion]);
    await updateTournamentStatus(tournamentID, GRAND_FINAL_STATUS);
}

// Nur aufgerufen, wenn bracketReset aktiv ist und der LB-Champion das erste Grand-
// Final-Spiel gewinnt (WB-Champion muss dann zum Sieg ein zweites Mal gewinnen).
export async function generateGrandFinalReset(tournamentID, gf1Winner, gf1Loser) {
    await generateBracketRound(tournamentID, GRAND_FINAL_RESET_STAGE, [gf1Winner, gf1Loser]);
    await updateTournamentStatus(tournamentID, GRAND_FINAL_RESET_STATUS);
}

// Vergibt allen `teamIds` gemeinsam einen (nach preliminaryRank gestaffelten) Rang
// ab `baseRank`, geschrieben in `batch` (nicht committet). Geteilte Ausgangslogik
// für Single-Elim-WB-Verlierer und Doppel-Elim-LB-Verlierer.
async function assignSharedFinalRanks(tournamentID, batch, teamIds, baseRank) {
    const teamDocs = await Promise.all(
        teamIds.map(async id => {
            const snap = await getDoc(doc(db, "tournaments", tournamentID, "teams", id));
            return { id, preliminaryRank: snap.data().preliminaryRank };
        })
    );
    teamDocs
        .sort((a, b) => a.preliminaryRank - b.preliminaryRank)
        .forEach((team, i) => {
            batch.update(doc(db, "tournaments", tournamentID, "teams", team.id), {
                finalRank: baseRank + i
            });
        });
}

/**
 * Schließt eine Winner-Bracket-Runde im Doppel-KO-Modus ab. Bei einer normalen
 * Zwischenrunde: wie Single-Elim (nächste WB-Runde generieren), zusätzlich werden
 * die Verlierer als L_roundIndex vermerkt und das Loser-Bracket ggf. weitergeschoben.
 * Beim WB-Finale gibt es keine nächste WB-Runde mehr — der Sieger wird wbChampion,
 * der Verlierer droppt ins Loser-Bracket, und sobald auch der LB-Champion feststeht,
 * wird das Grand Final generiert.
 */
export async function finishDoubleElimWbRound(tournamentID, roundIndex, winners, losers, koRounds) {
    const tournamentRef = doc(db, "tournaments", tournamentID);

    if (roundIndex === koRounds) {
        await updateDoc(tournamentRef, {
            wbChampion: winners[0],
            [`wbRoundLosers.${roundIndex}`]: losers
        });
        await markRoundFinished(tournamentID, koStageKey(roundIndex));
        await advanceLoserBracket(tournamentID, koRounds);
        await generateGrandFinal(tournamentID);
        return;
    }

    await updateDoc(tournamentRef, { [`wbRoundLosers.${roundIndex}`]: losers });
    await markRoundFinished(tournamentID, koStageKey(roundIndex));
    await generateNextKORound(tournamentID, roundIndex, winners, losers, koRounds, false, "double");
    await advanceLoserBracket(tournamentID, koRounds);
}

/**
 * Schließt eine Loser-Bracket-Runde ab: Sieger advancen, Verlierer scheiden endgültig
 * aus und bekommen sofort ihren finalRank (siehe lbEliminationBaseRank). Ist dies die
 * letzte LB-Runde, wird zusätzlich lbChampion gesetzt und das Grand Final generiert
 * (falls der WB-Champion bereits feststeht); andernfalls wird die nächste LB-Runde
 * angestoßen, falls ihre Voraussetzungen bereits vorliegen.
 */
export async function finishLoserBracketRound(tournamentID, roundIndex, winners, losers, koRounds) {
    const schedule = getLbSchedule(koRounds);
    const isLastRound = roundIndex === schedule.length;
    const baseRank = lbEliminationBaseRank(koRounds, roundIndex);

    const batch = writeBatch(db);
    await assignSharedFinalRanks(tournamentID, batch, losers, baseRank);
    winners.forEach(teamId => {
        batch.update(doc(db, "tournaments", tournamentID, "teams", teamId), {
            reachedStage: loserStageKey(roundIndex)
        });
    });
    await batch.commit();
    await markRoundFinished(tournamentID, loserStageKey(roundIndex));

    const tournamentRef = doc(db, "tournaments", tournamentID);
    const updates = { [`lbRoundWinners.${roundIndex}`]: winners };
    if (isLastRound) updates.lbChampion = winners[0];
    await updateDoc(tournamentRef, updates);

    if (isLastRound) {
        await generateGrandFinal(tournamentID);
    } else {
        await advanceLoserBracket(tournamentID, koRounds);
    }
}

export function shuffleArray(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

// Legt einmalig fest, welche Gruppe auf welche KO-Bracket-Position kommt (siehe
// interleaveGroups). Wird bereits bei der Gruppeneinteilung in TeamSetup.js persistiert
// (nicht erst bei der KO-Rundengenerierung), damit die Platzhalter in KORoundTab.js schon
// während der laufenden Vorrunde die tatsächlich gültige Zuordnung anzeigen können.
export async function setKnockoutGroupOrder(tournamentID, groupOrder) {
    const tournamentRef = doc(db, "tournaments", tournamentID);
    await updateDoc(tournamentRef, { koGroupOrder: groupOrder });
}

// Fügt Rang-für-Rang (1. aller Gruppen, dann 2. aller Gruppen, ...) zu einer einzigen
// Liste zusammen, wobei `groupOrder` (ein einmalig zufällig bestimmtes, aber über alle
// Rang-Stufen hinweg IDENTISCH angewendetes Permutations-Array der Gruppen-Indizes)
// bestimmt, welche Gruppe welche Bracket-Position belegt.
//
// Die Reihenfolge *zwischen* den Rang-Stufen (erst alle Rang-1, dann alle Rang-2, ...)
// bleibt dabei erhalten — das ist es, was `generateKORound`s "1 vs letzter Platz"-Paarung
// rekursiv über alle Runden hinweg zur klassischen Turnierbaum-Setzung macht (stärkste
// Teams treffen früh auf die schwächsten, zwei Rang-1-Teams treffen sich erst im Finale).
//
// Dass `groupOrder` für JEDE Rang-Stufe identisch ist (statt pro Stufe neu gemischt),
// ist kein Zufall, sondern die eigentliche Pointe: Runde 1 spiegelt Bracket-Position p
// immer gegen Position (Anzahl Gruppen - 1 - p) derselben oder einer benachbarten
// Rang-Stufe (siehe generateKORound). Bei fester Zuordnung Position→Gruppe sitzt eine
// gegebene Gruppe in JEDER Rang-Stufe an derselben Position p — und da die Gruppenanzahl
// dank der Validierung in NewTournamentSetup.js (Produkt aus Gruppenanzahl und
// Qualifikanten/Gruppe muss eine Zweierpotenz sein) immer eine Zweierpotenz und damit
// gerade ist, gilt p ≠ (Anzahl Gruppen - 1 - p) für jedes p — eine Gruppe kann sich in
// Runde 1 also nie selbst begegnen. Bei einer pro Stufe *neu* gemischten Reihenfolge wäre
// das nicht garantiert (Position p könnte in Stufe A zu Gruppe X, in der gespiegelten
// Stufe B zufällig ebenfalls zu Gruppe X gehören).
function interleaveGroups(groupedArrays, groupOrder) {
    const order = groupOrder && groupOrder.length === groupedArrays.length
        ? groupOrder
        : groupedArrays.map((_, i) => i);
    const result = [];
    const maxLen = Math.max(0, ...groupedArrays.map(g => g.length));
    for (let i = 0; i < maxLen; i++) {
        order.forEach(g => { if (groupedArrays[g][i]) result.push(groupedArrays[g][i]); });
    }
    return result;
}

/**
 * Erste KO-Runde aus Vorrunden-Ergebnissen generieren.
 * Ohne Gruppen (groupCount=1): qualifiziert werden die besten 2^koRounds Teams.
 * Mit Gruppen: pro Gruppe qualifizieren sich die besten `qualifiersPerGroup` Teams,
 * die Setzliste wird anschließend rangweise über die Gruppen hinweg interleaved
 * (siehe interleaveGroups für die Details zur Setzung und Gruppen-Kollisionsvermeidung).
 * `groupOrder` sollte die per `setKnockoutGroupOrder` gespeicherte Reihenfolge sein.
 */
export async function generateFirstKORound(tournamentID, koRounds, scoreMode = "points", groupCount = 1, qualifiersPerGroup = null, groupOrder = null) {
    const teamsSnap = await getDocs(collection(db, "tournaments", tournamentID, "teams"));
    const teams = teamsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => !t.isBye); // BYE nie qualifizieren

    const sortByRank = (a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (scoreMode === "legs") {
            if (b.own_score !== a.own_score) return b.own_score - a.own_score;
            return a.opponent_score - b.opponent_score;
        }
        if (b.own_score !== a.own_score) return a.own_score - b.own_score;
        return b.opponent_score - a.opponent_score;
    };

    const effectiveQualifiersPerGroup = groupCount > 1
        ? (qualifiersPerGroup ?? Math.pow(2, koRounds))
        : Math.pow(2, koRounds);

    const groups = Array.from({ length: groupCount }, (_, g) =>
        teams.filter(t => (t.group ?? 0) === g).sort(sortByRank)
    );

    const qualified = interleaveGroups(groups.map(g => g.slice(0, effectiveQualifiersPerGroup)), groupOrder);
    const eliminated = interleaveGroups(groups.map(g => g.slice(effectiveQualifiersPerGroup)), groupOrder);

    const batch = writeBatch(db);
    qualified.forEach((team, index) => {
        batch.update(doc(db, "tournaments", tournamentID, "teams", team.id), {
            preliminaryRank: index + 1,
            finalRank: -1,
            reachedStage: koStageKey(1)
        });
    });
    eliminated.forEach((team, index) => {
        const rank = qualified.length + index + 1;
        batch.update(doc(db, "tournaments", tournamentID, "teams", team.id), {
            preliminaryRank: rank,
            finalRank: rank,
            reachedStage: "preliminary"
        });
    });
    await batch.commit();

    await generateKORound(
        tournamentID, 1, qualified.map(t => t.id), koRounds, false
    );
}

// Setzt Freilos-Spiele (team1/team2 === "BYE") einer KO-Runde auf "gespielt" mit
// automatischem Sieg des echten Teams — unabhängig vom aktuell eingestellten winLegs.
async function resolveByeMatches(tournamentID, stageKey) {
    const stageRef = doc(db, "tournaments", tournamentID, "knockout", stageKey);
    const stageSnap = await getDoc(stageRef);
    const matches = stageSnap.data().matches;

    const updates = {};
    Object.entries(matches).forEach(([matchKey, m]) => {
        if (m.team1 !== "BYE" && m.team2 !== "BYE") return;
        const realTeam = m.team1 === "BYE" ? m.team2 : m.team1;
        const byeTeam = m.team1 === "BYE" ? m.team1 : m.team2;
        updates[`matches.${matchKey}.legs_${realTeam}`] = 1;
        updates[`matches.${matchKey}.legs_${byeTeam}`] = 0;
        updates[`matches.${matchKey}.played`] = true;
        updates[`matches.${matchKey}.isByeMatch`] = true;
    });

    if (Object.keys(updates).length > 0) {
        await updateDoc(stageRef, updates);
    }
}

/**
 * Erste KO-Runde direkt aus einer Setzliste generieren (Direkt-KO-Modus ohne Vorrunde).
 * seededTeamIds: Team-IDs in Setzreihenfolge. Ist die Teamanzahl keine Zweierpotenz,
 * bekommen die bestplatzierten Teams ein Freilos gegen das "BYE"-Pseudo-Team,
 * damit die Bracketgröße (2^koRounds) aufgeht.
 */
export async function generateFirstKORoundFromSeed(tournamentID, seededTeamIds, koRounds, hasThirdPlace) {
    const bracketSize = Math.pow(2, koRounds);
    const byeCount = bracketSize - seededTeamIds.length;
    const paddedTeams = byeCount > 0
        ? [...seededTeamIds, ...Array(byeCount).fill("BYE")]
        : seededTeamIds;

    const batch = writeBatch(db);
    seededTeamIds.forEach((teamId, index) => {
        batch.update(doc(db, "tournaments", tournamentID, "teams", teamId), {
            preliminaryRank: index + 1,
            finalRank: -1,
            reachedStage: koStageKey(1)
        });
    });
    await batch.commit();

    await generateKORound(tournamentID, 1, paddedTeams, koRounds, hasThirdPlace);

    if (byeCount > 0) {
        await resolveByeMatches(tournamentID, koStageKey(1));
    }
}

/**
 * Nächste KO-Runde aus Gewinnern der aktuellen Runde generieren.
 * winners und losers: Arrays von Team-IDs
 */
export async function generateNextKORound(tournamentID, currentRoundIndex, winners, losers, koRounds, hasThirdPlace, koFormat = "single") {
    const nextRoundIndex = currentRoundIndex + 1;
    const isFinal = nextRoundIndex === koRounds;

    if (koFormat === "double" && currentRoundIndex === koRounds) {
        // WB-Finale im Doppel-KO: es gibt keine "nächste WB-Runde" mehr — wird
        // komplett vom Aufrufer (KORoundTab) über wbChampion/advanceLoserBracket/
        // generateGrandFinal behandelt, diese Funktion wird dafür nicht genutzt.
        return;
    }

    // reachedStage der Gewinner aktualisieren
    const batch = writeBatch(db);
    winners.forEach(teamId => {
        batch.update(doc(db, "tournaments", tournamentID, "teams", teamId), {
            reachedStage: koStageKey(nextRoundIndex)
        });
    });

    // finalRank der Verlierer setzen (nach Vorrunden-Rang sortiert) — im Doppel-KO
    // ist ein WB-Rundenverlierer noch nicht ausgeschieden (spielt im Loser-Bracket
    // weiter), daher wird hier gar kein finalRank vergeben.
    if (koFormat !== "double") {
        if (!isFinal) {
            await assignSharedFinalRanks(tournamentID, batch, losers, winners.length + 1);
        } else if (!hasThirdPlace && losers.length > 0) {
            // Ohne Spiel um Platz 3: beide Halbfinal-Verlierer teilen sich Platz 3
            losers.forEach(id => {
                batch.update(doc(db, "tournaments", tournamentID, "teams", id), {
                    finalRank: 3
                });
            });
        }
    }

    await batch.commit();

    await generateKORound(
        tournamentID,
        nextRoundIndex,
        winners,
        koRounds,
        hasThirdPlace,
        isFinal ? losers : []
    );
}

/**
 * Abschluss-Rankings nach dem Finale setzen.
 */
export async function updateRankingFinals(tournamentID, hasThirdPlace) {
    const finalSnap = await getDoc(
        doc(db, "tournaments", tournamentID, "knockout", koStageKey(
            (await getTournamentData(tournamentID)).koRounds
        ))
    );
    const matches = finalSnap.data().matches;
    const final = matches["M1"];

    const finalWinner = final[`legs_${final.team1}`] > final[`legs_${final.team2}`] ? final.team1 : final.team2;
    const finalLoser  = final[`legs_${final.team1}`] < final[`legs_${final.team2}`] ? final.team1 : final.team2;

    const batch = writeBatch(db);
    batch.update(doc(db, "tournaments", tournamentID, "teams", finalWinner), { finalRank: 1, reachedStage: "final" });
    batch.update(doc(db, "tournaments", tournamentID, "teams", finalLoser),  { finalRank: 2, reachedStage: "final" });

    if (hasThirdPlace && matches["place3"]) {
        const p3 = matches["place3"];
        const p3Winner = p3[`legs_${p3.team1}`] > p3[`legs_${p3.team2}`] ? p3.team1 : p3.team2;
        const p3Loser  = p3[`legs_${p3.team1}`] < p3[`legs_${p3.team2}`] ? p3.team1 : p3.team2;
        batch.update(doc(db, "tournaments", tournamentID, "teams", p3Winner), { finalRank: 3, reachedStage: "final" });
        batch.update(doc(db, "tournaments", tournamentID, "teams", p3Loser),  { finalRank: 4, reachedStage: "final" });
    }

    await batch.commit();
}

/**
 * Abschluss-Ranking für Doppel-KO-Turniere: Rang 1/2 kommen aus dem entscheidenden
 * Grand-Final-Spiel (grandfinal2 statt grandfinal, falls ein Bracket Reset
 * stattgefunden hat — auch wenn der WB-Champion Spiel 1 gewonnen hatte, ist dann
 * Spiel 2 entscheidend). Alle anderen Ränge (inkl. Rang 3, geteilt oder nicht)
 * wurden bereits beim jeweiligen Loser-Bracket-Rundenabschluss per
 * assignSharedFinalRanks vergeben.
 */
export async function updateRankingDoubleElim(tournamentID) {
    const resetSnap = await getKnockout(tournamentID, GRAND_FINAL_RESET_STAGE);
    const decisiveStage = resetSnap.matches ? GRAND_FINAL_RESET_STAGE : GRAND_FINAL_STAGE;
    const decisiveSnap = await getKnockout(tournamentID, decisiveStage);
    const final = decisiveSnap.matches["M1"];

    const finalWinner = final[`legs_${final.team1}`] > final[`legs_${final.team2}`] ? final.team1 : final.team2;
    const finalLoser  = final[`legs_${final.team1}`] < final[`legs_${final.team2}`] ? final.team1 : final.team2;

    const batch = writeBatch(db);
    batch.update(doc(db, "tournaments", tournamentID, "teams", finalWinner), { finalRank: 1, reachedStage: "final" });
    batch.update(doc(db, "tournaments", tournamentID, "teams", finalLoser),  { finalRank: 2, reachedStage: "final" });
    await batch.commit();
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function subscribeTeams(tournamentID, callback) {
    const teamsRef = collection(db, "tournaments", tournamentID, "teams");
    return onSnapshot(teamsRef, snapshot => {
        callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

export function subscribeMatchday(tournamentID, md, callback) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md);
    return onSnapshot(matchdayRef, snap => {
        if (!snap.exists()) { callback({}); return; }
        callback(snap.data().matches || {});
    });
}

export function subscribeAllMatchdays(tournamentID, callback) {
    const matchdaysRef = collection(db, "tournaments", tournamentID, "matchdays");
    return onSnapshot(matchdaysRef, snapshot => {
        callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

export function subscribeTournamentStatus(tournamentID, callback) {
    const tournamentRef = doc(db, "tournaments", tournamentID);
    return onSnapshot(tournamentRef, snap => {
        if (!snap.exists()) return;
        callback(snap.data().status);
    });
}


export function subscribeKnockoutRound(tournamentID, stage, callback) {
    const koStageRef = doc(db, "tournaments", tournamentID, "knockout", stage);
    return onSnapshot(koStageRef, snap => {
        if (!snap.exists()) { callback({ matches: {} }); return; }
        callback(snap.data());
    });
}
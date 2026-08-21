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

// Nächster Status nach dem aktuellen
export function nextStatus(currentStatus, koRounds) {
    if (currentStatus === "group") return koRounds > 0 ? koStatusKey(1) : "finished";
    const match = currentStatus.match(/^ko_(\d+)$/);
    if (match) {
        const current = Number(match[1]);
        return current < koRounds ? koStatusKey(current + 1) : "finished";
    }
    return "finished";
}

// Stage-String für URL aus Status
export function statusToStage(status, koRounds) {
    if (status === "setup" || status === "group") return "preliminary";
    if (status === "finished") return "standings";
    const match = status.match(/^ko_(\d+)$/);
    if (match) return koStageKey(Number(match[1]));
    return "preliminary";
}

// ─── Tournament ───────────────────────────────────────────────────────────────

export async function addTournament(tournamentName, numberTeams, numberMatchdays, koRounds, hasThirdPlace, pin, preliminaryScoreMode = "points", winLegs = 3) {
    const uid = auth.currentUser?.uid;
    if (!uid) return `${tournamentName}_ERROR`;

    const tournamentRef = doc(db, "tournaments", tournamentName);
    const tournamentSnap = await getDoc(tournamentRef);
    if (tournamentSnap.exists()) return `${tournamentName}_EXISTS`;

    const pinHash = await hashPin(pin, tournamentName);

    try {
        await setDoc(tournamentRef, {
            status: "setup",
            teamCount: numberTeams,
            matchdays: numberMatchdays,
            koRounds,
            hasThirdPlace: koRounds > 0 ? hasThirdPlace : false,
            preliminaryScoreMode,
            winLegs,
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
    await createTeams(tournamentRef.id, numberTeams);
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

async function createTeams(tournamentID, numberTeams) {
    const batch = writeBatch(db);
    const totalTeams = numberTeams % 2 !== 0 ? numberTeams + 1 : numberTeams;
 
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
            isBye: false
        });
    }
 
    // BYE-Team bei ungerader Anzahl
    if (numberTeams % 2 !== 0) {
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

// ─── Matchdays ────────────────────────────────────────────────────────────────

export async function saveSchedule(tournamentID, schedule, scoreMode = "points", winLegs = 3) {
    const fieldPrefix = scoreMode === "legs" ? "legs" : "score";

    for (const [idx, md] of schedule.entries()) {
        const matchday = String(idx + 1);
        const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", matchday);
        const matchdaySnap = await getDoc(matchdayRef);
        if (matchdaySnap.exists()) await deleteDoc(matchdayRef);

        const matchesObject = Object.fromEntries(
            Object.entries(md).map(([i, { team1, team2 }]) => {
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
                        isByeMatch: true
                    }];
                }

                return [i, {
                    team1,
                    team2,
                    [`${fieldPrefix}_${team1}`]: 0,
                    [`${fieldPrefix}_${team2}`]: 0,
                    played: false,
                    isByeMatch: false
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

export async function addTeamGame(tournamentID, team1ID, team2ID, matchday, scoreMode = "points", winLegs = 3) {
    const isByeMatch = team1ID === "BYE" || team2ID === "BYE";
    const realTeam = team1ID === "BYE" ? team2ID : team1ID;
    const byeTeam = team1ID === "BYE" ? team1ID : team2ID;

    if (isByeMatch) {
        // Echtes Team bekommt Sieg (Punktemodus: 0:1, niedriger gewinnt. Legsmodus: winLegs:0, höher gewinnt)
        const realTeamRef = doc(db, "tournaments", tournamentID, "teams", realTeam);
        await runTransaction(db, async (transaction) => {
            const realTeamSnap = await transaction.get(realTeamRef);
            const matches = { ...realTeamSnap.data().matches };
            matches[matchday + 1] = {
                opponent: byeTeam,
                own_score: scoreMode === "legs" ? winLegs : 0,
                opponent_score: scoreMode === "legs" ? 0 : 1
            };
            transaction.update(realTeamRef, { matches, ...computeTeamStats(matches, scoreMode) });
        });
        // BYE-Team wird nicht aktualisiert
        return;
    }

    // Normales Spiel — unverändert
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
export async function generateKORound(tournamentID, roundIndex, qualifiedTeams, koRounds, hasThirdPlace, losers = []) {
    const isFinal = roundIndex === koRounds;
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
            played: false
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

    const stageKey = koStageKey(roundIndex);
    await setDoc(doc(db, "tournaments", tournamentID, "knockout", stageKey), { matches, winLegs: 3 });
}

/**
 * Erste KO-Runde aus Vorrunden-Ergebnissen generieren.
 * Qualifiziert werden die besten 2^koRounds Teams.
 */
export async function generateFirstKORound(tournamentID, koRounds, scoreMode = "points") {
    const teamsSnap = await getDocs(collection(db, "tournaments", tournamentID, "teams"));
    const teams = teamsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => !t.isBye); // BYE nie qualifizieren

    teams.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (scoreMode === "legs") {
            if (b.own_score !== a.own_score) return b.own_score - a.own_score;
            return a.opponent_score - b.opponent_score;
        }
        if (b.own_score !== a.own_score) return a.own_score - b.own_score;
        return b.opponent_score - a.opponent_score;
    });
 
    const qualifiedCount = Math.pow(2, koRounds);
    const qualified = teams.slice(0, qualifiedCount);
 
    const batch = writeBatch(db);
    teams.forEach((team, index) => {
        const isQualified = index < qualifiedCount;
        batch.update(doc(db, "tournaments", tournamentID, "teams", team.id), {
            preliminaryRank: index + 1,
            finalRank: isQualified ? -1 : index + 1,
            reachedStage: isQualified ? koStageKey(1) : "preliminary"
        });
    });
    await batch.commit();
 
    await generateKORound(
        tournamentID, 1, qualified.map(t => t.id), koRounds, false
    );
}

/**
 * Nächste KO-Runde aus Gewinnern der aktuellen Runde generieren.
 * winners und losers: Arrays von Team-IDs
 */
export async function generateNextKORound(tournamentID, currentRoundIndex, winners, losers, koRounds, hasThirdPlace) {
    const nextRoundIndex = currentRoundIndex + 1;
    const isFinal = nextRoundIndex === koRounds;

    // reachedStage der Gewinner aktualisieren
    const batch = writeBatch(db);
    winners.forEach(teamId => {
        batch.update(doc(db, "tournaments", tournamentID, "teams", teamId), {
            reachedStage: koStageKey(nextRoundIndex)
        });
    });

    // finalRank der Verlierer setzen (nach Vorrunden-Rang sortiert)
    if (!isFinal) {
        const loserDocs = await Promise.all(
            losers.map(async id => {
                const snap = await getDoc(doc(db, "tournaments", tournamentID, "teams", id));
                return { id, preliminaryRank: snap.data().preliminaryRank };
            })
        );
        const baseRank = winners.length * 2 + 1; // z.B. bei 4 Gewinnern → Rang 5
        loserDocs
            .sort((a, b) => a.preliminaryRank - b.preliminaryRank)
            .forEach((team, i) => {
                batch.update(doc(db, "tournaments", tournamentID, "teams", team.id), {
                    finalRank: baseRank + i
                });
            });
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
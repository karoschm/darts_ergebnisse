import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, writeBatch, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// ─── PIN Utilities ────────────────────────────────────────────────────────────

export async function hashPin(pin, tournamentId) {
    const msgBuffer = new TextEncoder().encode(pin + tournamentId);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function verifyPin(tournamentId, pin) {
    const tournamentRef = doc(db, "tournaments", tournamentId);
    const snap = await getDoc(tournamentRef);
    if (!snap.exists()) return false;
    const stored = snap.data().pinHash;
    const entered = await hashPin(pin, tournamentId);
    return stored === entered;
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

export async function addTournament(tournamentName, numberTeams, numberMatchdays, koRounds, hasThirdPlace, pin) {
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
            createdAt: new Date().toISOString(),
            pinHash
        });
    } catch (err) {
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

    const subcollections = ["teams", "matchdays", "knockout"];
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

export async function saveSchedule(tournamentID, schedule) {
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
                    // Echtes Team gewinnt 0:1 gegen BYE
                    return [i, {
                        team1: realTeam,
                        team2: byeTeam,
                        [`score_${realTeam}`]: 0,
                        [`score_${byeTeam}`]: 1,
                        played: true,
                        isByeMatch: true
                    }];
                }
 
                return [i, {
                    team1,
                    team2,
                    [`score_${team1}`]: 0,
                    [`score_${team2}`]: 0,
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

export async function addTeamGame(tournamentID, team1ID, team2ID, matchday) {
    const isByeMatch = team1ID === "BYE" || team2ID === "BYE";
    const realTeam = team1ID === "BYE" ? team2ID : team1ID;
    const byeTeam = team1ID === "BYE" ? team1ID : team2ID;
 
    if (isByeMatch) {
        // Echtes Team bekommt Sieg (own_score 0, opponent_score 1 → niedrigerer Score gewinnt)
        const realTeamRef = doc(db, "tournaments", tournamentID, "teams", realTeam);
        const realTeamSnap = await getDoc(realTeamRef);
        const data = realTeamSnap.data();
        const matches = { ...data.matches };
        matches[matchday + 1] = { opponent: byeTeam, own_score: 0, opponent_score: 1 };
 
        // Siege/Niederlagen/Scores neu berechnen
        let wins = 0, losses = 0, ownScore = 0, opponentScore = 0;
        Object.values(matches).forEach(match => {
            ownScore += match.own_score;
            opponentScore += match.opponent_score;
            if (match.own_score < match.opponent_score) wins++;
            else if (match.own_score > match.opponent_score) losses++;
        });
 
        await updateDoc(realTeamRef, { matches, wins, losses, own_score: ownScore, opponent_score: opponentScore });
        // BYE-Team wird nicht aktualisiert
        return;
    }
 
    // Normales Spiel — unverändert
    const team1Ref = doc(db, "tournaments", tournamentID, "teams", team1ID);
    await setDoc(team1Ref, {
        matches: { [matchday + 1]: { opponent: team2ID, own_score: 0, opponent_score: 0 } },
        wins: 0, losses: 0, own_score: 0, opponent_score: 0
    }, { merge: true });
 
    const team2Ref = doc(db, "tournaments", tournamentID, "teams", team2ID);
    await setDoc(team2Ref, {
        matches: { [matchday + 1]: { opponent: team1ID, own_score: 0, opponent_score: 0 } }
    }, { merge: true });
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

export async function saveScore(tournamentID, md, matchKey, team1, newScore, team2) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md);
    const matchdaySnap = await getDoc(matchdayRef);
    const oppScore = matchdaySnap.data().matches[`${matchKey}`][`score_${team2}`];
    await updateDoc(matchdayRef, {
        [`matches.${matchKey}.score_${team1}`]: newScore,
        [`matches.${matchKey}.played`]: newScore !== null && newScore !== "" && oppScore !== null && oppScore !== ""
    });

    const team1Ref = doc(db, "tournaments", tournamentID, "teams", team1);
    const team1Snap = await getDoc(team1Ref);
    const team1Matches = { ...team1Snap.data().matches };
    team1Matches[md] = { ...team1Matches[md], own_score: newScore };

    let wins = 0, losses = 0, ownScore = 0, opponentScore = 0;
    Object.values(team1Matches).forEach(match => {
        ownScore += match.own_score;
        opponentScore += match.opponent_score;
        if (match.own_score < match.opponent_score) wins++;
        else if (match.own_score > match.opponent_score) losses++;
    });
    await updateDoc(team1Ref, { matches: team1Matches, wins, losses, own_score: ownScore, opponent_score: opponentScore });

    const team2Ref = doc(db, "tournaments", tournamentID, "teams", team2);
    const team2Snap = await getDoc(team2Ref);
    const team2Matches = { ...team2Snap.data().matches };
    team2Matches[md] = { ...team2Matches[md], opponent_score: newScore };

    wins = 0; losses = 0; ownScore = 0; opponentScore = 0;
    Object.values(team2Matches).forEach(match => {
        ownScore += match.own_score;
        opponentScore += match.opponent_score;
        if (match.own_score < match.opponent_score) wins++;
        else if (match.own_score > match.opponent_score) losses++;
    });
    await updateDoc(team2Ref, { matches: team2Matches, wins, losses, own_score: ownScore, opponent_score: opponentScore });
}

export async function setMatchPlayed(tournamentID, md, matchKey) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md.toString());
    await updateDoc(matchdayRef, { [`matches.${matchKey}.played`]: true });
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
    const koStageSnap = await getDoc(koStageRef);
    const opp_score = koStageSnap.data().matches[`${matchKey}`][`legs_${opponent}`];

    await updateDoc(koStageRef, {
        [`matches.${matchKey}.legs_${team}`]: newScore,
        [`matches.${matchKey}.played`]: (newScore === winLegs || opp_score === winLegs) && newScore !== opp_score
    });
}

export async function updateAllKOsPlayed(tournamentID, stage, winLegs) {
    const koStageRef = doc(db, "tournaments", tournamentID, "knockout", stage);
    const koStageSnap = await getDoc(koStageRef);
    const koStageMatches = koStageSnap.data().matches;

    Object.entries(koStageMatches).forEach(([matchKey, m]) => {
        const team1_score = m[`legs_${m.team1}`];
        const team2_score = m[`legs_${m.team2}`];
        updateDoc(koStageRef, {
            [`matches.${matchKey}.played`]:
                ((team1_score > team2_score && team1_score === winLegs) ||
                 (team2_score > team1_score && team2_score === winLegs)) &&
                team1_score !== team2_score
        });
    });
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
    await setDoc(doc(db, "tournaments", tournamentID, "knockout", stageKey), { matches });
}

/**
 * Erste KO-Runde aus Vorrunden-Ergebnissen generieren.
 * Qualifiziert werden die besten 2^koRounds Teams.
 */
export async function generateFirstKORound(tournamentID, koRounds) {
    const teamsSnap = await getDocs(collection(db, "tournaments", tournamentID, "teams"));
    const teams = teamsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => !t.isBye); // BYE nie qualifizieren
 
    teams.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
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
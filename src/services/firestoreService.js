import { collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, writeBatch, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export async function addTournament(tournamentName, numberTeams, numberMatchdays) {
    let tournamentRef = doc(db, "tournaments", tournamentName);
    const tournamentSnap = await getDoc(tournamentRef);
    if (tournamentSnap.exists()) return `${tournamentName}_EXISTS`;

    try {
        await setDoc(tournamentRef, {
            status: "setup",
            teamCount: numberTeams,
            matchdays: numberMatchdays,
            createdAt: new Date().toISOString()
        });
    console.log(tournamentRef);
    } catch (err) {
        if (err.code === "already-exists") return `${tournamentName}_EXISTS`;
        return `${tournamentName}_ERROR`;
    }
    await createTeams(tournamentRef.id, numberTeams);
    return tournamentRef.id;
}

export async function getNumberMatchdays(tournamentID) {
    const tournamentRef = doc(db, "tournaments", tournamentID);
    const tournamentSnap = await getDoc(tournamentRef);

    return Number(tournamentSnap.data().matchdays);
}

export async function updateTournamentStatus(tournamentID, newStatus) {
    const tournamentRef = doc(db, "tournaments", tournamentID);
    await updateDoc(tournamentRef, { status: newStatus });
}

async function createTeams(tournamentID, numberTeams) {
    const batch = writeBatch(db);

    for (let i = 1; i <= numberTeams; i++) {
        const id = `A${i}`;
        const ref = doc(db, "tournaments", tournamentID, "teams", id);

        batch.set(ref, {
            name: "",
            wins: 0,
            losses: 0,
            own_score: 0,
            opponent_score: 0,
            preliminaryRank: -1,
            reachedStage: "preliminary",
            finalRank: -1
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
        await updateDoc(teamRef, { name: name });
    })
}

export async function saveSchedule(tournamentID, schedule) {
    schedule.map(async (md, idx) => {
        const matchday = String(idx + 1);
        const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", matchday);
        const matchdaySnap = await getDoc(matchdayRef);

        if (matchdaySnap.exists()) {
            deleteDoc(matchdayRef);
        }

        const matchesObject = Object.fromEntries(Object.entries(md).map(([i, { team1, team2 }]) => [
            i,
            { team1: team1, team2: team2, [`score_${team1}`]: 0, [`score_${team2}`]: 0, played: false }
        ]));

        await setDoc(doc(db, "tournaments", tournamentID, "matchdays", matchday), { matches: matchesObject });
    });
}

export async function addTeamGame(tournamentID, team1ID, team2ID, matchday) {
    const team1Ref = doc(db, "tournaments", tournamentID, "teams", team1ID);
    await setDoc(team1Ref, {
        matches: {
            [matchday + 1]: { opponent: team2ID, own_score: 0, opponent_score: 0 }
        },
        wins: 0,
        losses: 0,
        own_score: 0,
        opponent_score: 0
    }, { merge: true });

    const team2Ref = doc(db, "tournaments", tournamentID, "teams", team2ID);
    await setDoc(team2Ref, { matches: { [matchday + 1]: { opponent: team1ID, own_score: 0, opponent_score: 0 } } }, { merge: true });
}

export async function getMatchdayMatches(tournamentID, md) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md);
    const matchdaySnap = await getDoc(matchdayRef);

    if (!matchdaySnap.exists()) return [];

    const data = matchdaySnap.data().matches;

    return data;
}

export async function saveScore(tournamentID, md, matchKey, team1, newScore, team2) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md);
    await updateDoc(matchdayRef, {
        [`matches.${matchKey}.score_${team1}`]: newScore
    });

    const team1Ref = doc(db, "tournaments", tournamentID, "teams", team1);
    const team1Snap = await getDoc(team1Ref);
    const team1Data = team1Snap.data();
    const team1Matches = { ...team1Data.matches };

    team1Matches[md] = { ...team1Matches[md], own_score: newScore };

    let wins = 0, losses = 0, ownScore = 0, opponentScore = 0;
    Object.values(team1Matches).forEach(match => {
        ownScore += match.own_score;
        opponentScore += match.opponent_score;
        if (match.own_score < match.opponent_score) wins++;
        else if (match.own_score > match.opponent_score) losses++;
        // Unentschieden zählen wir ggf. nicht als win/loss
    });

    await updateDoc(team1Ref, {
        matches: team1Matches,
        wins,
        losses,
        own_score: ownScore,
        opponent_score: opponentScore
    });

    const team2Ref = doc(db, "tournaments", tournamentID, "teams", team2);
    const team2Snap = await getDoc(team2Ref);
    const team2Data = team2Snap.data();
    const team2Matches = { ...team2Data.matches };

    team2Matches[md] = { ...team2Matches[md], opponent_score: newScore };

    wins = 0;
    losses = 0;
    ownScore = 0;
    opponentScore = 0;
    Object.values(team2Matches).forEach(match => {
        ownScore += match.own_score;
        opponentScore += match.opponent_score;
        if (match.own_score < match.opponent_score) wins++;
        else if (match.own_score > match.opponent_score) losses++;
        // Unentschieden zählen wir ggf. nicht als win/loss
    });

    await updateDoc(team2Ref, {
        matches: team2Matches,
        wins,
        losses,
        own_score: ownScore,
        opponent_score: opponentScore
    });
}

export async function saveKOScore(tournamentID, stage, matchKey, team, newScore, opponent, winLegs) {
    const koStageRef = doc(db, "tournaments", tournamentID, "knockout", stage);
    const koStageSnap = await getDoc(koStageRef);
    const opp_score = koStageSnap.data().matches[`${matchKey}`][`legs_${opponent}`]

    await updateDoc(koStageRef, {
        [`matches.${matchKey}.legs_${team}`]: newScore,
        [`matches.${matchKey}.played`]: (newScore === winLegs || opp_score === winLegs) && newScore !== opp_score
    });
}

export async function updateAllKOsPlayed(tournamentID, stage, winLegs) {
    const koStageRef = doc(db, "tournaments", tournamentID, "knockout", stage);
    const koStageSnap = await getDoc(koStageRef);
    const koStageMatches = koStageSnap.data().matches;
    Object.entries(koStageMatches).map(([matchKey, m]) => {
        const team1 = m.team1;
        const team2 = m.team2
        const team1_score = m[`legs_${team1}`];
        const team2_score = m[`legs_${team2}`];

        updateDoc(koStageRef, {
            [`matches.${matchKey}.played`]: ((team1_score > team2_score && team1_score === winLegs)
                || (team2_score > team1_score && team2_score === winLegs))
                && team1_score !== team2_score
        })
    })
}

export async function setMatchPlayed(tournamentID, md, matchKey) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md.toString());
    await updateDoc(matchdayRef, {
        [`matches.${matchKey}.played`]: true
    });
}

export async function generateQuarterfinals(tournamentID) {
    const teamsSnap = await getDocs(
        collection(db, "tournaments", tournamentID, "teams")
    );

    const teams = teamsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Sortierung exakt wie Tabelle
    teams.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.own_score !== a.own_score) return a.own_score - b.own_score;
        return b.opponent_score - a.opponent_score;
    });

    const qualified = teams.slice(0, 8);

    const matches = {
        QF1: {
            team1: qualified[0].id, team2: qualified[7].id,
            [`legs_${qualified[0].id}`]: 0, [`legs_${qualified[7].id}`]: 0, played: false
        },
        QF2: {
            team1: qualified[1].id, team2: qualified[6].id,
            [`legs_${qualified[1].id}`]: 0, [`legs_${qualified[6].id}`]: 0, played: false
        },
        QF3: {
            team1: qualified[2].id, team2: qualified[5].id,
            [`legs_${qualified[2].id}`]: 0, [`legs_${qualified[5].id}`]: 0, played: false
        },
        QF4: {
            team1: qualified[3].id, team2: qualified[4].id,
            [`legs_${qualified[3].id}`]: 0, [`legs_${qualified[4].id}`]: 0, played: false
        }
    };

    await setDoc(
        doc(db, "tournaments", tournamentID, "knockout", "quarterfinals"),
        { matches }
    );

    teams.map(async (team, index) => {
        const finalRank = index <= 7 ? -1 : index + 1;
        const reachedStage = index <= 7 ? "quarterfinal" : "preliminary"
        await updateDoc(
            doc(db, "tournaments", tournamentID, "teams", team.id),
            { preliminaryRank: index + 1, finalRank: finalRank, reachedStage: reachedStage }
        );
    });
}

export async function generateSemifinals(tournamentID, qfWinners, qfLosers) {
    if (qfWinners.length !== 4) throw new Error("Es müssen 4 Teams für das Halbfinale sein");

    const matches = {
        SF1: { team1: qfWinners[0], team2: qfWinners[3], [`legs_${qfWinners[0]}`]: 0, [`legs_${qfWinners[3]}`]: 0, played: false },
        SF2: { team1: qfWinners[1], team2: qfWinners[2], [`legs_${qfWinners[1]}`]: 0, [`legs_${qfWinners[2]}`]: 0, played: false }
    };

    await setDoc(
        doc(db, "tournaments", tournamentID, "knockout", "semifinals"),
        { matches }
    );

    qfWinners.map(async team => {
        await updateDoc(
            doc(db, "tournaments", tournamentID, "teams", team),
            { reachedStage: "semifinal" }
        );
    });

    const qfLosersStandings = await Promise.all(
        qfLosers.map(async teamID => {
            const teamSnap = await getDoc(
                doc(db, "tournaments", tournamentID, "teams", teamID)
            );
            return {
                team: teamID,
                rank: teamSnap.data().preliminaryRank
            };
        })
    );
    qfLosersStandings.sort((a, b) => a.rank - b.rank).map(async (team, index) => {
        await updateDoc(
            doc(db, "tournaments", tournamentID, "teams", team.team),
            { finalRank: index + 5 }
        );
    });
}

export async function generateFinal(tournamentID, sfWinners, sfLosers) {
    if (sfWinners.length !== 2) throw new Error("Es müssen 2 Teams für das Finale sein");

    const matches = {
        final: {
            team1: sfWinners[0],
            team2: sfWinners[1],
            [`legs_${sfWinners[0]}`]: 0,
            [`legs_${sfWinners[1]}`]: 0,
            played: false
        },
        place3: {
            team1: sfLosers[0],
            team2: sfLosers[1],
            [`legs_${sfLosers[0]}`]: 0,
            [`legs_${sfLosers[1]}`]: 0,
            played: false
        }
    };

    await setDoc(
        doc(db, "tournaments", tournamentID, "knockout", "final"),
        { matches }
    );
}

export async function updateRankingFinals(tournamentID) {
    const finalSnap = await getDoc(doc(db, "tournaments", tournamentID, "knockout", "final"));
    const final = finalSnap.data().matches.final;
    const place3 = finalSnap.data().matches.place3;
    const finalWinner = final[`legs_${final.team1}`] > final[`legs_${final.team2}`] ? final.team1 : final.team2;
    const finalLoser = final[`legs_${final.team1}`] < final[`legs_${final.team2}`] ? final.team1 : final.team2;
    const place3Winner = place3[`legs_${place3.team1}`] > place3[`legs_${place3.team2}`] ? place3.team1 : place3.team2;
    const place3Loser = place3[`legs_${place3.team1}`] < place3[`legs_${place3.team2}`] ? place3.team1 : place3.team2;

    await updateDoc(
        doc(db, "tournaments", tournamentID, "teams", finalWinner),
        { finalRank: 1, reachedStage: "final" }
    );

    await updateDoc(
        doc(db, "tournaments", tournamentID, "teams", finalLoser),
        { finalRank: 2, reachedStage: "final" }
    );

    await updateDoc(
        doc(db, "tournaments", tournamentID, "teams", place3Winner),
        { finalRank: 3, reachedStage: "semifinal" }
    );

    await updateDoc(
        doc(db, "tournaments", tournamentID, "teams", place3Loser),
        { finalRank: 4, reachedStage: "semifinal" }
    );
}

export function subscribeTeams(tournamentID, callback) {
    const teamsRef = collection(db, "tournaments", tournamentID, "teams");

    return onSnapshot(teamsRef, snapshot => {
        const teams = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(teams);
    });
}

export function subscribeMatchday(tournamentID, md, callback) {
    const matchdayRef = doc(db, "tournaments", tournamentID, "matchdays", md);

    return onSnapshot(matchdayRef, snap => {
        if (!snap.exists()) {
            callback({});
            return;
        }
        callback(snap.data().matches || {});
    });
}

export function subscribeAllMatchdays(tournamentID, callback) {
    const matchdaysRef = collection(db, "tournaments", tournamentID, "matchdays");

    return onSnapshot(matchdaysRef, snapshot => {
        const matchdays = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(matchdays);
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
        if (!snap.exists()) {
            callback({ matches: {} }); // Falls Runde noch nicht existiert
            return;
        }
        callback(snap.data());
    });
}

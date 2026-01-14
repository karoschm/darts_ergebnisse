import { collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc, query, where, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function getAllTeams() {
    const snapshot = await getDocs(collection(db, "teams"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateTeamNames(teamNames) {
    console.log(teamNames);
    Object.keys(teamNames).forEach(async function (key, index) {
        const teamRef = doc(db, "teams", key);
        await setDoc(teamRef, { name: teamNames[key], wins: 0, losses: 0, score: 0 });
    })
}

export async function saveSchedule(schedule) {
    schedule.map(async (day, idx) => {
        const gameday = String(idx + 1);
        const gamedayRef = doc(db, "gamedays", gameday);
        const gamedaySnap = await getDoc(gamedayRef);

        if (gamedaySnap.exists()) {
            deleteDoc(gamedayRef);
        }

        const matchesObject = Object.fromEntries(
            day.map(([t1, t2], i) => [
                `match_${i.toString()}`,
                { team1: t1, team2: t2, [`score_${t1}`]: -1, [`score_${t2}`]: -1, played: false }
            ])
        );

        await setDoc(doc(db, "gamedays", gameday), matchesObject);
    });
}

export async function getGamedayMatches(gameday) {
    const gamedayRef = doc(db, "gamedays", gameday);
    const gamedaySnap = await getDoc(gamedayRef);

    if (!gamedaySnap.exists()) return [];

    const data = gamedaySnap.data();

    return data;
}

export async function addTeamGame(team1, team2, gameday) {
    const team1Ref = doc(db, "teams", team1);
    const team1Snap = await getDoc(team1Ref);
    const team1Matches = team1Snap.data().matches || {};
    if (!(gameday in team1Matches)) {
        await setDoc(team1Ref, { matches: { [gameday]: team2 } }, { merge: true });
    } else if (team1Matches[gameday] !== team2) {
        await setDoc(team1Ref, { matches: { [gameday]: team2 } }, { merge: true });
    }

    const team2Ref = doc(db, "teams", team2);
    const team2Snap = await getDoc(team2Ref);
    const team2Matches = team2Snap.data().matches || {};
    if (!(gameday in team2Matches)) {
        await setDoc(team2Ref, { matches: { [gameday]: team1 } }, { merge: true });
    } else if (team2Matches[gameday] !== team1) {
        await setDoc(team2Ref, { matches: { [gameday]: team1 } }, { merge: true });
    }
}

export async function saveScore(gameday, matchKey, team, value, opponent) {
    const gamedayRef = doc(db, "gamedays", gameday.toString());
    const gamedaySnap = await getDoc(gamedayRef);
    await updateDoc(gamedayRef, {
        [`${matchKey}.score_${team}`]: Number(value)
    });

    const matchScore = value - gamedaySnap.data()[`${matchKey}`][`score_${opponent}`];
    console.log(matchScore);
    const teamRef = doc(db, "teams", team);
    const teamSnap = await getDoc(teamRef);
    await updateDoc(teamRef, {
        score: teamSnap.data().score - matchScore
    });

    const opponentRef = doc(db, "teams", opponent);
    const opponentSnap = await getDoc(opponentRef);
    await updateDoc(opponentRef, {
        score: opponentSnap.data().score + matchScore
    });
}

export async function setMatchPlayed(gameday, matchKey) {
    const gamedayRef = doc(db, "gamedays", gameday.toString());
    await updateDoc(gamedayRef, {
        [`${matchKey}.played`]: true
    });
}

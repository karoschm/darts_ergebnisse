import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { generateSemifinals, getAllTeams, saveKOScore, subscribeKnockoutRound, subscribeTournamentStatus, updateAllKOsPlayed, updateTournamentStatus } from "../../../services/firestoreService";

export default function QuarterfinalTab() {
    const { currentTournamentId } = useTournament();
    const [teamNames, setTeamNames] = useState({});
    const [status, setStatus] = useState("");
    const [quarterFinals, setQuarterFinals] = useState({ matches: {} });
    const [allQFsPlayed, setAllQFsPlayed] = useState(false);
    const [winLegs, setWinLegs] = useState(3);

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
                "quarterfinals",
                (data) => {
                    setQuarterFinals(data);
        
                    // Abgeleitet: prüfen, ob alle Matches played === true
                    const matches = data.matches || {};
                    const allPlayed = Object.values(matches).every(match => match.played === true);
                    setAllQFsPlayed(allPlayed);
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
    }, [currentTournamentId]);

    function handleLegScoreChange(matchKey, team, newScore, opponent) {
        setQuarterFinals(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                [`score_${team}`]: newScore
            }
        }));
        saveKOScore(currentTournamentId, "quarterfinals", matchKey, team, newScore, opponent, winLegs);
    }

    function handleWinLegsChange(newWinLegs) {
        setWinLegs(newWinLegs);
        updateAllKOsPlayed(currentTournamentId, "quarterfinals", newWinLegs);
    }

    function getQuarterFinalWinners() {
        const winners = [];
    
        Object.values(quarterFinals.matches).forEach(match => {
            if (!match.played) return; // Sicherheit

            const team1 = match.team1;
            const team2 = match.team2;
    
            if (match[`legs_${team1}`] > match[`legs_${team2}`]) {
                winners.push(team1);
            } else {
                winners.push(team2);
            }
        });
    
        return winners; // Array mit IDs der siegreichen Teams
    }

    const handleFinishQuarterfinal = () => {
        generateSemifinals(currentTournamentId, getQuarterFinalWinners());
        updateTournamentStatus(currentTournamentId, "sf");
    }

    return (
        <div style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "0 20px"
        }}>
            <h1>Viertelfinale</h1>
            <label>First to</label>
            <input
                type={"number"}
                value={winLegs}
                disabled={status !== "qf"}
                onChange={e => handleWinLegsChange(Number(e.target.value))}
            />
            <br/>
            {status !== "group" && (
                <div>
                    <table>
                        <thead>
                            <tr>
                                <th>Match</th>
                                <th>Legs</th>
                                <th>Team 1</th>
                                <th></th>
                                <th>Team 2</th>
                                <th>Legs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(quarterFinals.matches).
                                sort(([mId1, m1], [mId2, m2]) => mId1.localeCompare(mId2)).
                                map(([matchId, match]) => (
                                    <tr key={matchId}>
                                        <td>{matchId}</td>
                                        <td>
                                            <input
                                                type={"number"}
                                                value={match[`legs_${match.team1}`]}
                                                disabled={status !== "qf"}
                                                onChange={e => handleLegScoreChange(matchId, match.team1, Number(e.target.value), match.team2)}
                                                min={0}
                                                max={winLegs}
                                            />
                                        </td>
                                        <td>{teamNames[match.team1]}</td>
                                        <td>vs</td>
                                        <td>{teamNames[match.team2]}</td>
                                        <td>
                                            <input
                                                type={"number"}
                                                value={match[`legs_${match.team2}`]}
                                                disabled={status !== "qf"}
                                                onChange={e => handleLegScoreChange(matchId, match.team2, Number(e.target.value), match.team1)}
                                                min={0}
                                                max={winLegs}
                                            />
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                    <br/>
                    <button
                        onClick={handleFinishQuarterfinal}
                        disabled={!allQFsPlayed || (status !== "qf")}
                    >
                        Viertelfinale abschließen
                    </button>
                </div>
            )}

        </div>
    )
}
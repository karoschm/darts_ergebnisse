import { useState, useEffect } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { getAllTeams, saveScore, setMatchPlayed, subscribeMatchday, subscribeTournamentStatus } from "../../../services/firestoreService";

export default function MatchdayTabs({ md }) {
    const { currentTournamentId } = useTournament();
    const [matches, setMatches] = useState({});
    const [teamNames, setTeamNames] = useState({});
    const [status, setStatus] = useState("");

    useEffect(() => {
        if (!currentTournamentId) return;

        let unsubscribeMatchday;
        let unsubscribeStatus;

        async function init() {
            // Teamnamen einmal laden
            const loadedTeams = await getAllTeams(currentTournamentId);
            const names = loadedTeams.reduce((acc, doc) => {
                acc[doc.id] = doc.name || "";
                return acc;
            }, {});
            setTeamNames(names);

            // Matchday live abonnieren
            unsubscribeMatchday = subscribeMatchday(
                currentTournamentId,
                md,
                (liveMatches) => {
                    setMatches(liveMatches);
                }
            );

            unsubscribeStatus = subscribeTournamentStatus(
                currentTournamentId,
                setStatus
            );
        }

        init();

        return () => {
            if (unsubscribeMatchday) unsubscribeMatchday();
            if (unsubscribeStatus) unsubscribeStatus();
        };
    }, [currentTournamentId, md]);

    function handleScoreChange(matchKey, team, newScore, opponent) {
        setMatches(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                [`score_${team}`]: newScore
            }
        }));
        saveScore(currentTournamentId, md, matchKey, team, newScore, opponent);
    }

    function enterResult(matchKey) {
        setMatches(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                played: true
            }
        }));
        setMatchPlayed(currentTournamentId, md, matchKey);
    }

    return (
        <table style={{
            borderCollapse: "collapse",
            alignContent: "center"
        }}>
            <tbody>
                {Object.keys(matches).sort((a, b) => a.localeCompare(b)).map((mNumber) => {
                    const match = matches[mNumber];
                    const team1 = match.team1;
                    const team2 = match.team2;
                    const scoreTeam1 = match[`score_${team1}`];
                    const scoreTeam2 = match[`score_${team2}`];
                    const gamePlayed = match.played

                    return gamePlayed ? (
                        <tr key={mNumber} style={{ borderBottom: "1px solid #ccc" }}>

                            <td style={{ padding: "8px" }}>
                                <input
                                    type="number"
                                    style={{ width: "60px", textAlign: "center" }}
                                    disabled={status !== "group"}
                                    value={scoreTeam1}
                                    onChange={e => handleScoreChange(mNumber, team1, Number(e.target.value), team2)}
                                    onBlur={e => saveScore(currentTournamentId, md, mNumber, team1, Number(e.target.value), team2)}
                                    min={0}
                                    max={501}
                                />
                            </td>

                            <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                                {teamNames[team1]}
                            </td>

                            <td style={{ padding: "8px", textAlign: "center" }}>
                                vs
                            </td>

                            <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                                {teamNames[team2]}
                            </td>

                            <td style={{ padding: "8px" }}>
                                <input
                                    type="number"
                                    style={{ width: "60px", textAlign: "center" }}
                                    disabled={status !== "group"}
                                    value={scoreTeam2}
                                    onChange={e => handleScoreChange(mNumber, team2, Number(e.target.value), team1)}
                                    onBlur={e => saveScore(currentTournamentId, md, mNumber, team2, Number(e.target.value), team1)}
                                    min={0}
                                    max={501}
                                />
                            </td>

                        </tr>
                    ) : (
                        <tr key={mNumber} style={{ borderBottom: "1px solid #ccc" }}>

                            <td></td>

                            <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                                {teamNames[team1]}
                            </td>

                            <td style={{ padding: "8px", textAlign: "center" }}>
                                vs
                            </td>

                            <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                                {teamNames[team2]}
                            </td>

                            <td style={{ padding: "8px" }}>
                                <button 
                                    onClick={() => enterResult(mNumber)}
                                    disabled={status !== "group"}
                                >
                                    Ergebnis eintragen
                                </button>
                            </td>

                        </tr>
                    )
                })
                }
            </tbody>
        </table>
    );
}
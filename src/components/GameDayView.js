import { useEffect, useState } from "react";
import { getGamedayMatches, saveScore, setMatchPlayed } from "../services/firestoreService";

export default function GameDayView({ gameday, teamNames }) {
    const [matches, setMatches] = useState({});

    useEffect(() => {
        async function loadMatches() {
            const gamedayMatches = await getGamedayMatches(gameday);
            setMatches(gamedayMatches);
        }
        loadMatches();
    }, [gameday]);

    function handleScoreChange(gameday, matchKey, team, value) {
        setMatches(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                [`score_${team}`]: value
            }
        }));
        saveScore(gameday, matchKey, team, value);
    }

    function enterResult(gameday, matchKey) {
        setMatches(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                played: true
            }
        }));
        setMatchPlayed(gameday, matchKey);
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
                                    value={scoreTeam1}
                                    onChange={e => handleScoreChange(gameday, mNumber, team1, e.target.value)}
                                    onBlur={e => saveScore(gameday, mNumber, team1, e.target.value)}
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
                                    value={scoreTeam2}
                                    onChange={e => handleScoreChange(gameday, mNumber, team2, e.target.value)}
                                    onBlur={e => saveScore(gameday, mNumber, team2, e.target.value)}
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
                                <button onClick={e => enterResult(gameday, mNumber)}>Ergebnis eintragen</button>
                            </td>

                        </tr>
                    )
                })
                }
            </tbody>
        </table>
    );
}
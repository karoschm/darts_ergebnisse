import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../../context/TournamentContext";
import { getAllTeams, saveKOScore, subscribeKnockoutRound, subscribeTournamentStatus, updateAllKOsPlayed, updateRankingFinals, updateTournamentStatus } from "../../../services/firestoreService";

export default function FinalTab() {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    const [finals, setFinals] = useState({ matches: {} })
    const [allFinalsPlayed, setAllFinalsPlayed] = useState(false);
    const [teamNames, setTeamNames] = useState({});
    const [winLegs, setWinLegs] = useState(5);

    const finalMatch = finals?.matches?.final;
    const place3Match = finals?.matches?.place3;

    const finalReady = Boolean(finalMatch?.team1 && finalMatch?.team2);
    const place3Ready = Boolean(place3Match?.team1 && place3Match?.team2);

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
                "final",
                (data) => {
                    setFinals(data);

                    // Abgeleitet: prüfen, ob alle Matches played === true
                    const matches = data.matches || {};
                    const allPlayed = Object.values(matches).every(match => match.played === true);
                    setAllFinalsPlayed(allPlayed);
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
    }, [status, currentTournamentId]);

    function handleLegScoreChange(matchKey, team, newScore, opponent) {
        setFinals(prev => ({
            ...prev,
            [matchKey]: {
                ...prev[matchKey],
                [`score_${team}`]: newScore
            }
        }));
        saveKOScore(currentTournamentId, "final", matchKey, team, newScore, opponent, winLegs);
    }

    function handleWinLegsChange(newWinLegs) {
        setWinLegs(newWinLegs);
        updateAllKOsPlayed(currentTournamentId, "final", newWinLegs);
    }

    const handleFinishFinal = (e) => {
        e.preventDefault();
        updateRankingFinals(currentTournamentId);
        updateTournamentStatus(currentTournamentId, "finished");
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
            <h1>Finale</h1>
            <label>First to</label>
            <input
                type={"number"}
                value={winLegs}
                disabled={status !== "final"}
                onChange={e => handleWinLegsChange(Number(e.target.value))}
            />
            <br />
            {status !== "group" && (
                <div>
                    <h2>Finale</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Legs</th>
                                <th>Team 1</th>
                                <th></th>
                                <th>Team 2</th>
                                <th>Legs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finalReady ? (
                                <tr>
                                    <td>
                                        <input
                                            type={"number"}
                                            value={finals.matches.final[`legs_${finals.matches.final.team1}`]}
                                            disabled={status !== "final"}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    "final",
                                                    finals.matches.final.team1,
                                                    Number(e.target.value),
                                                    finals.matches.final.team2
                                                )
                                            }
                                            min={0}
                                            max={winLegs}
                                        />
                                    </td>
                                    <td>{teamNames[finals.matches.final.team1]}</td>
                                    <td>vs</td>
                                    <td>{teamNames[finals.matches.final.team2]}</td>
                                    <td>
                                        <input
                                            type={"number"}
                                            value={finals.matches.final[`legs_${finals.matches.final.team2}`]}
                                            disabled={status !== "final"}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    "final",
                                                    finals.matches.final.team2,
                                                    Number(e.target.value),
                                                    finals.matches.final.team1
                                                )
                                            }
                                            min={0}
                                            max={winLegs}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                <tr>
                                    <td />
                                    <td>Sieger SF1</td>
                                    <td>vs</td>
                                    <td>Sieger SF 2</td>
                                    <td />
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <br />
                    <br />
                    <h2>Spiel um Platz 3</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Legs</th>
                                <th>Team 1</th>
                                <th></th>
                                <th>Team 2</th>
                                <th>Legs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {place3Ready ? (
                                <tr>
                                    <td>
                                        <input
                                            type={"number"}
                                            value={finals.matches.place3[`legs_${finals.matches.place3.team1}`]}
                                            disabled={status !== "final"}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    "place3",
                                                    finals.matches.place3.team1,
                                                    Number(e.target.value),
                                                    finals.matches.place3.team2
                                                )
                                            }
                                            min={0}
                                            max={winLegs}
                                        />
                                    </td>
                                    <td>{teamNames[finals.matches.place3.team1]}</td>
                                    <td>vs</td>
                                    <td>{teamNames[finals.matches.place3.team2]}</td>
                                    <td>
                                        <input
                                            type={"number"}
                                            value={finals.matches.place3[`legs_${finals.matches.place3.team2}`]}
                                            disabled={status !== "final"}
                                            onChange={e =>
                                                handleLegScoreChange(
                                                    "place3",
                                                    finals.matches.place3.team2,
                                                    Number(e.target.value),
                                                    finals.matches.place3.team1
                                                )
                                            }
                                            min={0}
                                            max={winLegs}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                <tr>
                                    <td />
                                    <td>Verlierer SF1</td>
                                    <td>vs</td>
                                    <td>Verlierer SF 2</td>
                                    <td />
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <br />
                    <button
                        onClick={handleFinishFinal}
                        disabled={!finalReady || !place3Ready || !allFinalsPlayed || status !== "final"}
                    >
                        Turnier abschließen
                    </button>
                </div>
            )}
        </div>
    )
}
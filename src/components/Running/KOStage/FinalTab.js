import { TableCell, TableHead, TableRow } from "@mui/material";
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
            padding: "20px 20px 60px 20px"
        }}>
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
                        <TableHead>
                            <TableRow>
                                <TableCell>Legs</TableCell>
                                <TableCell>Team 1</TableCell>
                                <TableCell></TableCell>
                                <TableCell>Team 2</TableCell>
                                <TableCell>Legs</TableCell>
                            </TableRow>
                        </TableHead>
                        <tbody>
                            {finalReady ? (
                                <TableRow>
                                    <TableCell>
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
                                    </TableCell>
                                    <TableCell>{teamNames[finals.matches.final.team1]}</TableCell>
                                    <TableCell>vs</TableCell>
                                    <TableCell>{teamNames[finals.matches.final.team2]}</TableCell>
                                    <TableCell>
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
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <TableRow>
                                    <td />
                                    <TableCell>Sieger SF1</TableCell>
                                    <TableCell>vs</TableCell>
                                    <TableCell>Sieger SF 2</TableCell>
                                    <td />
                                </TableRow>
                            )}
                        </tbody>
                    </table>
                    <br />
                    <br />
                    <h2>Spiel um Platz 3</h2>
                    <table>
                        <thead>
                            <TableRow>
                                <TableCell>Legs</TableCell>
                                <TableCell>Team 1</TableCell>
                                <TableCell></TableCell>
                                <TableCell>Team 2</TableCell>
                                <TableCell>Legs</TableCell>
                            </TableRow>
                        </thead>
                        <tbody>
                            {place3Ready ? (
                                <TableRow>
                                    <TableCell>
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
                                    </TableCell>
                                    <TableCell>{teamNames[finals.matches.place3.team1]}</TableCell>
                                    <TableCell>vs</TableCell>
                                    <TableCell>{teamNames[finals.matches.place3.team2]}</TableCell>
                                    <TableCell>
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
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <TableRow>
                                    <td />
                                    <TableCell>Verlierer SF1</TableCell>
                                    <TableCell>vs</TableCell>
                                    <TableCell>Verlierer SF 2</TableCell>
                                    <td />
                                </TableRow>
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
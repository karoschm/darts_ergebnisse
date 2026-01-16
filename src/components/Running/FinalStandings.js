import { useEffect } from "react";
import { useState } from "react";
import { useTournament } from "../../context/TournamentContext";
import { getAllTeams, subscribeTournamentStatus } from "../../services/firestoreService";

export default function FinalStandings() {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    const [teams, setTeams] = useState({});
    // const [teamNames, setTeamNames] = useState({});
    // const [quarterfinals, setQuarterfinals] = useState({});
    // const [final, setFinal] = useState({});
    // const [finalStandings, setFinalStandings] = useState([]);

    useEffect(() => {
        if (!currentTournamentId) return;

        const unsub = subscribeTournamentStatus(
            currentTournamentId,
            setStatus
        );

        return () => unsub();
    }, [currentTournamentId]);

    useEffect(() => {
        console.log(status);
        if (status !== "finished" || !currentTournamentId) return;

        async function getTeams() {
            const loadedTeams = await getAllTeams(currentTournamentId);
            console.log(loadedTeams);
            setTeams(loadedTeams);
        }
        getTeams();
    }, [status, currentTournamentId]);

    // useEffect(() => {
    //     if (status !== "finished" || !currentTournamentId) return;

    //     async function loadFinalData() {
    //         const loadedTeams = await getAllTeams(currentTournamentId);
    //         const quarterfinals = await getKnockout(currentTournamentId, "quarterfinals");
    //         const final = await getKnockout(currentTournamentId, "final");
    //         // const names = loadedTeams.reduce((acc, doc) => {
    //         //     acc[doc.id] = doc.name || "";
    //         //     return acc;
    //         // }, {});
    //         // setTeamNames(names);
    //         // setQuarterfinals(await getKnockout(currentTournamentId, "quarterfinals"));
    //         // setFinal(await getKnockout(currentTournamentId, "final"));

    //         const getWinner = (match) =>
    //             match.legs1 > match.legs2 ? match.team1 : match.team2;

    //         const getLoser = (match) =>
    //             match.legs1 > match.legs2 ? match.team2 : match.team1;

    //         const sortByPreliminaryRank = (teams) => {
    //             return [...teams].sort((a, b) => {
    //                 if (b.wins !== a.wins) return b.wins - a.wins;
    //                 if (b.own_score !== a.own_score) return b.own_score - a.own_score;
    //                 return a.opponent_score - b.opponent_score;
    //             });
    //         };

    //         console.log(loadedTeams);

    //         const finalMatch = final.matches.final;
    //         const thirdPlaceMatch = final.matches.place3;

    //         const finalWinner = getWinner(finalMatch);
    //         const finalLoser = getLoser(finalMatch);
    //         const thirdWinner = getWinner(thirdPlaceMatch);
    //         const thirdLoser = getLoser(thirdPlaceMatch);

    //         const quarterFinalLosers = Object.values(quarterfinals.matches)
    //             .map(getLoser);

    //         const koTeams = new Set([
    //             finalWinner,
    //             finalLoser,
    //             thirdWinner,
    //             thirdLoser,
    //             ...quarterFinalLosers
    //         ]);

    //         const sortedByPreliminary = sortByPreliminaryRank(loadedTeams);

    //         const sortedQuarterLosers = sortedByPreliminary.filter(t =>
    //             quarterFinalLosers.includes(t.id)
    //         );

    //         const sortedRemainingTeams = sortedByPreliminary.filter(t =>
    //             !koTeams.has(t.id)
    //         );

    //         const standings = [
    //             finalWinner,
    //             finalLoser,
    //             thirdWinner,
    //             thirdLoser,
    //             ...sortedQuarterLosers.map(t => t.id),
    //             ...sortedRemainingTeams.map(t => t.id)
    //         ];

    //         setTeams(loadedTeams);
    //         setFinalStandings(standings);
    //     }

    //     loadFinalData();

    // }, [status, currentTournamentId]);

    if (status !== "finished") {
        return <div style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "0 20px"
        }}>
            Turnier ist noch nicht beendet
        </div>
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
            <h1>Abschließende Platzierungen</h1>
            <label>{teams.A1}</label>
            <ol>
                {Object.entries(teams).sort(([i1, t1], [i2, t2]) => t1.finalRank < t2.finalRank).map(([teamID, team]) => (
                    <li key={teamID}>
                        {team?.name || teamID}
                    </li>
                ))}
                {/* {finalStandings.map((teamId, index) => {
                    const team = teams.find(t => t.id === teamId);
                    return (
                        <li key={teamId}>
                            {team?.name || teamId}
                        </li>
                    );
                })} */}
            </ol>
        </div>
    );

}
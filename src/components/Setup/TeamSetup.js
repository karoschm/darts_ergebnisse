import { useEffect } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTournament } from "../../context/TournamentContext";
import { getAllTeams, updateTeamNames } from "../../services/firestoreService";

export default function TeamSetup() {
    const navigate = useNavigate();
    const { currentTournamentId } = useTournament();
    const [teams, setTeams] = useState({});
    const [teamNames, setTeamNames] = useState({});

    useEffect(() => {
        if (!currentTournamentId) return;

        async function fetchData() {
            const loadedTeams = await getAllTeams(currentTournamentId);
            setTeams(loadedTeams);

            const names = loadedTeams.reduce((acc, doc) => {
                acc[doc.id] = doc.name || "";
                return acc;
            }, {});
            setTeamNames(names);
        }
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedNames = Object.fromEntries(
            Object.entries(teamNames).map(([key, value]) => [key, value.trim()])
        );

        await updateTeamNames(currentTournamentId, teamNames);

        navigate("/group");
    };

    const handleInputChange = async (id, value) => {
        setTeamNames(prev => ({ ...prev, [id]: value}));
    };

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "0 20px"
            }}
        >
            <label>
                Bitte gib für alle Teams einen Namen ein
            </label>
            <table style={{
                borderCollapse: "collapse",
                alignContent: "center"
            }}>
                <tbody>
                    {Object.values(teams).sort((a, b) => Number(a.id.slice(1)) > Number(b.id.slice(1))).map(team =>
                        <tr>
                            <td>
                                <label>{team.id}</label>
                            </td>
                            <td>
                                <input
                                    value={teamNames[team.id]}
                                    onChange={e => handleInputChange(team.id, e.target.value)}
                                />
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            <button type="submit">
                Turnier starten
            </button>
        </form>
    );
}
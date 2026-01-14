import { useEffect, useState } from "react"
import { getAllTeams, updateTeamNames } from "../../../services/firestoreService"

export default function TeamsTab() {
    const [teams, setTeams] = useState([]);
    const [teamNames, setTeamNames] = useState({});

    useEffect(() => {
        async function fetchData() {
            const loadedTeams = await getAllTeams();
            setTeams(loadedTeams);

            const names = loadedTeams.reduce((acc, doc) => {
                acc[doc.id] = doc.name || "";
                return acc;
            }, {});
            setTeamNames(names);
        }
        fetchData();
    }, []);

    const handleInputChange = async (id, value) => {
        setTeamNames(prev => ({ ...prev, [id]: value}));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedNames = Object.fromEntries(
            Object.entries(teamNames).map(([key, value]) => [key, value.trim()])
        );

        await updateTeamNames(trimmedNames);
    }

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "left",
                textAlign: "left",
                padding: "0 20px",
                paddingBottom: "60px"
            }}>
            <h2>
                Teams eintragen
            </h2>
            {teams.sort((a, b) => Number(a.id.slice(1)) > Number(b.id.slice(1))).map(team => (
                <div style={{ marginBottom: "10px" }}>
                    <label key={team.id}>{team.id}: </label>
                    <input
                        // key={teamNames[team.id]}
                        type="text"
                        value={teamNames[team.id]}
                        onChange={e => handleInputChange(team.id, e.target.value)}
                    />
                    <br></br>
                </div>
            ))}
            <br></br>
            <br></br>
            <button
                type="submit"
            >
                Speichern
            </button>
        </form>
    )
}
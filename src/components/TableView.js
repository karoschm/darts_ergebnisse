import { useEffect } from "react";
import { useState } from "react";
import { getAllTeams } from "../services/firestoreService";

export default function TableView({ teamNames }) {
    const [teams, setTeams] = useState({});

    useEffect(() => {
        async function loadTeams() {
            const loadedTeams = await getAllTeams();
            setTeams(loadedTeams);
        }
        loadTeams();
    }, []);

    function getTableOrder() {
        const sortedTeams = Object.values(teams).sort((a, b) => {
            if (b.wins !== a.wins) {
                return b.wins - a.wins; // Siege absteigend
            }
            return b.score - a.score; // Score absteigend
        });
        return sortedTeams;
    }

    return (
        <tbody>
            <tr>
                <td style={{ padding: "8px" }}>Platzierung</td>
                <td style={{ padding: "8px" }}>Team</td>
                <td style={{ padding: "8px" }}>Siege</td>
                <td style={{ padding: "8px" }}>Niederlagen</td>
                <td style={{ padding: "8px" }}>Punkteverhältnis</td>
            </tr>
            {getTableOrder().map((team, index) => (
                <tr>
                    <td>{index + 1}.</td>
                    <td>{team.name}</td>
                    <td>{team.wins}</td>
                    <td>{team.losses}</td>
                    <td>{team.score}</td>
                </tr>
            ))}
        </tbody>
    )
}
export default function StandingsTable({ teams }) {
    function getTableOrder() {
        const sortedTeams = Object.values(teams).sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.own_score !== a.own_score) return b.own_score - a.own_score;
            return b.opponent_score - a.opponent_score;
        });
        return sortedTeams;
    }

    return (
        <div>
            <h2>
                Tabelle
            </h2>
            <table style={{
                borderCollapse: "collapse",
                alignContent: "center"
            }}>
                <thead>
                    <td>Platzierung</td>
                    <td>Team</td>
                    <td>Siege</td>
                    <td>Niederlagen</td>
                    <td>Punkteverhältnis</td>
                </thead>
                <tbody>
                    {getTableOrder().map((team, index) => (
                        <tr>
                            <td>{index + 1}.</td>
                            <td>{team.name}</td>
                            <td>{team.wins}</td>
                            <td>{team.losses}</td>
                            <td>{team.own_score}:{team.opponent_score}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
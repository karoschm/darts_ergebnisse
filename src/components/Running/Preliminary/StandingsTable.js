export default function StandingsTable({ teams }) {
    function getTableOrder() {
        const sortedTeams = Object.values(teams).sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.own_score !== a.own_score) return a.own_score - b.own_score;
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
                    <tr>
                        <th>Platzierung</th>
                        <th>Team</th>
                        <th>Siege</th>
                        <th>Niederlagen</th>
                        <th>Punkteverhältnis</th>
                    </tr>
                </thead>
                <tbody>
                    {getTableOrder().map((team, index) => (
                        <tr key={`row_${team.name}`}>
                            <td key={`rank_${team.name}`}>{index + 1}.</td>
                            <td key={`name_${team.name}`}>{team.name}</td>
                            <td key={`wins_${team.name}`}>{team.wins}</td>
                            <td key={`losses_${team.name}`}>{team.losses}</td>
                            <td key={`score_${team.name}`}>{team.own_score}:{team.opponent_score}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
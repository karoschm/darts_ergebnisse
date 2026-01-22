import { TableCell, TableHead, TableRow } from "@mui/material";

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
                <TableHead>
                    <TableRow>
                        <TableCell>Platzierung</TableCell>
                        <TableCell>Team</TableCell>
                        <TableCell>Siege</TableCell>
                        <TableCell>Niederlagen</TableCell>
                        <TableCell>Punkteverhältnis</TableCell>
                    </TableRow>
                </TableHead>
                <tbody>
                    {getTableOrder().map((team, index) => (
                        <TableRow key={`row_${team.name}`}>
                            <TableCell key={`rank_${team.name}`}>{index + 1}.</TableCell>
                            <TableCell
                                key={`name_${team.name}`}
                                align="center"
                            >
                                {team.name}
                            </TableCell>
                            <TableCell
                                key={`wins_${team.name}`}
                                align="center"
                            >
                                {team.wins}
                            </TableCell>
                            <TableCell
                                key={`losses_${team.name}`}
                                align="center"
                            >
                                {team.losses}
                            </TableCell>
                            <TableCell
                                key={`score_${team.name}`}
                                align="right"
                            >
                                {team.own_score}:{team.opponent_score}
                            </TableCell>
                        </TableRow>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
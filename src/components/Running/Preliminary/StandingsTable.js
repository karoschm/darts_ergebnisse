import { Table, TableCell, TableHead, TableRow, useTheme, useMediaQuery } from "@mui/material";

export default function StandingsTable({ teams }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    function getTableOrder() {
        const sortedTeams = Object.values(teams).sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.own_score !== a.own_score) return a.own_score - b.own_score;
            return b.opponent_score - a.opponent_score;
        });
        return sortedTeams;
    }

    return isMobile ? (
        <div
            style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
            }}
        >
            {getTableOrder().map((team, index) => (
                <div
                    key={team.id}
                    style={{
                        border: "1px solid #ccc",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 10,
                    }}
                >
                    <strong>{index + 1}. {team.name}</strong>
                    <div>W: {team.wins} | L: {team.losses} | {team.own_score}:{team.opponent_score}</div>
                </div>
            ))}
        </div>
    ) : (
        <div
            style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
            }}
        >
            <h2>
                Tabelle
            </h2>
            <Table style={{
                borderCollapse: "collapse",
                alignContent: "center"
            }}>
                <TableHead>
                    <TableRow>
                        <TableCell width="10%">#</TableCell>
                        <TableCell width="55%" align="center">Team</TableCell>
                        <TableCell width="10%" align="center">W</TableCell>
                        <TableCell width="10%" align="center">L</TableCell>
                        <TableCell width="15%" align="right">+/-</TableCell>
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
            </Table>
        </div>
    );
}
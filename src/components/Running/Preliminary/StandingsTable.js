import { Table, TableCell, TableHead, TableBody, TableRow, useTheme, useMediaQuery, Card, Typography } from "@mui/material";

export default function StandingsTable({ teams }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    function getTableOrder() {
        return Object.values(teams)
            .filter(t => !t.isBye) // BYE nie anzeigen
            .sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                if (b.own_score !== a.own_score) return a.own_score - b.own_score;
                return b.opponent_score - a.opponent_score;
            });
    }

    return isMobile ? (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            {getTableOrder().map((team, index) => (
                <Card key={team.id} sx={{ width: "90vw", mx: "auto", mb: 2 }}>
                    <Typography
                        sx={{
                            flex: 1, minWidth: 0, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                            fontSize: team.name.length > 30 ? "0.75rem" : "1rem"
                        }}
                        fontWeight="bold"
                    >
                        {index + 1}. {team.name}
                    </Typography>
                    <div>W: {team.wins} | L: {team.losses} | {team.own_score}:{team.opponent_score}</div>
                </Card>
            ))}
        </div>
    ) : (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <h2>Tabelle</h2>
            <Table style={{ borderCollapse: "collapse", alignContent: "center" }}>
                <TableHead>
                    <TableRow>
                        <TableCell width="10%">#</TableCell>
                        <TableCell width="55%" align="center">Team</TableCell>
                        <TableCell width="10%" align="center">W</TableCell>
                        <TableCell width="10%" align="center">L</TableCell>
                        <TableCell width="15%" align="right">+/-</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {getTableOrder().map((team, index) => (
                        <TableRow key={`row_${team.name}`}>
                            <TableCell>{index + 1}.</TableCell>
                            <TableCell align="center">{team.name}</TableCell>
                            <TableCell align="center">{team.wins}</TableCell>
                            <TableCell align="center">{team.losses}</TableCell>
                            <TableCell align="right">{team.own_score}:{team.opponent_score}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
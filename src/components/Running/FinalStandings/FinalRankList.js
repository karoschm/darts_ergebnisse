import { List, ListItem, ListItemText, Paper, useTheme, useMediaQuery } from "@mui/material";

export default function FinalRankList({ teams, startRank = 4 }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    return (
        <Paper sx={{ width: "100%", maxWidth: 500 }}>
            <List>
                {teams.map((team, index) => (
                    <ListItem
                        key={team}
                        divider
                        sx={{
                            backgroundColor: index % 2 ? "primary.main" : "secondary.main"
                        }}
                    >
                        <ListItemText
                            primary={`${startRank + index}. ${team}`}
                        />
                    </ListItem>
                ))}
            </List>
        </Paper>
    );
}

import { List, ListItem, ListItemText, Paper, useTheme, useMediaQuery } from "@mui/material";

export default function FinalRankList({ teams }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    if (!teams || teams.length === 0) return null;

    return (
        <Paper sx={{ width: "100%", maxWidth: 500 }}>
            <List>
                {teams.map((team, index) => (
                    <ListItem
                        key={team.name}
                        divider
                        sx={{
                            backgroundColor: index % 2 ? "primary.main" : "secondary.main"
                        }}
                    >
                        <ListItemText
                            primary={`${team.rank}. ${team.name}`}
                        />
                    </ListItem>
                ))}
            </List>
        </Paper>
    );
}

import { Tabs, Tab, Box, useTheme, useMediaQuery } from "@mui/material";

export default function TournamentTabs({ value, onChange }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    return (
        <Box
            sx={{
                position: "sticky",
                top: 72, // Höhe der HeaderBar
                zIndex: 9,
                backgroundColor: "background.paper",
            }}
        >
            <Tabs
                value={value}
                onChange={onChange}
                // centered
                variant={isMobile ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                sx={{ width: "100%" }}
            >
                <Tab label="Vorrunde" value={0} />
                <Tab label="Viertelfinale" value={1} />
                <Tab label="Halbfinale" value={2} />
                <Tab label="Finale" value={3} />
                <Tab label="Gesamtstand" value={4} />
            </Tabs>
        </Box>
    );
}

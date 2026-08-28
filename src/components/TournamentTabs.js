import { Tabs, Tab, Box, useTheme, useMediaQuery } from "@mui/material";

// Ab dieser Tab-Anzahl quetscht "fullWidth" die Beschriftungen zu stark zusammen
// (mehrzeilig/abgeschnitten) — z.B. bei großen Doppel-KO-Turnieren mit vielen
// WB-/LB-Runden-Tabs. Ab dann wird horizontal gescrollt statt gleichmäßig verteilt.
const SCROLLABLE_TAB_THRESHOLD = 6;

export default function TournamentTabs({ value, onChange, tabs }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const useScrollable = isMobile || tabs.length > SCROLLABLE_TAB_THRESHOLD;

    return (
        <Box
            sx={{
                position: "sticky",
                top: 72,
                zIndex: 9,
                backgroundColor: "background.paper",
            }}
        >
            <Tabs
                value={value}
                onChange={onChange}
                variant={useScrollable ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{ width: "100%" }}
            >
                {tabs.map((tab, index) => (
                    <Tab key={tab.stage} label={tab.label} value={index} />
                ))}
            </Tabs>
        </Box>
    );
}
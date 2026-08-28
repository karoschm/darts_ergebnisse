import { Tabs, Tab, Box, useTheme, useMediaQuery } from "@mui/material";

// Ab dieser Tab-Anzahl quetscht "fullWidth" die Beschriftungen zu stark zusammen
// (mehrzeilig/abgeschnitten) — z.B. bei großen Doppel-KO-Turnieren mit vielen
// WB-/LB-Runden-Tabs. Ab dann wird horizontal gescrollt statt gleichmäßig verteilt.
const SCROLLABLE_TAB_THRESHOLD = 6;

// `top`/`zIndex` erlauben, mehrere TournamentTabs-Leisten übereinander zu stapeln
// (z.B. Übertabs "Gewinner-/Verlierer-Bracket" mit einer darunterliegenden
// Rundenauswahl-Leiste bei Doppel-KO-Turnieren) — die untere Leiste bekommt einen
// größeren `top`-Wert (unterhalb der oberen Leiste) und einen niedrigeren `zIndex`.
export default function TournamentTabs({ value, onChange, tabs, top = 72, zIndex = 9 }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const useScrollable = isMobile || tabs.length > SCROLLABLE_TAB_THRESHOLD;

    return (
        <Box
            sx={{
                position: "sticky",
                top,
                zIndex,
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
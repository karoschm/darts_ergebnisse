import { Tabs, Tab, Box, useTheme, useMediaQuery } from "@mui/material";

export default function TournamentTabs({ value, onChange, tabs }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
                variant={isMobile ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                sx={{ width: "100%" }}
            >
                {tabs.map((tab, index) => (
                    <Tab key={tab.stage} label={tab.label} value={index} />
                ))}
            </Tabs>
        </Box>
    );
}
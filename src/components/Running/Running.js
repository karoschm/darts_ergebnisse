import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useState } from "react";
import Preliminary from "./Preliminary/Preliminary";
import QuarterfinalTab from "./KOStage/QuarterfinalTab";
import SemifinalTab from "./KOStage/SemifinalTab";
import FinalTab from "./KOStage/FinalTab";
import FinalStandings from "./FinalStandings/FinalStandings";
import { useEffect } from "react";
import { useTournament } from "../../context/TournamentContext";
import { subscribeTournamentStatus } from "../../services/firestoreService";
import { Box, Chip, Typography, useTheme, useMediaQuery } from "@mui/material";
import PageContainer from "../PageContainer";
import HeaderBar from "../HeaderBar";
import TournamentTabs from "../TournamentTabs";

export default function Running() {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    const [tabValue, setTabValue] = useState(0);
    
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const statusLabelMap = {
        group: "Vorrunde",
        qf: "Viertelfinale",
        sf: "Halbfinale",
        final: "Finale",
        finished: "Beendet"
    };

    const statusColorMap = {
        group: "default",
        qf: "primary",
        sf: "primary",
        final: "secondary",
        finished: "success"
    };

    useEffect(() => {
        if (!currentTournamentId) return;

        const unsubscribeStatus = subscribeTournamentStatus(
            currentTournamentId,
            setStatus
        );

        return () => unsubscribeStatus();
    }, [status, currentTournamentId])

    const handleTabChange = (event, newTabValue) => {
        setTabValue(newTabValue);
    }

    return (
        <PageContainer>

            <HeaderBar
                tournamentId={currentTournamentId}
                status={status}
                statusLabelMap={statusLabelMap}
                statusColorMap={statusColorMap}
            />

            <TournamentTabs
                value={tabValue}
                onChange={handleTabChange}
                variant={isMobile ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                sx={{ width: "100%" }}
            />

            <Box mt={3}>
                {tabValue === 0 && <Preliminary />}
                {tabValue === 1 && <QuarterfinalTab />}
                {tabValue === 2 && <SemifinalTab />}
                {tabValue === 3 && <FinalTab />}
                {tabValue === 4 && <FinalStandings />}
            </Box>

        </PageContainer>
    )
}
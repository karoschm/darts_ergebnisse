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
import { useNavigate, useParams } from "react-router-dom";

export default function Running() {
    const navigate = useNavigate();

    const { tournamentId, stage } = useParams();
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    
    const { mode } = useParams();
    const isViewMode = mode === "view";
    const isEditMode = mode === "edit";

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

    const stageToTab = {
        preliminary: 0,
        quarterfinal: 1,
        semifinal: 2,
        final: 3,
        standings: 4
    };

    const tabToStage = {
        0: "preliminary",
        1: "quarterfinal",
        2: "semifinal",
        3: "final",
        4: "standings"
    };

    const tabValue = stageToTab[stage] ?? 0;

    useEffect(() => {
        if (!currentTournamentId) return;

        const unsubscribeStatus = subscribeTournamentStatus(
            currentTournamentId,
            setStatus
        );

        return () => unsubscribeStatus();
    }, [status, currentTournamentId])

    const handleTabChange = (event, newTabValue) => {
        navigate(
            `/tournament/${tournamentId}/${isViewMode ? "view" : "edit"}/running/${tabToStage[newTabValue]}`
        );
    };

    return (
        <PageContainer>

            <HeaderBar
                tournamentId={currentTournamentId}
                status={status}
                statusLabelMap={statusLabelMap}
                statusColorMap={statusColorMap}
                isViewMode={isViewMode}
            />

            <TournamentTabs
                value={tabValue}
                onChange={handleTabChange}
                variant={isMobile ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                sx={{ width: "100%" }}
            />

            <Box mt={3}>
                {tabValue === 0 && <Preliminary isViewMode={isViewMode}/>}
                {tabValue === 1 && <QuarterfinalTab isViewMode={isViewMode}/>}
                {tabValue === 2 && <SemifinalTab isViewMode={isViewMode}/>}
                {tabValue === 3 && <FinalTab isViewMode={isViewMode}/>}
                {tabValue === 4 && <FinalStandings isViewMode={isViewMode}/>}
            </Box>

        </PageContainer>
    )
}
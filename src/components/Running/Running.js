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
import { Box, Chip, Typography } from "@mui/material";
import PageContainer from "../PageContainer";
import HeaderBar from "../HeaderBar";
import TournamentTabs from "../TournamentTabs";

export default function Running() {
    const { currentTournamentId } = useTournament();
    const [status, setStatus] = useState("");
    const [tabValue, setTabValue] = useState(0);

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
            />

            <Box mt={3}>
                {tabValue === 0 && <Preliminary />}
                {tabValue === 1 && <QuarterfinalTab />}
                {tabValue === 2 && <SemifinalTab />}
                {tabValue === 3 && <FinalTab />}
                {tabValue === 4 && <FinalStandings />}
            </Box>

        </PageContainer>

        // <Box display="flex" flexDirection="column" gap={2} padding="20px 0">
        //     <Box display="flex" alignItems="center" justifyContent="center" gap={2}>
        //         <Typography variant="h5">
        //             {currentTournamentId}
        //         </Typography>

        //         {status !== "setup" && <Chip
        //             label={statusLabelMap[status]}
        //             color={statusColorMap[status]}
        //             size="small"

        //         />}
        //     </Box>
        //     {/* <h1 align="center">{currentTournamentId}</h1> */}
        //     <Tabs
        //         value={tabValue}
        //         onChange={handleTabChange}
        //         variant="fullWidth"
        //     >
        //         <Tab label={"Vorrunde"} value={0} />
        //         <Tab label={"Viertelfinale"} value={1} />
        //         <Tab label={"Halbfinale"} value={2} />
        //         <Tab label={"Finale"} value={3} />
        //         <Tab label={"Gesamtstand"} value={4} />
        //     </Tabs>
        //     <Box mt={2}>
        //         {tabValue === 0 && <Preliminary />}
        //         {tabValue === 1 && <QuarterfinalTab />}
        //         {tabValue === 2 && <SemifinalTab />}
        //         {tabValue === 3 && <FinalTab />}
        //         {tabValue === 4 && <FinalStandings />}
        //     </Box>
        // </Box>
    )
}
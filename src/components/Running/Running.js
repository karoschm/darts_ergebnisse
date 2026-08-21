import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, useTheme, useMediaQuery } from "@mui/material";
import Fab from "@mui/material/Fab";
import DownloadIcon from "@mui/icons-material/Download";

import { useTournament } from "../../context/TournamentContext";
import { subscribeTournamentStatus, getTournamentData, koRoundLabel, koStageKey } from "../../services/firestoreService";
import { exportTournamentResults } from "../../services/exportService";

import PageContainer from "../PageContainer";
import HeaderBar from "../HeaderBar";
import TournamentTabs from "../TournamentTabs";
import Preliminary from "./Preliminary/Preliminary";
import KORoundTab from "./KOStage/KORoundTab";
import FinalStandings from "./FinalStandings/FinalStandings";

export default function Running() {
    const navigate = useNavigate();
    const { tournamentId, mode, stage } = useParams();
    const { currentTournamentId } = useTournament();

    const [status, setStatus] = useState("");
    const [koRounds, setKoRounds] = useState(0);
    const [hasThirdPlace, setHasThirdPlace] = useState(false);
    const [tournamentMode, setTournamentMode] = useState("roundrobin");

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const isViewMode = mode === "view";

    const statusLabelMap = {
        group: "Vorrunde",
        finished: "Beendet",
        ...Object.fromEntries(
            Array.from({ length: 6 }, (_, i) => [
                `ko_${i + 1}`,
                koRoundLabel(koRounds, i + 1)
            ])
        )
    };

    const statusColorMap = {
        group: "default",
        finished: "success",
        ...Object.fromEntries(
            Array.from({ length: 6 }, (_, i) => [`ko_${i + 1}`, i + 1 === koRounds ? "secondary" : "primary"])
        )
    };

    // Tabs dynamisch aufbauen
    // [ { label, stage } ]
    const tabs = [
        ...(tournamentMode === "directko" ? [] : [{ label: "Vorrunde", stage: "preliminary" }]),
        ...Array.from({ length: koRounds }, (_, i) => ({
            label: koRoundLabel(koRounds, i + 1),
            stage: koStageKey(i + 1)
        })),
        { label: "Abschlusstabelle", stage: "standings" }
    ];

    const tabValue = tabs.findIndex(t => t.stage === stage) ?? 0;

    useEffect(() => {
        if (!currentTournamentId) return;

        // Turnierdaten laden (koRounds, hasThirdPlace)
        getTournamentData(currentTournamentId).then(data => {
            if (!data) return;
            setKoRounds(data.koRounds ?? 0);
            setHasThirdPlace(data.hasThirdPlace ?? false);
            setTournamentMode(data.mode ?? "roundrobin");
        });

        const unsubscribe = subscribeTournamentStatus(currentTournamentId, setStatus);
        return () => unsubscribe();
    }, [currentTournamentId]);

    const handleTabChange = (_, newTabValue) => {
        const newStage = tabs[newTabValue]?.stage ?? "preliminary";
        navigate(`/tournament/${tournamentId}/${mode}/running/${newStage}`);
    };

    const handleExport = async () => {
        exportTournamentResults(currentTournamentId, status);
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
                value={tabValue === -1 ? 0 : tabValue}
                onChange={handleTabChange}
                tabs={tabs}
                variant={isMobile ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                sx={{ width: "100%" }}
            />

            <Box mt={3}>
                {stage === "preliminary" && (
                    <Preliminary isViewMode={isViewMode} />
                )}
                {Array.from({ length: koRounds }, (_, i) => {
                    const roundIndex = i + 1;
                    const roundStage = koStageKey(roundIndex);
                    return stage === roundStage && (
                        <KORoundTab
                            key={roundStage}
                            isViewMode={isViewMode}
                            roundIndex={roundIndex}
                            koRounds={koRounds}
                            hasThirdPlace={hasThirdPlace}
                            stageKey={roundStage}
                        />
                    );
                })}
                {stage === "standings" && (
                    <FinalStandings isViewMode={isViewMode} />
                )}
            </Box>

            <Fab
                color="primary"
                onClick={handleExport}
                sx={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000 }}
            >
                <DownloadIcon />
            </Fab>
        </PageContainer>
    );
}
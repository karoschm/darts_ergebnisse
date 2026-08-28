import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, useTheme, useMediaQuery } from "@mui/material";
import Fab from "@mui/material/Fab";
import DownloadIcon from "@mui/icons-material/Download";

import { useTournament } from "../../context/TournamentContext";
import {
    subscribeTournamentStatus, getTournamentData, koRoundLabel, koStageKey,
    loserRoundLabel, loserStageKey, loserStatusKey, getLbSchedule,
    GRAND_FINAL_STAGE, GRAND_FINAL_RESET_STAGE, GRAND_FINAL_STATUS, GRAND_FINAL_RESET_STATUS
} from "../../services/firestoreService";
import { exportTournamentResults } from "../../services/exportService";

import PageContainer from "../PageContainer";
import HeaderBar from "../HeaderBar";
import TournamentTabs from "../TournamentTabs";
import Preliminary from "./Preliminary/Preliminary";
import KORoundTab from "./KOStage/KORoundTab";
import GrandFinalTab from "./KOStage/GrandFinalTab";
import FinalStandings from "./FinalStandings/FinalStandings";

export default function Running() {
    const navigate = useNavigate();
    const { tournamentId, mode, stage } = useParams();
    const { currentTournamentId } = useTournament();

    const [status, setStatus] = useState("");
    const [koRounds, setKoRounds] = useState(0);
    const [hasThirdPlace, setHasThirdPlace] = useState(false);
    const [tournamentMode, setTournamentMode] = useState("roundrobin");
    const [koFormat, setKoFormat] = useState("single");
    const [bracketReset, setBracketReset] = useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const isViewMode = mode === "view";
    const isDoubleElim = tournamentMode === "directko" && koFormat === "double";
    const lbSchedule = isDoubleElim ? getLbSchedule(koRounds) : [];

    const statusLabelMap = {
        group: "Vorrunde",
        finished: "Beendet",
        ...Object.fromEntries(
            Array.from({ length: 6 }, (_, i) => [
                `ko_${i + 1}`,
                koRoundLabel(koRounds, i + 1)
            ])
        ),
        ...(isDoubleElim ? {
            ...Object.fromEntries(
                lbSchedule.map((_, i) => [loserStatusKey(i + 1), loserRoundLabel(koRounds, i + 1)])
            ),
            [GRAND_FINAL_STATUS]: "Grand Final",
            ...(bracketReset ? { [GRAND_FINAL_RESET_STATUS]: "Grand Final (Reset)" } : {})
        } : {})
    };

    const statusColorMap = {
        group: "default",
        finished: "success",
        ...Object.fromEntries(
            Array.from({ length: 6 }, (_, i) => [`ko_${i + 1}`, i + 1 === koRounds ? "secondary" : "primary"])
        ),
        ...(isDoubleElim ? {
            ...Object.fromEntries(lbSchedule.map((_, i) => [loserStatusKey(i + 1), "primary"])),
            [GRAND_FINAL_STATUS]: "secondary",
            ...(bracketReset ? { [GRAND_FINAL_RESET_STATUS]: "secondary" } : {})
        } : {})
    };

    // Tabs dynamisch aufbauen
    // [ { label, stage } ]
    const tabs = [
        ...(tournamentMode === "directko" ? [] : [{ label: "Vorrunde", stage: "preliminary" }]),
        ...Array.from({ length: koRounds }, (_, i) => ({
            label: koRoundLabel(koRounds, i + 1),
            stage: koStageKey(i + 1)
        })),
        ...(isDoubleElim ? lbSchedule.map((_, i) => ({
            label: loserRoundLabel(koRounds, i + 1),
            stage: loserStageKey(i + 1)
        })) : []),
        ...(isDoubleElim ? [
            { label: "Grand Final", stage: GRAND_FINAL_STAGE },
            ...(bracketReset ? [{ label: "Grand Final (Reset)", stage: GRAND_FINAL_RESET_STAGE }] : [])
        ] : []),
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
            setKoFormat(data.koFormat ?? "single");
            setBracketReset(data.bracketReset ?? false);
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
                            bracket="winner"
                            koFormat={koFormat}
                        />
                    );
                })}
                {isDoubleElim && lbSchedule.map((_, i) => {
                    const roundIndex = i + 1;
                    const roundStage = loserStageKey(roundIndex);
                    return stage === roundStage && (
                        <KORoundTab
                            key={roundStage}
                            isViewMode={isViewMode}
                            roundIndex={roundIndex}
                            koRounds={koRounds}
                            hasThirdPlace={false}
                            stageKey={roundStage}
                            bracket="loser"
                            koFormat={koFormat}
                        />
                    );
                })}
                {isDoubleElim && (stage === GRAND_FINAL_STAGE || stage === GRAND_FINAL_RESET_STAGE) && (
                    <GrandFinalTab
                        key={stage}
                        isViewMode={isViewMode}
                        stageKey={stage}
                        bracketReset={bracketReset}
                    />
                )}
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
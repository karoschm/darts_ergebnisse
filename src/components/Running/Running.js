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

    const wbStages = Array.from({ length: koRounds }, (_, i) => koStageKey(i + 1));
    const lbStages = lbSchedule.map((_, i) => loserStageKey(i + 1));
    const gfStages = isDoubleElim ? [GRAND_FINAL_STAGE, ...(bracketReset ? [GRAND_FINAL_RESET_STAGE] : [])] : [];

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

    // Nicht-Doppel-KO: flache Tab-Leiste wie bisher (Vorrunde + eine Reihe WB-Runden).
    const flatTabs = [
        ...(tournamentMode === "directko" ? [] : [{ label: "Vorrunde", stage: "preliminary" }]),
        ...wbStages.map((s, i) => ({ label: koRoundLabel(koRounds, i + 1), stage: s })),
        { label: "Abschlusstabelle", stage: "standings" }
    ];
    const flatTabValue = flatTabs.findIndex(t => t.stage === stage);

    // Doppel-KO: zweistufige Tab-Navigation — Übertabs für Gewinner-/Verlierer-
    // Bracket/Grand Final/Abschlusstabelle, darunter eine Rundenauswahl-Leiste für
    // die jeweils aktive Gruppe. Vermeidet eine einzelne, bei großen Turnieren sehr
    // lange Tab-Leiste und macht "WB kommt vor LB" durch die reine Gruppierung
    // trivial (kein Interleaving der einzelnen Runden mehr nötig).
    const topLevelTabs = [
        { label: "Gewinner-Bracket", stage: "wb-group" },
        { label: "Verlierer-Bracket", stage: "lb-group" },
        { label: "Grand Final", stage: "gf-group" },
        { label: "Abschlusstabelle", stage: "standings" }
    ];
    const activeGroup = wbStages.includes(stage) ? "wb"
        : lbStages.includes(stage) ? "lb"
        : gfStages.includes(stage) ? "gf"
        : stage === "standings" ? "standings"
        : "wb";
    const topLevelValue = topLevelTabs.findIndex(t => t.stage === (activeGroup === "standings" ? "standings" : `${activeGroup}-group`));

    const wbSubTabs = wbStages.map((s, i) => ({ label: koRoundLabel(koRounds, i + 1), stage: s }));
    const lbSubTabs = lbStages.map((s, i) => ({ label: loserRoundLabel(koRounds, i + 1), stage: s }));
    const gfSubTabs = gfStages.map(s => ({ label: s === GRAND_FINAL_STAGE ? "Grand Final" : "Grand Final (Reset)", stage: s }));
    const activeSubTabs = activeGroup === "wb" ? wbSubTabs : activeGroup === "lb" ? lbSubTabs : activeGroup === "gf" ? gfSubTabs : [];
    const subTabValue = activeSubTabs.findIndex(t => t.stage === stage);

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

    const handleFlatTabChange = (_, newTabValue) => {
        const newStage = flatTabs[newTabValue]?.stage ?? "preliminary";
        navigate(`/tournament/${tournamentId}/${mode}/running/${newStage}`);
    };

    const handleTopLevelChange = (_, newIndex) => {
        const group = topLevelTabs[newIndex];
        let targetStage = "standings";
        if (group.stage === "wb-group") targetStage = wbStages[0] ?? "standings";
        else if (group.stage === "lb-group") targetStage = lbStages[0] ?? GRAND_FINAL_STAGE;
        else if (group.stage === "gf-group") targetStage = GRAND_FINAL_STAGE;
        navigate(`/tournament/${tournamentId}/${mode}/running/${targetStage}`);
    };

    const handleSubTabChange = (_, newIndex) => {
        const newStage = activeSubTabs[newIndex]?.stage;
        if (newStage) navigate(`/tournament/${tournamentId}/${mode}/running/${newStage}`);
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

            {isDoubleElim ? (
                <>
                    <TournamentTabs
                        value={topLevelValue === -1 ? 0 : topLevelValue}
                        onChange={handleTopLevelChange}
                        tabs={topLevelTabs}
                        top={72}
                        zIndex={10}
                    />
                    {activeSubTabs.length > 0 && (
                        <TournamentTabs
                            value={subTabValue === -1 ? 0 : subTabValue}
                            onChange={handleSubTabChange}
                            tabs={activeSubTabs}
                            top={120}
                            zIndex={9}
                        />
                    )}
                </>
            ) : (
                <TournamentTabs
                    value={flatTabValue === -1 ? 0 : flatTabValue}
                    onChange={handleFlatTabChange}
                    tabs={flatTabs}
                />
            )}

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

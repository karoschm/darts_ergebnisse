import { Button, List, ListItem, ListItemText, IconButton, Typography } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTournament } from "../../context/TournamentContext";
import {
    getAllTeams,
    getTournamentData,
    generateFirstKORoundFromSeed,
    updateTournamentStatus,
    nextStatus,
    koStageKey
} from "../../services/firestoreService";

function shuffle(list) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export default function DirectKOSeeding() {
    const navigate = useNavigate();
    const { currentTournamentId } = useTournament();
    const [seededTeams, setSeededTeams] = useState([]);
    const [koRounds, setKoRounds] = useState(0);
    const [hasThirdPlace, setHasThirdPlace] = useState(false);
    const [seedingMode, setSeedingMode] = useState("random");

    useEffect(() => {
        if (!currentTournamentId) return;

        async function fetchData() {
            const data = await getTournamentData(currentTournamentId);
            setKoRounds(data?.koRounds ?? 0);
            setHasThirdPlace(data?.hasThirdPlace ?? false);
            setSeedingMode(data?.seeding ?? "random");

            const teams = (await getAllTeams(currentTournamentId))
                .filter(t => !t.isBye)
                .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

            setSeededTeams(data?.seeding === "manual" ? teams : shuffle(teams));
        }
        fetchData();
    }, [currentTournamentId]);

    const bracketSize = Math.pow(2, koRounds);
    const byeCount = Math.max(0, bracketSize - seededTeams.length);

    const handleShuffle = () => setSeededTeams(prev => shuffle(prev));

    const moveTeam = (index, direction) => {
        setSeededTeams(prev => {
            const target = index + direction;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const handleStart = async () => {
        await generateFirstKORoundFromSeed(
            currentTournamentId,
            seededTeams.map(t => t.id),
            koRounds,
            hasThirdPlace
        );
        await updateTournamentStatus(currentTournamentId, nextStatus("setup", koRounds, "directko"));
        navigate(`/tournament/${currentTournamentId}/edit/running/${koStageKey(1)}`);
    };

    return (
        <div
            style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "40px"
            }}
        >
            <h2>Setzliste</h2>
            <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
                {seedingMode === "manual"
                    ? "Reihenfolge per Pfeiltasten festlegen. Platz 1 spielt gegen den letzten Platz, usw."
                    : "Zufällige Auslosung. Über \"Neu auslosen\" kann die Ziehung wiederholt werden."}
                {byeCount > 0 && ` Die besten ${byeCount} Teams bekommen ein Freilos in der ersten Runde.`}
            </Typography>

            {seedingMode === "random" && (
                <Button startIcon={<ShuffleIcon />} onClick={handleShuffle} sx={{ mb: 2 }}>
                    Neu auslosen
                </Button>
            )}

            <List sx={{ width: "100%", maxWidth: 400 }}>
                {seededTeams.map((team, index) => (
                    <ListItem
                        key={team.id}
                        secondaryAction={
                            seedingMode === "manual" && (
                                <>
                                    <IconButton
                                        size="small"
                                        disabled={index === 0}
                                        onClick={() => moveTeam(index, -1)}
                                    >
                                        <ArrowUpwardIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        disabled={index === seededTeams.length - 1}
                                        onClick={() => moveTeam(index, 1)}
                                    >
                                        <ArrowDownwardIcon fontSize="small" />
                                    </IconButton>
                                </>
                            )
                        }
                    >
                        <ListItemText
                            primary={`${index + 1}. ${team.name || team.id}`}
                            secondary={index < byeCount ? "Freilos in Runde 1" : undefined}
                        />
                    </ListItem>
                ))}
            </List>

            <br />
            <Button
                variant="contained"
                onClick={handleStart}
                disabled={seededTeams.length === 0}
            >
                Turnier starten
            </Button>
        </div>
    );
}

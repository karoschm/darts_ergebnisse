import {
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllTournaments, getTournamentStatus } from "../../services/firestoreService";
import { useTournamentAuth } from "../../hooks/useTournamentAuth";
import PinDialog from "../../components/PinDialog";

export default function LoadTournamentSetup() {
    const navigate = useNavigate();
    const [tournaments, setTournaments] = useState([]);
    const [selectedTournament, setSelectedTournament] = useState("");
    const [pinDialogOpen, setPinDialogOpen] = useState(false);

    const { unlock } = useTournamentAuth(selectedTournament);

    const stateMapping = {
        setup:    "Nicht gestartet",
        group:    "Gruppenphase",
        qf:       "Viertelfinale",
        sf:       "Halbfinale",
        final:    "Finale",
        finished: "Abgeschlossen"
    };

    const statusToStage = {
        setup:    "preliminary",
        group:    "preliminary",
        qf:       "quarterfinal",
        sf:       "semifinal",
        final:    "final",
        finished: "standings"
    };

    useEffect(() => {
        async function fetchData() {
            const loadedTournaments = await getAllTournaments();
            setTournaments(loadedTournaments);
        }
        fetchData();
    }, []);

    const navigateToTournament = async (mode) => {
        const status = await getTournamentStatus(selectedTournament);
        const stage = statusToStage[status] ?? "preliminary";
        navigate(`/tournament/${selectedTournament}/${mode}/running/${stage}`);
    };

    const handleLoadTournamentForEdit = (e) => {
        e.preventDefault();
        if (!selectedTournament) return;
        setPinDialogOpen(true);
    };

    const handleLoadTournamentForView = (e) => {
        e.preventDefault();
        if (!selectedTournament) return;
        navigateToTournament("view");
    };

    const handlePinSuccess = () => {
        unlock();
        setPinDialogOpen(false);
        navigateToTournament("edit");
    };

    const handlePinCancel = () => {
        setPinDialogOpen(false);
    };

    return (
        <>
            <form
                style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    padding: "80px"
                }}
            >
                <div>Bitte wähle das Turnier aus, das du laden möchtest</div>
                <br />
                <br />

                <FormControl sx={{ minWidth: 250 }}>
                    <InputLabel>Turnier (Fortschritt)</InputLabel>
                    <Select
                        value={selectedTournament}
                        label="Turnier"
                        onChange={(e) => setSelectedTournament(e.target.value)}
                    >
                        {tournaments.map((tournament) => (
                            <MenuItem key={tournament.id} value={tournament.id}>
                                {tournament.id} ({stateMapping[tournament.status]})
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <br />
                <br />

                <Button onClick={handleLoadTournamentForEdit} disabled={!selectedTournament}>
                    Turnier im Bearbeitungsmodus laden
                </Button>
                <br /><br />

                <Button onClick={handleLoadTournamentForView} disabled={!selectedTournament}>
                    Turnier im Ansichtsmodus laden
                </Button>
            </form>

            <PinDialog
                open={pinDialogOpen}
                tournamentId={selectedTournament}
                onSuccess={handlePinSuccess}
                onCancel={handlePinCancel}
            />
        </>
    );
}
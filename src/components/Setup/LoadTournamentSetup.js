import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteTournament, getAllTournaments, getTournamentData, statusToStage } from "../../services/firestoreService";
import { useTournamentAuth } from "../../hooks/useTournamentAuth";
import PinDialog from "../PinDialog";

export default function LoadTournamentSetup() {
    const navigate = useNavigate();
    const [tournaments, setTournaments] = useState([]);
    const [selectedTournament, setSelectedTournament] = useState("");

    // Welche Aktion wurde ausgelöst? "edit" | "delete" | null
    const [pendingAction, setPendingAction] = useState(null);

    const [pinDialogOpen, setPinDialogOpen] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const { unlock } = useTournamentAuth(selectedTournament);

    const stateMapping = {
        setup:    "Nicht gestartet",
        group:    "Gruppenphase",
        qf:       "Viertelfinale",
        sf:       "Halbfinale",
        final:    "Finale",
        finished: "Abgeschlossen"
    };

    useEffect(() => {
        fetchTournaments();
    }, []);

    async function fetchTournaments() {
        const loadedTournaments = await getAllTournaments();
        setTournaments(loadedTournaments);
    }

    const navigateToTournament = async (mode) => {
        const data = await getTournamentData(selectedTournament);
        const stage = statusToStage(data?.status, data?.koRounds ?? 0, data?.mode ?? "roundrobin", data?.koFormat ?? "single");
        navigate(`/tournament/${selectedTournament}/${mode}/running/${stage}`);
    };

    // ── Edit & Delete: PIN zuerst ───────────────────────────────────────────
    const handleLoadTournamentForEdit = (e) => {
        e.preventDefault();
        if (!selectedTournament) return;
        setPendingAction("edit");
        setPinDialogOpen(true);
    };

    // ── View ────────────────────────────────────────────────────────────────
    const handleLoadTournamentForView = (e) => {
        e.preventDefault();
        if (!selectedTournament) return;
        navigateToTournament("view");
    };

    const handleDeleteClick = (e) => {
        e.preventDefault();
        if (!selectedTournament) return;
        setPendingAction("delete");
        setPinDialogOpen(true);
    };

    // PIN korrekt → je nach pendingAction weiterleiten
    const handlePinSuccess = () => {
        setPinDialogOpen(false);
        if (pendingAction === "edit") {
            unlock();
            navigateToTournament("edit");
        } else if (pendingAction === "delete") {
            // Bestätigungsdialog zeigen
            setConfirmDialogOpen(true);
        }
        setPendingAction(null);
    };

    const handlePinCancel = () => {
        setPinDialogOpen(false);
        setPendingAction(null);
    };

    // ── Bestätigung Löschen ─────────────────────────────────────────────────
    const handleConfirmDelete = async () => {
        setDeleteLoading(true);
        try {
            await deleteTournament(selectedTournament);
            setSelectedTournament("");
            await fetchTournaments();
        } finally {
            setDeleteLoading(false);
            setConfirmDialogOpen(false);
        }
    };

    const handleCancelDelete = () => {
        setConfirmDialogOpen(false);
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

                <Button
                    onClick={handleLoadTournamentForEdit}
                    disabled={!selectedTournament}
                >
                    Turnier im Bearbeitungsmodus laden
                </Button>
                <br />
                <br />

                <Button
                    onClick={handleLoadTournamentForView}
                    disabled={!selectedTournament}
                >
                    Turnier im Ansichtsmodus laden
                </Button>
                <br />
                <br />

                <Button
                    onClick={handleDeleteClick}
                    disabled={!selectedTournament}
                    color="error"
                    variant="outlined"
                >
                    Turnier löschen
                </Button>
            </form>

            {/* PIN-Dialog (für Edit und Delete) */}
            <PinDialog
                open={pinDialogOpen}
                tournamentId={selectedTournament}
                onSuccess={handlePinSuccess}
                onCancel={handlePinCancel}
            />

            {/* Bestätigungsdialog Löschen */}
            <Dialog open={confirmDialogOpen} onClose={handleCancelDelete} maxWidth="xs" fullWidth>
                <DialogTitle>Turnier wirklich löschen?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Das Turnier <strong>{selectedTournament}</strong> und alle zugehörigen Daten
                        werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDelete} disabled={deleteLoading}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        color="error"
                        variant="contained"
                        disabled={deleteLoading}
                    >
                        {deleteLoading ? "Wird gelöscht..." : "Endgültig löschen"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
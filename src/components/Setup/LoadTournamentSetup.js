import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    CircularProgress
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllTournaments, verifyPin } from "../../services/firestoreService";
import { useTournamentAuth } from "../../hooks/useTournamentAuth";

export default function LoadTournamentSetup() {
    const navigate = useNavigate();
    const [tournaments, setTournaments] = useState([]);
    const [selectedTournament, setSelectedTournament] = useState("");

    const [pinDialogOpen, setPinDialogOpen] = useState(false);
    const [pin, setPin] = useState("");
    const [pinError, setPinError] = useState("");
    const [pinLoading, setPinLoading] = useState(false);

    const { unlock } = useTournamentAuth(selectedTournament);

    const stateMapping = {
        "setup": "Nicht gestartet",
        "group": "Gruppenphase",
        "qf": "Viertelfinale",
        "sf": "Halbfinale",
        "final": "Finale",
        "finished": "Abgeschlossen"
    };

    useEffect(() => {
        async function fetchData() {
            const loadedTournaments = await getAllTournaments();
            setTournaments(loadedTournaments);
        }
        fetchData();
    }, []);

    // ── Edit-Modus: PIN-Dialog öffnen ───────────────────────────────────────
    const handleLoadTournamentForEdit = (e) => {
        e.preventDefault();
        if (!selectedTournament) return;
        setPin("");
        setPinError("");
        setPinDialogOpen(true);
    };

    // ── View-Modus: kein PIN nötig ──────────────────────────────────────────
    const handleLoadTournamentForView = (e) => {
        e.preventDefault();
        if (!selectedTournament) return;
        navigate(`/tournament/${selectedTournament}/view/running/preliminary`);
    };

    const handlePinChange = (e) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, 4);
        setPin(value);
        setPinError("");
    };

    const handlePinSubmit = async () => {
        if (pin.length !== 4) {
            setPinError("Bitte gib einen 4-stelligen PIN ein.");
            return;
        }

        setPinLoading(true);
        try {
            const valid = await verifyPin(selectedTournament, pin);
            if (valid) {
                unlock();
                setPinDialogOpen(false);
                navigate(`/tournament/${selectedTournament}/edit/running/preliminary`);
            } else {
                setPinError("Falscher PIN. Bitte versuche es erneut.");
            }
        } catch {
            setPinError("Fehler bei der Überprüfung. Bitte versuche es erneut.");
        } finally {
            setPinLoading(false);
        }
    };

    const handlePinKeyDown = (e) => {
        if (e.key === "Enter") handlePinSubmit();
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

            {/* ── PIN-Dialog ──────────────────────────────────────────────── */}
            <Dialog
                open={pinDialogOpen}
                onClose={() => setPinDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>PIN eingeben</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        type="password"
                        label="PIN (4 Ziffern)"
                        value={pin}
                        onChange={handlePinChange}
                        onKeyDown={handlePinKeyDown}
                        inputProps={{ inputMode: "numeric", maxLength: 4 }}
                        error={!!pinError}
                        helperText={pinError || " "}
                        fullWidth
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPinDialogOpen(false)} disabled={pinLoading}>
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handlePinSubmit}
                        disabled={pin.length !== 4 || pinLoading}
                        variant="contained"
                    >
                        {pinLoading ? <CircularProgress size={20} /> : "Bestätigen"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
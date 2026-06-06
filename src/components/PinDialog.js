import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField
} from "@mui/material";
import { useState } from "react";
import { verifyPin } from "../services/firestoreService";

export default function PinDialog({ open, tournamentId, onSuccess, onCancel }) {
    const [pin, setPin] = useState("");
    const [pinError, setPinError] = useState("");
    const [loading, setLoading] = useState(false);

    const handlePinChange = (e) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, 4);
        setPin(value);
        setPinError("");
    };

    const handleSubmit = async () => {
        if (pin.length !== 4) {
            setPinError("Bitte gib einen 4-stelligen PIN ein.");
            return;
        }

        setLoading(true);
        try {
            const valid = await verifyPin(tournamentId, pin);
            if (valid) {
                setPin("");
                onSuccess();
            } else {
                setPinError("Falscher PIN. Bitte versuche es erneut.");
            }
        } catch {
            setPinError("Fehler bei der Überprüfung. Bitte versuche es erneut.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setPin("");
        setPinError("");
        onCancel();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSubmit();
    };

    return (
        <Dialog open={open} onClose={handleCancel} maxWidth="xs" fullWidth>
            <DialogTitle>PIN eingeben</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    type="password"
                    label="PIN (4 Ziffern)"
                    value={pin}
                    onChange={handlePinChange}
                    onKeyDown={handleKeyDown}
                    inputProps={{ inputMode: "numeric", maxLength: 4 }}
                    error={!!pinError}
                    helperText={pinError || " "}
                    fullWidth
                    sx={{ mt: 1 }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCancel} disabled={loading}>
                    Abbrechen
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={pin.length !== 4 || loading}
                    variant="contained"
                >
                    {loading ? <CircularProgress size={20} /> : "Bestätigen"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
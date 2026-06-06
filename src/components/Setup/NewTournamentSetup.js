import { Button, TextField, useTheme, useMediaQuery } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useFormStatus from "../../hooks/useFormStatus";
import { addTournament } from "../../services/firestoreService";
import { useTournamentAuth } from "../../hooks/useTournamentAuth";

export default function NewTournamentSetup() {
    const navigate = useNavigate();
    const { errorMessage, showError } = useFormStatus();

    const [numberTeams, setNumberTeams] = useState(8);
    const [numberMatchdays, setNumberMatchdays] = useState(1);
    const [tournamentName, setTournamentName] = useState("");
    const [pin, setPin] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const { unlock } = useTournamentAuth(tournamentName.trim());

    const handlePinChange = (e) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, 4);
        setPin(value);
    };

    const handlePinConfirmChange = (e) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, 4);
        setPinConfirm(value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedTournamentName = tournamentName.trim();

        if (pin.length !== 4) return showError("Der PIN muss genau 4 Ziffern haben.");
        if (pin !== pinConfirm) return showError("Die PINs stimmen nicht überein.");

        const tournamentID = await addTournament(trimmedTournamentName, numberTeams, numberMatchdays, pin);

        if (tournamentID === trimmedTournamentName) {
            unlock();
            navigate(`/tournament/${tournamentID}/teams`);
        } else if (tournamentID === `${trimmedTournamentName}_EXISTS`) {
            return showError("Turniername bereits vorhanden!");
        } else {
            return showError("Fehler bei der Turniererstellung!");
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
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
            <h1>Turnier konfigurieren</h1>

            <label>Wie viele Teams nehmen teil?</label>
            <TextField
                type="number"
                value={numberTeams}
                onChange={e => setNumberTeams(e.target.value)}
                inputProps={{ min: 8 }}
                label="Anzahl Teams"
            />
            <br />
            <br />

            <label>Wie viele Spieltage soll die Vorrunde haben?</label>
            <TextField
                type="number"
                value={numberMatchdays}
                onChange={e => setNumberMatchdays(e.target.value)}
                inputProps={{ min: 1, max: numberTeams - 1 }}
                label="Anzahl Spieltage Vorrunde"
            />
            <br />
            <br />

            <label>Bitte wähle einen Namen für das Turnier</label>
            <TextField
                value={tournamentName}
                onChange={e => setTournamentName(e.target.value)}
                label="Turniername"
            />
            <br />
            <br />

            <label>PIN für die Bearbeitung (4 Ziffern)</label>
            <TextField
                type="password"
                value={pin}
                onChange={handlePinChange}
                label="PIN"
                inputProps={{ inputMode: "numeric", maxLength: 4 }}
                helperText="Nur Ziffern, genau 4 Stellen"
            />

            <TextField
                type="password"
                value={pinConfirm}
                onChange={handlePinConfirmChange}
                label="PIN bestätigen"
                inputProps={{ inputMode: "numeric", maxLength: 4 }}
            />
            <br />
            <br />

            <Button type="submit">Turnier erstellen</Button>

            {errorMessage && (
                <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>
            )}
        </form>
    );
}
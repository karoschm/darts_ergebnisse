import { Button, Checkbox, FormControlLabel, MenuItem, Select, TextField, FormControl, InputLabel, useTheme, useMediaQuery } from "@mui/material";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useFormStatus from "../../hooks/useFormStatus";
import { addTournament } from "../../services/firestoreService";
import { useTournamentAuth } from "../../hooks/useTournamentAuth";

const KO_ROUND_OPTIONS = [
    { label: "Keine KO-Runde", rounds: 0 },
    { label: "Finale",         rounds: 1 },
    { label: "Halbfinale",     rounds: 2 },
    { label: "Viertelfinale",  rounds: 3 },
    { label: "Achtelfinale",   rounds: 4 },
    { label: "Last 32",        rounds: 5 },
    { label: "Last 64",        rounds: 6 },
];

export default function NewTournamentSetup() {
    const navigate = useNavigate();
    const { errorMessage, showError } = useFormStatus();

    const [numberTeams, setNumberTeams] = useState(8);
    const [numberMatchdays, setNumberMatchdays] = useState(1);
    const [tournamentName, setTournamentName] = useState("");
    const [koRounds, setKoRounds] = useState(3);
    const [hasThirdPlace, setHasThirdPlace] = useState(true);
    const [pin, setPin] = useState("");
    const [pinConfirm, setPinConfirm] = useState("");

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const { unlock } = useTournamentAuth(tournamentName.trim());

    // Nur Optionen anzeigen bei denen 2^rounds <= teamCount
    const availableKoOptions = useMemo(() => {
        return KO_ROUND_OPTIONS.filter(opt => Math.pow(2, opt.rounds) <= numberTeams);
    }, [numberTeams]);

    // Falls aktuell gewählte Option durch Teamanzahl-Änderung ungültig wird → zurücksetzen
    const handleTeamCountChange = (e) => {
        const newCount = Number(e.target.value);
        setNumberTeams(newCount);
        if (Math.pow(2, koRounds) > newCount) {
            // Auf größte noch mögliche Option zurücksetzen
            const maxValid = Math.floor(Math.log2(newCount));
            setKoRounds(maxValid);
        }
    };

    const handlePinChange = (e) => {
        setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
    };

    const handlePinConfirmChange = (e) => {
        setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const trimmedName = tournamentName.trim();
        if (pin.length !== 4) return showError("Der PIN muss genau 4 Ziffern haben.");
        if (pin !== pinConfirm) return showError("Die PINs stimmen nicht überein.");

        const tournamentID = await addTournament(
            trimmedName, numberTeams, numberMatchdays, koRounds, hasThirdPlace, pin
        );

        if (tournamentID === trimmedName) {
            unlock();
            navigate(`/tournament/${tournamentID}/teams`);
        } else if (tournamentID === `${trimmedName}_EXISTS`) {
            return showError("Turniername bereits vorhanden!");
        } else {
            return showError("Fehler bei der Turniererstellung!");
        }
    };

    const qualifiedTeams = Math.pow(2, koRounds);

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
                onChange={handleTeamCountChange}
                inputProps={{ min: 2 }}
                label="Anzahl Teams"
            />
            <br /><br />

            <label>Wie viele Spieltage soll die Vorrunde haben?</label>
            <TextField
                type="number"
                value={numberMatchdays}
                onChange={e => setNumberMatchdays(e.target.value)}
                inputProps={{ min: 1, max: numberTeams - 1 }}
                label="Anzahl Spieltage Vorrunde"
            />
            <br /><br />

            <label>Bei welcher Stufe soll die KO-Runde beginnen?</label>
            <br />
            <FormControl sx={{ minWidth: 220 }}>
                <InputLabel>KO-Runde beginnen bei</InputLabel>
                <Select
                    value={koRounds}
                    label="KO-Runde beginnen bei"
                    onChange={e => setKoRounds(Number(e.target.value))}
                >
                    {availableKoOptions.map(opt => (
                        <MenuItem key={opt.rounds} value={opt.rounds}>
                            {opt.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            {koRounds > 0 && (
                <div style={{ marginTop: 8, fontSize: "0.85rem", opacity: 0.7 }}>
                    {qualifiedTeams} Teams qualifizieren sich für die KO-Runde
                </div>
            )}
            <br />

            {koRounds > 0 && (
                <>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={hasThirdPlace}
                                onChange={e => setHasThirdPlace(e.target.checked)}
                            />
                        }
                        label="Spiel um Platz 3"
                    />
                    <br />
                </>
            )}
            <br />

            <label>Bitte wähle einen Namen für das Turnier</label>
            <TextField
                value={tournamentName}
                onChange={e => setTournamentName(e.target.value)}
                label="Turniername"
            />
            <br /><br />

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
            <br /><br />

            <Button type="submit">Turnier erstellen</Button>

            {errorMessage && (
                <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>
            )}
        </form>
    );
}
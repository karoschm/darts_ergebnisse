import { Button, TextField, useTheme, useMediaQuery } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useFormStatus from "../../hooks/useFormStatus";
import { addTournament } from "../../services/firestoreService";


export default function NewTournamentSetup() {
    const navigate = useNavigate();
    const { errorMessage, showError } = useFormStatus();

    const [numberTeams, setNumberTeams] = useState(8);
    const [numberMatchdays, setNumberMatchdays] = useState(1);
    const [tournamentName, setTournamentName] = useState("");

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedTournamentName = tournamentName.trim()
        const tournamentID = await addTournament(trimmedTournamentName, numberTeams, numberMatchdays);
        if (tournamentID === trimmedTournamentName) {

            navigate(`/tournament/${tournamentID}/teams`);
        } else if (tournamentID === `${trimmedTournamentName}_EXISTS`) return showError("Turniername bereits vorhanden!");
        else return showError("Fehler bei der Turniererstellung!");
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
            <label>
                Wie viele Teams nehmen teil?
            </label>
            <br />
            <TextField
                type={"number"}
                value={numberTeams}
                onChange={e => setNumberTeams(e.target.value)}
                inputProps={{ min: 8 }}
                label="Anzahl Teams"
            />
            <br />
            <br />
            <label>
                Wie viele Spieltage soll die Vorrunde haben?
            </label>
            <br />
            <TextField
                type={"number"}
                value={numberMatchdays}
                onChange={e => setNumberMatchdays(e.target.value)}
                inputProps={{ min: 1, max: numberTeams - 1 }}
                label="Anzahl Spieltage Vorrunde"
            />
            <br />
            <br />
            <label>
                Bitte wähle einen Namen für das Turnier
            </label>
            <br />
            <TextField
                value={tournamentName}
                onChange={e => setTournamentName(e.target.value)}
                label="Turniername"
            />
            <br />
            <br />
            <Button type="submit">
                Turnier erstellen
            </Button>
            {errorMessage && <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>}
        </form>
    );
}
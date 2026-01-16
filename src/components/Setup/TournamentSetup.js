import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTournament } from "../../context/TournamentContext";
import useFormStatus from "../../hooks/useFormStatus";
import { addTournament } from "../../services/firestoreService";

export default function TournamentSetup() {
    const navigate = useNavigate();
    const { setCurrentTournamentId } = useTournament();
    const { errorMessage, showError } = useFormStatus();

    const [numberTeams, setNumberTeams] = useState(8);
    const [numberMatchdays, setNumberMatchdays] = useState(1);
    const [tournamentName, setTournamentName] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedTournamentName = tournamentName.trim()
        const tournamentID = await addTournament(trimmedTournamentName, numberTeams, numberMatchdays);
        if (tournamentID === trimmedTournamentName) {
            setCurrentTournamentId(tournamentID);

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
                padding: "0 20px"
            }}
        >
            <label>
                Wie viele Teams nehmen teil?
            </label>
            <br />
            <input
                type={"number"}
                value={numberTeams}
                onChange={e => setNumberTeams(e.target.value)}
                min={8}
            />
            <br />
            <br />
            <label>
                Wie viele Spieltage soll die Vorrunde haben?
            </label>
            <br />
            <input
                type={"number"}
                value={numberMatchdays}
                onChange={e => setNumberMatchdays(e.target.value)}
                min={1}
                max={numberTeams - 1}
            />
            <br />
            <br />
            <label>
                Bitte wähle einen Namen für das Turnier
            </label>
            <br />
            <input
                value={tournamentName}
                onChange={e => setTournamentName(e.target.value)}
            />
            <br />
            <br />
            <button type="submit">
                Turnier erstellen
            </button>
            {errorMessage && <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>}
        </form>
    );
}
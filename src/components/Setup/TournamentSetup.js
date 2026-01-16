import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTournament } from "../../context/TournamentContext";
import { addTournament } from "../../services/firestoreService";

export default function TournamentSetup() {
    const navigate = useNavigate();
    const { setCurrentTournamentId } = useTournament();
    const [numberTeams, setNumberTeams] = useState(2);
    const [numberMatchdays, setNumberMatchdays] = useState(1);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const tournamentID = await addTournament(numberTeams, numberMatchdays);
        setCurrentTournamentId(tournamentID);

        navigate(`/tournament/${tournamentID}/teams`);
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
                min={2}
            />
            <br></br>
            <br></br>
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
            <br></br>
            <br></br>
            <button type="submit">
                Turnier erstellen
            </button>
        </form>
    );
}
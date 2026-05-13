import { Button, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllTournaments } from "../../services/firestoreService";

export default function LoadTournamentSetup() {
    const navigate = useNavigate();
    const [tournaments, setTournaments] = useState([]);
    const [selectedTournament, setSelectedTournament] = useState("");

    const stateMapping = {
        "setup": "Nicht gestartet",
        "group": "Gruppenphase",
        "qf": "Viertelfinale",
        "sf": "Halbfinale",
        "final": "Finale",
        "finished": "Abgeschlossen"
    }

    useEffect(() => {
        async function fetchData() {
            const loadedTournaments = await getAllTournaments();
            setTournaments(loadedTournaments);
        }

        fetchData();
    }, []);

    const handleLoadTournamentForEdit = (e) => {
        e.preventDefault();

        if (!selectedTournament) return;

        navigate(`/tournament/${selectedTournament}/edit/running`);
    }

    const handleLoadTournamentForView = (e) => {
        e.preventDefault();

        if (!selectedTournament) return;

        navigate(`/tournament/${selectedTournament}/view/running`);
    }

    return (
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
            <br/>
            <br/>
            <FormControl sx={{ minWidth: 250 }}>
                <InputLabel>Turnier (Fortschritt)</InputLabel>

                <Select
                    value={selectedTournament}
                    label="Turnier"
                    onChange={(e) =>
                        setSelectedTournament(e.target.value)
                    }
                >
                    {tournaments.map((tournament) => (
                        <MenuItem
                            key={tournament.id}
                            value={tournament.id}
                        >
                            {tournament.id} ({stateMapping[tournament.status]})
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <br/>
            <br/>
            <Button onClick={handleLoadTournamentForEdit}>
                Turnier im Bearbeitungsmodus laden
            </Button>
            <br/>
            <Button onClick={handleLoadTournamentForView}>
                Turnier im Ansichtsmodus laden
            </Button>
        </form>
    )
}
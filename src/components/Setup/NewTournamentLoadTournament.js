import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function NewTournamentLoadTournament() {
    const navigate = useNavigate();

    const handleNewTournament = (e) => {
        e.preventDefault();
        navigate(`/newtournament`);
    }

    const handleLoadTournament = (e) => {
        e.preventDefault();
        navigate(`/loadtournament`);
    }

    return (
        <form
            style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "40px"
            }}
        >
            <Button
                key={"new_tournament"}
                onClick={handleNewTournament}
            >
                Neues Turnier erstellen
            </Button>
            <br/>
            <Button
                key={"load_tournament"}
                onClick={handleLoadTournament}
            >
                Vorhandenes Turnier laden
            </Button>
            <br/>
        </form>
    )
}
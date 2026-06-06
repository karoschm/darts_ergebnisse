import { Button, Tooltip } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useNavigate } from "react-router-dom";
import { useThemeMode } from "../../context/ThemeContext";

export default function NewTournamentLoadTournament() {
    const { darkMode, toggleDarkMode } = useThemeMode();
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
            
            <Tooltip title={darkMode ? "Zum Lightmode wechseln" : "Zum Darkmode wechseln"}>
                <IconButton onClick={toggleDarkMode}>
                    {darkMode ? (
                        <LightModeIcon />
                    ) : (
                        <DarkModeIcon />
                    )}
                </IconButton>
            </Tooltip>
            <br />
            <br />
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
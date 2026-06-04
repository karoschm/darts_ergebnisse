import { Box, Typography, Chip, Button } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import IconButton from "@mui/material/IconButton";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useThemeMode } from "../context/ThemeContext";

export default function HeaderBar({ tournamentId, status, statusLabelMap, statusColorMap, isViewMode }) {
    const { darkMode, toggleDarkMode } = useThemeMode();

    return (
        <Box
            sx={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                backgroundColor: "background.paper",
                borderBottom: 1,
                borderColor: "divider",
                py: 2,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 2,
            }}
        >
            <Typography variant="h5">
                {tournamentId}
            </Typography>

            <Chip
                label={statusLabelMap[status]}
                color={statusColorMap[status]}
                size="small"
            />

            <IconButton onClick={toggleDarkMode}>
                {darkMode ? (
                    <LightModeIcon />
                ) : (
                    <DarkModeIcon />
                )}
            </IconButton>
        </Box>
    );
}

import { Box, Typography, Chip, Button } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

export default function HeaderBar({ tournamentId, status, statusLabelMap, statusColorMap, isViewMode }) {
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

            {/* {isViewMode && (
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => window.location.reload()}
                >
                    Aktualisieren
                </Button>
            )} */}
        </Box>
    );
}

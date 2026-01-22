import { Box, Typography, Chip } from "@mui/material";

export default function HeaderBar({ tournamentId, status, statusLabelMap, statusColorMap }) {
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
        </Box>
    );
}

import { Box, Card, Typography } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

const podiumConfig = [
    { place: 2, color: "#C0C0C0", height: 140 },
    { place: 1, color: "#FFD700", height: 180 },
    { place: 3, color: "#CD7F32", height: 120 },
];

export default function Podium({ teams }) {
    // teams = [{ id, name }] in Reihenfolge [1,2,3]
    const ordered = [teams[1], teams[0], teams[2]];

    return (
        <Box
            display="flex"
            justifyContent="center"
            alignItems="flex-end"
            gap={2}
            mb={4}
        >
            {podiumConfig.map((cfg, index) => (
                <div>
                    <Typography variant="h4" align="center">
                        {ordered[index]}
                    </Typography>
                    <Card
                        key={cfg.place}
                        sx={{
                            width: 160,
                            height: cfg.height,
                            bgcolor: cfg.color,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 3,
                        }}
                    >
                        {cfg.place === 1 && (
                            <EmojiEventsIcon sx={{ fontSize: 40, mb: 1 }} />
                        )}
                        <Typography variant="h4">
                            {cfg.place}
                        </Typography>
                    </Card>
                </div>
            ))}
        </Box>
    );
}

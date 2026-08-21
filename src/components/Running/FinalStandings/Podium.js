import { Box, Card, Typography, useTheme, useMediaQuery } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

export default function Podium({ teams }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const podiumConfig = (isMobile ? [
        { place: 1, color: "#FFD700", height: 160 },
        { place: 2, color: "#C0C0C0", height: 160 },
        { place: 3, color: "#CD7F32", height: 160 },
    ] : (teams.length === 2 ?
        [
            { place: 1, color: "#FFD700", height: 180 },
            { place: 2, color: "#C0C0C0", height: 140 },
        ] : [
            { place: 2, color: "#C0C0C0", height: 140 },
            { place: 1, color: "#FFD700", height: 180 },
            { place: 3, color: "#CD7F32", height: 120 },
        ]
    )).filter(cfg => teams[cfg.place - 1] !== undefined);

    return isMobile ? (
        <div>
            {podiumConfig.map((cfg) => (
                <div key={cfg.place}>
                    <Card
                        sx={{
                            width: 250,
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
                        <Typography variant="h5">
                            {cfg.place}. {teams[cfg.place - 1]}
                        </Typography>
                    </Card>
                    <br />
                </div>
            ))}
        </div>
    ) : (
        <Box
            display="flex"
            justifyContent="center"
            alignItems="flex-end"
            gap={2}
            mb={4}
        >
            {podiumConfig.map((cfg) => (
                <div key={cfg.place}>
                    <Typography variant="h5" align="center" sx={{
                        width: 200,
                        whiteSpace: "normal",
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                    }}>
                        {teams[cfg.place - 1]}
                    </Typography>
                    <Card
                        sx={{
                            width: 200,
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

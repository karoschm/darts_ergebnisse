import { Box } from "@mui/material";

export default function PageContainer({ children }) {
    return (
        <Box
            sx={{
                maxWidth: 1200,
                mx: "auto",
                px: 2,
                py: 3,
            }}
        >
            {children}
        </Box>
    );
}

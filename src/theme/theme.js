import { createTheme } from "@mui/material/styles";

const theme = createTheme({
    palette: {
        primary: {
            main: "#0f5132",
        },
        secondary: {
            main: "#dc3545",
        },
        background: {
            default: "#f7f9fc",
            paper: "#ffffff",
        },
    },

    typography: {
        fontFamily: "Roboto, Arial, sans-serif",
        h1: {
            fontSize: "2rem",
            fontWeight: 600
        },
        h2: {
            fontSize: "1.5rem",
            fontWeight: 500
        },
        h5: {
            fontWeight: 600,
        },
    },

    components: {
        MuiButton: {
            defaultProps: {
                variant: "outlined"
            },
            styleOverrides: {
                root: {
                    padding: "3px 8px",
                    textTransform: "none",
                    borderRadius: "6px"
                },
            },
        },
        MuiTextField: {
            defaultProps: {
                variant: "standard",
                size: "small",
            },
        },
        MuiTabs: {
            styleOverrides: {
                root: {
                    backgroundColor: "#fff",
                    borderBottom: "1px solid #e0e0e0",
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 500,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 500,
                },
            },
        },
        MuiTable: {
            styleOverrides: {
                root: {
                    tableLayout: "fixed",
                    width: "60%",
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    whiteSpace: "normal",
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                    padding: "12px 3px"
                }
            }
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    borderBottom: "2px solid #0f5132"
                }
            }
        }
    },
});

export default theme;

import { createTheme } from "@mui/material/styles";

export const getTheme = (mode) =>
    createTheme({
        palette: {
            mode,
            ...(mode === "dark"
                ? {
                    background: {
                        default: "#121212",
                        paper: "#1e1e1e",
                    },
                }
                : {
                    background: {
                        default: "#f5f5f5",
                        paper: "#ffffff",
                    },
                }),
            primary: {
                main: "#0f5132",
            },
            secondary: {
                main: "#dc3545",
            },
        },

        breakpoints: {
            values: {
                xs: 0,
                sm: 600,
                md: 900,
                lg: 1200,
                xl: 1536,
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
                    autoComplete: "off",
                },
            },
            MuiTabs: {
                styleOverrides: {
                    root: {
                        ...(mode === "dark"
                            ? {
                                background: {
                                    default: "#121212",
                                    paper: "#1e1e1e",
                                },
                                borderBottom: "1px solid #1e1e1e",
                            }
                            : {
                                background: {
                                    default: "#f5f5f5",
                                    paper: "#ffffff",
                                },
                                borderBottom: "1px solid #e0e0e0",
                            }),
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
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        ...(mode === "dark"
                            ? {
                                background: {
                                    default: "#121212",
                                    paper: "#1e1e1e",
                                },
                                border: "1px solid #121212",
                            }
                            : {
                                background: "#f7f9fc",
                                border: "1px solid #ccc",
                            }),
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 12,
                    }
                }
            }
        },
    });

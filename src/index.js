import ReactDOM from "react-dom/client";
import App from "./App";

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { useMemo } from "react";

import { ThemeProviderCustom, useThemeMode } from "./context/ThemeContext";
import { getTheme } from "./theme/theme";

function AppWithTheme() {
  const { darkMode } = useThemeMode();

  const theme = useMemo(
    () => getTheme(darkMode ? "dark" : "light"),
    [darkMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}
const root = ReactDOM.createRoot(
  document.getElementById("root")
);

root.render(
  <ThemeProviderCustom>
    <AppWithTheme />
  </ThemeProviderCustom>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();

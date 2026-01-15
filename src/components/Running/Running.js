import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useState } from "react";
import Preliminary from "./Preliminary/Preliminary";
import QuarterfinalTab from "./KOStage/QuarterfinalTab";
import SemifinalTab from "./KOStage/SemifinalTab";
import FinalTab from "./KOStage/FinalTab";

export default function Running() {
    const [tabValue, setTabValue] = useState(0);

    const handleTabChange = (event, newTabValue) => {
        setTabValue(newTabValue);
    }

    return (
        <div>
            <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="fullWidth"
            >
                <Tab label={"Vorrunde"} value={0} />
                <Tab label={"Viertelfinale"} value={1} />
                <Tab label={"Halbfinale"} value={2} />
                <Tab label={"Finale"} value={3} />
            </Tabs>
            {tabValue === 0 && <Preliminary/>}
            {tabValue === 1 && <QuarterfinalTab/>}
            {tabValue === 2 && <SemifinalTab/>}
            {tabValue === 3 && <FinalTab/>}
        </div>
    )
}
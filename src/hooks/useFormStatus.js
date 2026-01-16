import { useState } from "react";

export default function useFormStatus() {
    const [errorMessage, setErrorMessage] = useState("");

    const showError = (msg, timeout = 3000) => {
        setErrorMessage(msg);
        setTimeout(() => setErrorMessage(""), timeout);
    };

    return { errorMessage, showError };
}
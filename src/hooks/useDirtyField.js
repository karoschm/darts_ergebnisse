import { useCallback, useRef } from "react";

// Hält Felder fest, die lokal bearbeitet/gespeichert wurden, aber vom Server
// noch nicht bestätigt sind ("matchKey_feld" -> Wert). Ein eingehender Snapshot
// überschreibt so lange nicht diesen Wert, bis der Server denselben Wert liefert
// (verhindert, dass parallele Schreibvorgänge anderer Geräte laufende Eingaben
// oder frisch gespeicherte, aber noch nicht zurückgespiegelte Werte überschreiben).
export default function useDirtyField() {
    const dirtyFieldsRef = useRef({});

    const markDirty = useCallback((entryKey, field, value) => {
        dirtyFieldsRef.current[`${entryKey}_${field}`] = value;
    }, []);

    const mergeSnapshot = useCallback((incomingEntries) => {
        const dirty = dirtyFieldsRef.current;
        const merged = {};
        for (const [entryKey, incomingEntry] of Object.entries(incomingEntries)) {
            merged[entryKey] = { ...incomingEntry };
            for (const field of Object.keys(incomingEntry)) {
                const dirtyKey = `${entryKey}_${field}`;
                if (dirtyKey in dirty) {
                    if (dirty[dirtyKey] === incomingEntry[field]) {
                        delete dirty[dirtyKey];
                    } else {
                        merged[entryKey][field] = dirty[dirtyKey];
                    }
                }
            }
        }
        return merged;
    }, []);

    return { markDirty, mergeSnapshot };
}

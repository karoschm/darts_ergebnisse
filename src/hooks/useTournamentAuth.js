export function useTournamentAuth(tournamentId) {
    const key = `pin_${tournamentId}`;

    const isUnlocked = () => sessionStorage.getItem(key) === "true";

    const unlock = () => sessionStorage.setItem(key, "true");

    const lock = () => sessionStorage.removeItem(key);

    return { isUnlocked, unlock, lock };
}
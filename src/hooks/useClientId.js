const CLIENT_ID_KEY = "clientId";

// Pro Browser-Tab eindeutig (sessionStorage, im Gegensatz zu localStorage nicht
// tab-übergreifend geteilt) — im Unterschied zur Firebase-Anonymous-Auth-uid, die
// pro Browser (nicht pro Tab) gilt und daher zwei Tabs derselben Person fälschlich
// als "dasselbe Gerät" erscheinen lässt.
export function getClientId() {
    let id = sessionStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
}

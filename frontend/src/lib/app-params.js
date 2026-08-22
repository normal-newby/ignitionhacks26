/**
 * Configuration for the base44 SDK client. Vite only exposes VITE_-prefixed
 * vars to client code; all four are optional, since the client is created with
 * requiresAuth: false and talks to this app's own backend.
 */
export const appParams = {
    appId: import.meta.env.VITE_BASE44_APP_ID ?? '',
    token: import.meta.env.VITE_BASE44_TOKEN ?? '',
    functionsVersion: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION ?? '',
    appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL ?? '',
};

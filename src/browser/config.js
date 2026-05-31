// App configuration (read from the environment): Éléa URL and offline base URL,
// auto-login credentials, and constants (snapshot key, log cap).
const DEFAULT_MEMORIZATION_URL = 'https://dev.elea.apps.education.fr/local/memorization/index.php';
const DEFAULT_MEMORIZATION_BASE_URL = 'https://dev.elea.apps.education.fr/';

export const MEMORIZATION_URL = process.env.EXPO_PUBLIC_MEMORIZATION_URL || DEFAULT_MEMORIZATION_URL;
export const MEMORIZATION_BASE_URL = process.env.EXPO_PUBLIC_MEMORIZATION_BASE_URL || DEFAULT_MEMORIZATION_BASE_URL;
export const MEMORIZATION_OFFLINE_HTML_KEY = '__memo_offline_html_v1__';

// Credentials via .env (see .env.example); auto-login disabled when absent.
export const LOGIN_USERNAME = process.env.EXPO_PUBLIC_ELEA_LOGIN_USERNAME || '';
export const LOGIN_PASSWORD = process.env.EXPO_PUBLIC_ELEA_LOGIN_PASSWORD || '';
export const AUTO_LOGIN_ENABLED = Boolean(LOGIN_USERNAME && LOGIN_PASSWORD);

export const MAX_DEBUG_LOGS = 250;

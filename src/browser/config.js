const DEFAULT_MEMORIZATION_URL = 'https://dev.elea.apps.education.fr/local/memorization/index.php';
const DEFAULT_MEMORIZATION_BASE_URL = 'https://dev.elea.apps.education.fr/';

export const MEMORIZATION_URL = process.env.EXPO_PUBLIC_MEMORIZATION_URL || DEFAULT_MEMORIZATION_URL;
export const MEMORIZATION_BASE_URL = process.env.EXPO_PUBLIC_MEMORIZATION_BASE_URL || DEFAULT_MEMORIZATION_BASE_URL;
export const MEMORIZATION_OFFLINE_HTML_KEY = '__memo_offline_html_v1__';

export const LOGIN_USERNAME = process.env.EXPO_PUBLIC_ELEA_LOGIN_USERNAME || 'student@linagora.com';
export const LOGIN_PASSWORD = process.env.EXPO_PUBLIC_ELEA_LOGIN_PASSWORD || '***REMOVED***';
export const AUTO_LOGIN_ENABLED = Boolean(LOGIN_USERNAME && LOGIN_PASSWORD);

export const MAX_DEBUG_LOGS = 250;

import { getAccessToken } from '@base44/sdk';

const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	window.localStorage.removeItem('base44_access_token');
	window.localStorage.removeItem('token');
}

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	return {
		appId: import.meta.env.VITE_BASE44_APP_ID || '6ab67b6426d6d79f38b501aa',
		token: getAccessToken() || import.meta.env.VITE_BASE44_API_KEY || 'b44u_cc486ce1a750e45838830113774c1f0b99d3d93c40f276deaab61f01760a45b6',
		functionsVersion: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION,
		appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL,
	}
}


export const appParams = {
	...getAppParams()
}

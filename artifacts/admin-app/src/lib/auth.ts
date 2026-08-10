import { setAuthTokenGetter } from '@workspace/api-client-react';

export const TOKEN_KEY = 'artech_admin_token';

// Set up the API client token getter
setAuthTokenGetter(() => {
  return localStorage.getItem(TOKEN_KEY);
});

export const setAuthToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

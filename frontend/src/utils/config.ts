import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

export const API_BASE_URL: string = (extra.apiBaseUrl as string) ?? 'http://192.168.3.4:8000/api';
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.1.0';
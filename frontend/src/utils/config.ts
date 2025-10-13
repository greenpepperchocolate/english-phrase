import Constants from 'expo-constants';

// babel-plugin-inline-dotenvが process.env.API_BASE_URL を実際の値に置き換えます
export const API_BASE_URL: string = process.env.API_BASE_URL || 'http://192.168.3.4:8000/api';
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.1.0';

// デバッグ用: 実際のAPIのURLを確認
console.log('🔧 API_BASE_URL:', API_BASE_URL);
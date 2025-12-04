import Constants from 'expo-constants';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';

// react-native-dotenvが @env から環境変数をインポートします
export const API_BASE_URL: string = ENV_API_BASE_URL || 'http://192.168.3.4:8000/api';
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.1.0';

// デバッグ用: 実際のAPIのURLを確認
console.log('🔧 API_BASE_URL:', API_BASE_URL);
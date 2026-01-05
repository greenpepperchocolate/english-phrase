import Constants from 'expo-constants';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';

// react-native-dotenvが @env から環境変数をインポートします
// 末尾スラッシュを除去（設定ミスでURLが壊れないように）
export const API_BASE_URL: string = (ENV_API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.1.0';

// デバッグ用: 開発環境のみログ出力
if (__DEV__) {
  console.log('🔧 API_BASE_URL:', API_BASE_URL);
}

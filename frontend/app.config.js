export default {
  expo: {
    name: '映単語',
    slug: 'eitango',
    version: '1.0.0',
    scheme: 'eitango',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0d1b2a',
    },
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'jp.aiworks.eitango',
      buildNumber: '2',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
    },
    plugins: [
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
          },
        },
      ],
      'expo-asset',
      'expo-router',
      // Sentry設定（本番ビルド時のみ有効化）
      // 本番ビルドを作成する際は、以下のコメントを解除してください
      // [
      //   '@sentry/react-native/expo',
      //   {
      //     organization: 'your-sentry-org',
      //     project: 'eitango',
      //   }
      // ],
    ],
    extra: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://10.0.2.2:8000/api',
      eas: {
        projectId: '942fbebf-5724-4aa5-a297-c163b6e5b2a8',
      },
    },
  },
};

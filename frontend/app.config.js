export default {
  expo: {
    name: '映単語',
    slug: 'eitango',
    version: '1.0.1',
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
      url: 'https://u.expo.dev/942fbebf-5724-4aa5-a297-c163b6e5b2a8',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'jp.aiworks.eitango',
      buildNumber: '3',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleURLTypes: [
          {
            CFBundleURLName: 'jp.aiworks.eitango',
            CFBundleURLSchemes: ['eitango'],
          },
          {
            CFBundleURLName: 'com.googleusercontent.apps.384167074200-2llae64j272arbhca63cl815cq37o270',
            CFBundleURLSchemes: [
              'com.googleusercontent.apps.384167074200-2llae64j272arbhca63cl815cq37o270',
            ],
          },
        ],
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
      'expo-web-browser',
      'expo-apple-authentication',
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: 'com.googleusercontent.apps.384167074200-2llae64j272arbhca63cl815cq37o270',
        },
      ],
    ],
    extra: {
      apiBaseUrl: process.env.API_BASE_URL || 'http://10.0.2.2:8000/api',
      googleClientIdIOS: process.env.GOOGLE_CLIENT_ID_IOS || '',
      googleClientIdWeb: process.env.GOOGLE_CLIENT_ID_WEB || '',
      eas: {
        projectId: '942fbebf-5724-4aa5-a297-c163b6e5b2a8',
      },
    },
  },
};

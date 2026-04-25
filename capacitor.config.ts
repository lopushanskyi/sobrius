import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sobrius.app',
  appName: 'Sobrius',
  webDir: 'dist',
  android: {
    backgroundColor: '#fbf7f0'
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;

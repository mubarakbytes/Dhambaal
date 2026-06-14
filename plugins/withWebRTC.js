const { withInfoPlist, withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Local Expo Config Plugin for react-native-webrtc.
 * Bypasses the broken upstream npm package.
 */
function withWebRTC(config, props = {}) {
  const cameraPermission = props.cameraPermission || 'Allow $(PRODUCT_NAME) to access your camera';
  const microphonePermission = props.microphonePermission || 'Allow $(PRODUCT_NAME) to access your microphone';

  // 1. iOS Config: Info.plist
  config = withInfoPlist(config, (config) => {
    config.modResults.NSCameraUsageDescription = cameraPermission;
    config.modResults.NSMicrophoneUsageDescription = microphonePermission;

    if (!config.modResults.UIBackgroundModes) {
      config.modResults.UIBackgroundModes = [];
    }
    if (!config.modResults.UIBackgroundModes.includes('voip')) {
      config.modResults.UIBackgroundModes.push('voip');
    }
    if (!config.modResults.UIBackgroundModes.includes('audio')) {
      config.modResults.UIBackgroundModes.push('audio');
    }

    return config;
  });

  // 2. Android Config: AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const androidPermissions = [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.BLUETOOTH',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.INTERNET',
    ];

    androidPermissions.forEach((permission) => {
      AndroidConfig.Permissions.addPermission(config.modResults, permission);
    });

    return config;
  });

  return config;
}

module.exports = withWebRTC;

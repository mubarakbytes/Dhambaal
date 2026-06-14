const { withAndroidManifest } = require('@expo/config-plugins');

function withNotifee(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    
    if (!app.service) {
      app.service = [];
    }

    let notifeeService = app.service.find(
      (s) => s.$['android:name'] === 'app.notifee.core.ForegroundService'
    );

    if (!notifeeService) {
      notifeeService = {
        $: {
          'android:name': 'app.notifee.core.ForegroundService',
          'android:foregroundServiceType': 'dataSync',
          'tools:replace': 'android:foregroundServiceType'
        }
      };
      app.service.push(notifeeService);
    } else {
      notifeeService.$['android:foregroundServiceType'] = 'dataSync';
      notifeeService.$['tools:replace'] = 'android:foregroundServiceType';
    }

    return config;
  });
}

module.exports = withNotifee;

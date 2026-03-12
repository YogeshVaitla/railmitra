/* global __dirname, require, module */
/**
 * Expo Config Plugin — withNearbyConnections
 * 
 * Automatically injects our native Nearby Connections module during 'expo prebuild'.
 * 
 * What it does:
 * 1. Copies NearbyModule.kt and NearbyPackage.kt into the android project
 * 2. Adds Google Play Services Nearby dependency to build.gradle
 * 3. Adds required permissions to AndroidManifest.xml
 * 4. Registers NearbyPackage in MainApplication.kt
 */

const { withDangerousMod, withAndroidManifest, withMainApplication } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// The Kotlin source files live next to this plugin file
const PLUGIN_DIR = __dirname;
const NEARBY_MODULE_SRC = path.join(PLUGIN_DIR, 'nearby', 'NearbyModule.kt');
const NEARBY_PACKAGE_SRC = path.join(PLUGIN_DIR, 'nearby', 'NearbyPackage.kt');

/**
 * Main plugin entry point
 */
function withNearbyConnections(config) {
    // Step 1: Copy native files + add Gradle dependency
    config = withDangerousMod(config, ['android', async (modConfig) => {
        const projectRoot = modConfig.modRequest.projectRoot;
        const androidDir = path.join(projectRoot, 'android');

        // Create the nearby package directory
        const nearbyDir = path.join(
            androidDir, 'app', 'src', 'main', 'java', 'com', 'railmitra', 'app', 'nearby'
        );
        fs.mkdirSync(nearbyDir, { recursive: true });

        // Copy Kotlin files
        fs.copyFileSync(NEARBY_MODULE_SRC, path.join(nearbyDir, 'NearbyModule.kt'));
        fs.copyFileSync(NEARBY_PACKAGE_SRC, path.join(nearbyDir, 'NearbyPackage.kt'));

        // Add Nearby Connections dependency to build.gradle
        const buildGradlePath = path.join(androidDir, 'app', 'build.gradle');
        let buildGradle = fs.readFileSync(buildGradlePath, 'utf-8');

        const nearbyDep = '    implementation("com.google.android.gms:play-services-nearby:19.3.0")';

        if (!buildGradle.includes('play-services-nearby')) {
            // Insert after the react-android dependency
            buildGradle = buildGradle.replace(
                'implementation("com.facebook.react:react-android")',
                'implementation("com.facebook.react:react-android")\n' + nearbyDep
            );
            fs.writeFileSync(buildGradlePath, buildGradle);
        }

        return modConfig;
    }]);

    // Step 2: Add permissions to AndroidManifest
    config = withAndroidManifest(config, (modConfig) => {
        const manifest = modConfig.modResults.manifest;

        const permissions = [
            'android.permission.ACCESS_FINE_LOCATION',
            'android.permission.ACCESS_COARSE_LOCATION',
            'android.permission.BLUETOOTH',
            'android.permission.BLUETOOTH_ADMIN',
            'android.permission.BLUETOOTH_SCAN',
            'android.permission.BLUETOOTH_ADVERTISE',
            'android.permission.BLUETOOTH_CONNECT',
            'android.permission.ACCESS_WIFI_STATE',
            'android.permission.CHANGE_WIFI_STATE',
            'android.permission.NEARBY_WIFI_DEVICES',
        ];

        const existingPermissions = (manifest['uses-permission'] || [])
            .map(p => p.$['android:name']);

        for (const perm of permissions) {
            if (!existingPermissions.includes(perm)) {
                manifest['uses-permission'] = manifest['uses-permission'] || [];
                manifest['uses-permission'].push({
                    $: { 'android:name': perm }
                });
            }
        }

        return modConfig;
    });

    // Step 3: Register NearbyPackage in MainApplication.kt
    config = withDangerousMod(config, ['android', async (modConfig) => {
        const projectRoot = modConfig.modRequest.projectRoot;
        const mainAppPath = path.join(
            projectRoot, 'android', 'app', 'src', 'main', 'java',
            'com', 'railmitra', 'app', 'MainApplication.kt'
        );

        let mainApp = fs.readFileSync(mainAppPath, 'utf-8');

        // Add import if not present
        const importLine = 'import com.railmitra.app.nearby.NearbyPackage';
        if (!mainApp.includes(importLine)) {
            mainApp = mainApp.replace(
                'import expo.modules.ApplicationLifecycleDispatcher',
                importLine + '\nimport expo.modules.ApplicationLifecycleDispatcher'
            );
        }

        // Add package registration if not present
        const addLine = '              add(NearbyPackage())';
        if (!mainApp.includes('NearbyPackage()')) {
            mainApp = mainApp.replace(
                '// Packages that cannot be autolinked yet can be added manually here, for example:',
                '// Packages that cannot be autolinked yet can be added manually here, for example:\n' + addLine
            );
        }

        fs.writeFileSync(mainAppPath, mainApp);

        return modConfig;
    }]);

    return config;
}

module.exports = withNearbyConnections;

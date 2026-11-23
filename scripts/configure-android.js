import fs from 'fs';
import path from 'path';

console.log('[configure-android] Starting Android project configuration...');

const genDir = path.resolve('src-tauri/gen/android');
try {
  if (!fs.existsSync(genDir)) {
    fs.mkdirSync(genDir, { recursive: true });
  }
} catch (e) {
  console.log('[configure-android] Note creating genDir:', e.message);
}

// 1. Setup release keystore.properties
try {
  const keystorePropPath = path.join(genDir, 'keystore.properties');
  const keystorePropContent = `storePassword=hikaproj2026
keyPassword=hikaproj2026
keyAlias=fxtweet
storeFile=release.jks
`;
  fs.writeFileSync(keystorePropPath, keystorePropContent, 'utf-8');
  console.log('[configure-android] Created keystore.properties');
} catch (e) {
  console.log('[configure-android] Note writing keystore.properties:', e.message);
}

// 2. Inject signingConfigs into build.gradle.kts
const gradlePath = path.join(genDir, 'app/build.gradle.kts');
if (fs.existsSync(gradlePath)) {
  try {
    let gradleContent = fs.readFileSync(gradlePath, 'utf-8');
    if (!gradleContent.includes('signingConfigs')) {
      const signingBlock = `
    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            val keystoreProperties = java.util.Properties()
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(java.io.FileInputStream(keystorePropertiesFile))
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }
`;
      gradleContent = gradleContent.replace('buildTypes {', signingBlock + '\n    buildTypes {');
      gradleContent = gradleContent.replace(
        'getByName("release") {',
        'getByName("release") {\n            signingConfig = signingConfigs.getByName("release")'
      );
      fs.writeFileSync(gradlePath, gradleContent, 'utf-8');
      console.log('[configure-android] Injected signingConfigs into app/build.gradle.kts');
    }
  } catch (e) {
    console.log('[configure-android] Note updating build.gradle.kts:', e.message);
  }
} else {
  console.log('[configure-android] Note: app/build.gradle.kts not present yet.');
}

// 3. Inject Kotlin sources (MainActivity & FxTweetForegroundService)
const pkgDir = path.join(
  genDir,
  'app/src/main/java/com/hikaproj/app/mobile/pubtweetoutputter'
);
try {
  if (!fs.existsSync(pkgDir)) {
    fs.mkdirSync(pkgDir, { recursive: true });
  }

  const srcMainActivity = path.resolve('src-tauri/mobile/android/MainActivity.kt');
  const srcService = path.resolve('src-tauri/mobile/android/FxTweetForegroundService.kt');

  if (fs.existsSync(srcMainActivity)) {
    fs.copyFileSync(srcMainActivity, path.join(pkgDir, 'MainActivity.kt'));
    console.log('[configure-android] Injected MainActivity.kt');
  }
  if (fs.existsSync(srcService)) {
    fs.copyFileSync(srcService, path.join(pkgDir, 'FxTweetForegroundService.kt'));
    console.log('[configure-android] Injected FxTweetForegroundService.kt');
  }
} catch (e) {
  console.log('[configure-android] Note injecting Kotlin sources:', e.message);
}

// 4. Update AndroidManifest.xml
const manifestPath = path.join(genDir, 'app/src/main/AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  try {
    let manifestContent = fs.readFileSync(manifestPath, 'utf-8');

    // Strip package="..." attribute on <manifest> for AGP 8+ compliance
    manifestContent = manifestContent.replace(/(<manifest[^>]*?)\s+package="[^"]*"/g, '$1');

    const perms = [
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
      '<uses-permission android:name="android.permission.WAKE_LOCK" />',
      '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
      '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />',
      '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
      '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />'
    ];

    for (const p of perms) {
      if (!manifestContent.includes(p)) {
        manifestContent = manifestContent.replace('<application', p + '\n    <application');
      }
    }

    const serviceDecl = '<service android:name=".FxTweetForegroundService" android:exported="false" android:foregroundServiceType="dataSync" />';
    if (!manifestContent.includes(serviceDecl)) {
      manifestContent = manifestContent.replace('</application>', '    ' + serviceDecl + '\n    </application>');
    }

    if (manifestContent.includes('android:name=".MainActivity"')) {
      manifestContent = manifestContent.replace(
        'android:name=".MainActivity"',
        'android:name=".MainActivity" android:resizeableActivity="true" android:supportsPictureInPicture="true"'
      );
    }

    fs.writeFileSync(manifestPath, manifestContent, 'utf-8');
    console.log('[configure-android] Configured AndroidManifest.xml for AGP 8+ & foldables');
  } catch (e) {
    console.log('[configure-android] Note updating AndroidManifest.xml:', e.message);
  }
} else {
  console.log('[configure-android] Note: AndroidManifest.xml not present yet.');
}

console.log('[configure-android] Completed Android project configuration successfully.');

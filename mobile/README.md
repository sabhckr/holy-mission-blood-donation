# Lakshmipur Blood — Android and iOS apps

The apps open the live website (`server.url` in `capacitor.config.json`) inside a native app, so
website changes reach the apps without a new build. People download the Android app from the
website's `/app` page.

## Release a new Android version

1. Raise `versionCode` (by one) and `versionName` in `android/app/build.gradle`.
2. From `mobile/`, copy settings into the Android project and build the signed APK:

   ```bash
   npx cap sync android
   cd android
   JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew assembleRelease
   ```

3. Copy `android/app/build/outputs/apk/release/app-release.apk` to
   `public/downloads/lakshmipur-blood.apk` in the website, and update the version and size in
   `src/components/site/android-app.ts`. Deploying the website publishes the new app.

## Signing key

Release builds are signed with `android/release.keystore`, whose passwords are in
`android/keystore.properties`. Neither is in git. Keep a backup of both: phones that have the app
only accept updates signed with the same key.

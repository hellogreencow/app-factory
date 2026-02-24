# Architecture

## Pipeline Flow

1. **Idea Agent**: Picks theme, outputs feature list (e.g. `["portfolio view", "add asset", "price chart"]`)
2. **Scaffold Agent**: `npx create-expo-app`, adds navigation, base layout
3. **Feature Agent**: Implements each feature (screens, API calls, state)
4. **Flow Agent**: Generates `flows/feature-*.yaml` from feature list + component tree
5. **Test Runner**: Boots simulator, installs app, runs `maestro test flows/`
6. **Report**: Pass/fail per flow file
7. **Fix Agent**: Parses failures, patches code or flows, retries
8. **Deploy Agent**: `eas build --platform ios` → `eas submit` to TestFlight

## Feature Extraction

- **Expo/React Navigation**: Parse route config, screen names
- **Component tree**: Buttons, inputs, links (static analysis or AST)
- **Manifest**: Optional `features.json` per app

## Flow Generation

- Input: feature description + element list
- Output: Maestro YAML (launch, tap, input, assert)
- Use `accessibilityLabel` and `testID` in app for stable selectors

## Simulator Control

```bash
xcrun simctl boot "iPhone 16 Pro"
xcrun simctl install booted ./path/to/app.app
maestro test flows/
```

## Cloud Devices (Optional)

- **BrowserStack** / **Sauce Labs**: Real devices, Appium/Maestro compatible
- Use when simulator isn't enough (push, camera, device-specific bugs)

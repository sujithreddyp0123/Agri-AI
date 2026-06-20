# React Native Path

The current `frontend/` React app is intentionally structured so the same screens and API contract can move into React Native.

Recommended mobile path:

1. Keep `backend/` exactly the same.
2. Create an Expo app.
3. Reuse these frontend concepts:
   - `src/api.js` API functions
   - farm context state
   - photo upload flow
   - fertilizer result rendering
4. Replace browser elements with React Native equivalents:
   - `input/select` -> native form controls or picker components
   - file upload -> `expo-image-picker`
   - CSS -> `StyleSheet`
   - bottom nav -> React Navigation tabs

Suggested command when ready:

```powershell
npx create-expo-app mobile-app
```

For the first MVP, the React web app is faster to test with your dad because it runs in a mobile browser and talks to the same real backend.

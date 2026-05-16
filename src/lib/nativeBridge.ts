export interface AndroidNativeInterface {
  requestPermission: (permissionName: string) => boolean;
  hasPermission: (permissionName: string) => boolean;
  openAppSettings: () => void;
  // Wake Word DSP functions (Low Power OS Level)
  startWakeWordDSP: (wakeWord: string) => void;
  stopWakeWordDSP: () => void;
  openIntent: (intentUri: string) => void;
}

declare global {
  interface Window {
    Android?: AndroidNativeInterface;
    triggerNativeAssistant?: (type: string) => void;
    // Callback from Native Android Layer when DSP detects the trigger
    onNativeWakeWordDetected?: (command: string) => void;
  }
}

export const isNativeAndroid = (): boolean => {
  return typeof window !== "undefined" && typeof window.Android !== "undefined";
};

export const startNativeWakeWord = (wakeWord: string, onDetected: (command: string) => void) => {
  if (isNativeAndroid() && window.Android?.startWakeWordDSP) {
    window.onNativeWakeWordDetected = onDetected;
    try {
      window.Android.startWakeWordDSP(wakeWord);
      return true;
    } catch (e) {
      console.error("Native Wake Word DSP failed to start:", e);
      return false;
    }
  }
  return false;
};

export const stopNativeWakeWord = () => {
  if (isNativeAndroid() && window.Android?.stopWakeWordDSP) {
    try {
      window.Android.stopWakeWordDSP();
      return true;
    } catch (e) {
      console.error("Native Wake Word DSP failed to stop:", e);
      return false;
    }
  }
  return false;
};

export const requestNativePermission = async (
  permissionName: string,
): Promise<boolean> => {
  if (isNativeAndroid()) {
    try {
      // Synchronous call to native Android JavascriptInterface
      const granted = window.Android!.requestPermission(permissionName);
      return granted;
    } catch (e) {
      console.error("Native permission request failed:", e);
      return false;
    }
  }

  // Standard Web fallback for testing
  return new Promise((resolve) => {
    if (
      window.confirm(
        `[Web Demo] The app is requesting native Android permission: ${permissionName.toUpperCase()}.\n\nIn a real APK, this would trigger the system permission dialog. Allow for testing?`,
      )
    ) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

export const checkNativePermission = (permissionName: string): boolean => {
  if (isNativeAndroid()) {
    try {
      return window.Android!.hasPermission(permissionName);
    } catch (e) {
      return false;
    }
  }
  return true; // Assume true in web mode if they checked the box
};

export const submitNativeIntent = (intentUri: string): boolean => {
  if (isNativeAndroid() && window.Android?.openIntent) {
    try {
      window.Android.openIntent(intentUri);
      return true;
    } catch (e) {
      console.error("Native intent failed to open:", e);
      return false;
    }
  }
  return false;
};

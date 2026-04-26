export interface AndroidNativeInterface {
  requestPermission: (permissionName: string) => boolean;
  hasPermission: (permissionName: string) => boolean;
  openAppSettings: () => void;
}

declare global {
  interface Window {
    Android?: AndroidNativeInterface;
    triggerNativeAssistant?: (type: string) => void;
  }
}

export const isNativeAndroid = (): boolean => {
  return typeof window !== "undefined" && typeof window.Android !== "undefined";
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const FIRST_LAUNCH_TUTORIAL_KEY = 'kasir-miso:first-launch-tutorial-completed';

export function isFirstLaunchTutorialPreviewEnabled(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('tutorial') === 'preview';
}

export async function hasCompletedFirstLaunchTutorial(): Promise<boolean> {
  return (await AsyncStorage.getItem(FIRST_LAUNCH_TUTORIAL_KEY)) === 'true';
}

export function completeFirstLaunchTutorial(): Promise<void> {
  return AsyncStorage.setItem(FIRST_LAUNCH_TUTORIAL_KEY, 'true');
}
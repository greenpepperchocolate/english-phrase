import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const MASTER_REVIEW_KEY = 'eitango_master_review_prompted_v1';
const MASTER_REVIEW_THRESHOLD = 10;

/**
 * Master達成数が閾値に到達したら、ネイティブレビューUIの表示を試みる。
 */
export async function maybeRequestMasteryReview(
  masteredCount: number
): Promise<void> {
  try {
    if (masteredCount < MASTER_REVIEW_THRESHOLD) return;

    const alreadyPrompted = await AsyncStorage.getItem(MASTER_REVIEW_KEY);
    if (alreadyPrompted === 'done') return;

    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) {
      await AsyncStorage.setItem(MASTER_REVIEW_KEY, 'done');
      return;
    }

    await StoreReview.requestReview();
    await AsyncStorage.setItem(MASTER_REVIEW_KEY, 'done');
  } catch (error) {
    console.warn('[ReviewPrompt] failed to request review:', error);
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const MANUAL_UNREAD_KEY = 'chat_manual_unread_rooms';

export const chatPersistence = {
  async getManualUnreadRoomIds(): Promise<Set<string>> {
    try {
      const stored = await AsyncStorage.getItem(MANUAL_UNREAD_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
      return new Set();
    } catch {
      return new Set();
    }
  },

  async setManualUnreadRoomIds(roomIds: Set<string>): Promise<void> {
    try {
      await AsyncStorage.setItem(MANUAL_UNREAD_KEY, JSON.stringify([...roomIds]));
    } catch {
      // Silent fail - non-critical
    }
  },

  async addManualUnreadRoom(roomId: string): Promise<void> {
    const current = await this.getManualUnreadRoomIds();
    current.add(roomId);
    await this.setManualUnreadRoomIds(current);
  },

  async removeManualUnreadRoom(roomId: string): Promise<void> {
    const current = await this.getManualUnreadRoomIds();
    current.delete(roomId);
    await this.setManualUnreadRoomIds(current);
  }
};
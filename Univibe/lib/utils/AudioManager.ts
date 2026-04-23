// lib/utils/AudioManager.ts

import { Audio } from 'expo-av';

class AudioManager {
  private currentSound: Audio.Sound | null = null;
  private currentMessageId: string | null = null;
  private listeners: Array<(messageId: string) => void> = [];

  /**
   * Register a callback to be called when audio is played
   */
  registerPlayCallback(callback: (messageId: string) => void) {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners that a new audio is playing
   */
  private notifyListeners(messageId: string) {
    this.listeners.forEach(callback => {
      try {
        callback(messageId);
      } catch (error) {
        // Ignore listener errors
      }
    });
  }

  /**
   * Play a sound, stopping any currently playing sound
   */
  async playSound(
    sound: Audio.Sound,
    messageId: string,
    onPlayed?: (messageId: string) => void
  ): Promise<void> {
    // 🔴 Notify all other players to pause BEFORE playing new audio
    this.notifyListeners(messageId);

    // Stop current sound if different
    if (this.currentSound && this.currentMessageId !== messageId) {
      try {
        const status = await this.currentSound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await this.currentSound.stopAsync().catch(() => {});
        }
      } catch (error) {
        // Ignore errors when stopping
      }
    }

    // Set as current
    this.currentSound = sound;
    this.currentMessageId = messageId;

    // Play the sound
    await sound.playAsync();

    // Call onPlayed callback
    if (onPlayed) {
      onPlayed(messageId);
    }
  }

  /**
   * Stop current sound
   */
  async stopCurrentSound(): Promise<void> {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync().catch(() => {});
      } catch (error) {
        // Ignore errors
      }
      this.currentSound = null;
      this.currentMessageId = null;
    }
  }

  /**
   * Check if a specific message is currently playing
   */
  isPlaying(messageId: string): boolean {
    return this.currentMessageId === messageId;
  }

  /**
   * Clear current sound reference (when sound is unloaded)
   */
  clearCurrentSound(messageId: string): void {
    if (this.currentMessageId === messageId) {
      this.currentSound = null;
      this.currentMessageId = null;
    }
  }
}

export default new AudioManager();
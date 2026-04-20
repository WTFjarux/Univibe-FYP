// utils/messageIdGenerator.ts
import * as Random from 'expo-random';

/**
 * Generates a unique temporary ID for optimistic messages
 * Format: temp_{timestamp}_{randomHex}
 * Example: temp_1734567890123_a1b2c3d4e5f6
 */
export const generateTempId = (): string => {
  // Generate 8 random bytes (16 hex characters)
  const randomBytes = Random.getRandomBytes(8);
  const randomHex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `temp_${Date.now()}_${randomHex}`;
};

/**
 * Check if a message ID is a temporary ID
 */
export const isTempId = (id: string): boolean => {
  return id?.startsWith('temp_') || false;
};
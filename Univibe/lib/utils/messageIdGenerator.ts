import * as Crypto from 'expo-crypto';

const TEMP_ID_PREFIX = 'temp_';

/**
 * Generate a unique temporary ID for pending messages
 */
export const generateTempId = (): string => {
  const uuid = Crypto.randomUUID();
  return `${TEMP_ID_PREFIX}${uuid}`;
};

/**
 * Check if a message ID is a temporary ID
 */
export const isTempId = (id: string): boolean => {
  return id?.startsWith(TEMP_ID_PREFIX) ?? false;
};
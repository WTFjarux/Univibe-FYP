// app/components/Profile/VerificationBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VerificationBadgeProps {
  status: 'verified' | 'pending' | 'unverified' | string; // Allow any string
  size?: 'sm' | 'md';
}

export default function VerificationBadge({ status, size = 'md' }: VerificationBadgeProps) {
  // Normalize the status to match our expected values
  const normalizedStatus = (status === 'verified' || status === 'pending' || status === 'unverified') 
    ? status 
    : 'unverified';

  const config = {
    verified: {
      icon: 'checkmark-circle' as const,
      color: '#10b981',
      bgColor: '#d1fae5',
      textColor: '#065f46',
      text: 'Verified Student'
    },
    pending: {
      icon: 'time-outline' as const,
      color: '#f59e0b',
      bgColor: '#fef3c7',
      textColor: '#92400e',
      text: 'Verification Pending'
    },
    unverified: {
      icon: 'close-circle-outline' as const,
      color: '#6b7280',
      bgColor: '#f3f4f6',
      textColor: '#374151',
      text: 'Not Verified'
    }
  };

  const currentConfig = config[normalizedStatus];
  const iconSize = size === 'sm' ? 14 : 16;
  const fontSize = size === 'sm' ? 12 : 14;
  const paddingHorizontal = size === 'sm' ? 12 : 16;
  const paddingVertical = size === 'sm' ? 4 : 8;

  return (
    <View style={[
      styles.badge,
      { 
        backgroundColor: currentConfig.bgColor,
        paddingHorizontal,
        paddingVertical,
      }
    ]}>
      <Ionicons 
        name={currentConfig.icon} 
        size={iconSize} 
        color={currentConfig.color} 
      />
      <Text style={[
        styles.badgeText,
        { 
          color: currentConfig.textColor,
          fontSize,
          marginLeft: 6,
        }
      ]}>
        {currentConfig.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
  },
  badgeText: {
    fontWeight: '600',
  },
});
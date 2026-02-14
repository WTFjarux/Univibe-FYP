// app/components/Feed/FeedHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FeedHeaderProps {
  title?: string;
  subtitle?: string;
  onNotificationPress?: () => void;
}

const FeedHeader: React.FC<FeedHeaderProps> = ({
  title = 'Feed',
  subtitle = 'Latest from your campus',
  onNotificationPress,
}) => {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <TouchableOpacity 
        style={styles.notificationButton} 
        onPress={onNotificationPress}
      >
        <Ionicons name="notifications-outline" size={24} color="#111827" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  notificationButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
});

export default FeedHeader;
// app/(tabs)/search/index.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'people', label: 'People' },
    { id: 'groups', label: 'Groups' },
    { id: 'posts', label: 'Posts' },
    { id: 'events', label: 'Events' },
  ];

  const recentSearches = [
    { id: 1, text: 'Computer Science Club' },
    { id: 2, text: 'Professor Smith' },
    { id: 3, text: 'Study groups' },
    { id: 4, text: 'Basketball tryouts' },
  ];

  const suggested = [
    { id: 1, name: 'CS101 Study Group', type: 'Group', members: 45 },
    { id: 2, name: 'Alex Johnson', type: 'Student', major: 'Biology' },
    { id: 3, name: 'Spring Carnival', type: 'Event', date: 'Apr 15' },
    { id: 4, name: 'Library Hours Update', type: 'Post', author: 'Admin' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Search</Text>
          <Text style={styles.subtitle}>Find students, groups, and more</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Univibes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                activeCategory === category.id && styles.categoryButtonActive,
              ]}
              onPress={() => setActiveCategory(category.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === category.id && styles.categoryTextActive,
                ]}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {searchQuery.length === 0 ? (
          <>
            {/* Recent Searches */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <TouchableOpacity>
                  <Text style={styles.clearAll}>Clear all</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((item) => (
                <TouchableOpacity key={item.id} style={styles.recentItem}>
                  <Ionicons name="time-outline" size={18} color="#6b7280" />
                  <Text style={styles.recentText}>{item.text}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </View>

            {/* Suggested */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suggested for You</Text>
              {suggested.map((item) => (
                <TouchableOpacity key={item.id} style={styles.suggestedCard}>
                  <View style={styles.suggestedIcon}>
                    <Ionicons
                      name={
                        item.type === 'Group' ? 'people' :
                        item.type === 'Student' ? 'person' :
                        item.type === 'Event' ? 'calendar' : 'chatbubble'
                      }
                      size={24}
                      color="#8b5cf6"
                    />
                  </View>
                  <View style={styles.suggestedInfo}>
                    <Text style={styles.suggestedName}>{item.name}</Text>
                    <Text style={styles.suggestedType}>
                      {item.type} {item.major ? `• ${item.major}` : ''} {item.date ? `• ${item.date}` : ''} {item.members ? `• ${item.members} members` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          // Search Results
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            <Text style={styles.noResults}>No results found for "{searchQuery}"</Text>
            <Text style={styles.trySearching}>Try searching for people, groups, or events</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  categoriesContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  categoriesContent: {
    paddingRight: 20,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  categoryText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: 'white',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  clearAll: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  recentText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
  },
  suggestedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestedInfo: {
    flex: 1,
  },
  suggestedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  suggestedType: {
    fontSize: 13,
    color: '#6b7280',
  },
  noResults: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginTop: 40,
  },
  trySearching: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
});
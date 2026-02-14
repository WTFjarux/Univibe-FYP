// app/(tabs)/events/index.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,

  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EventsScreen() {
  const upcomingEvents = [
    {
      id: 1,
      title: 'Tech Talk: AI in Education',
      date: 'Today • 4:00 PM',
      location: 'Computer Science Building',
      organizer: 'CS Department',
      attendees: 45,
      category: 'Academic',
    },
    {
      id: 2,
      title: 'Campus Spring Carnival',
      date: 'Tomorrow • 2:00 PM',
      location: 'Main Quad',
      organizer: 'Student Union',
      attendees: 120,
      category: 'Social',
    },
    {
      id: 3,
      title: 'Career Fair Preparation',
      date: 'Friday • 11:00 AM',
      location: 'Career Center',
      organizer: 'Career Services',
      attendees: 78,
      category: 'Career',
    },
  ];

  const categories = [
    { id: 1, name: 'All', icon: 'grid', count: 12 },
    { id: 2, name: 'Academic', icon: 'school', count: 5 },
    { id: 3, name: 'Social', icon: 'people', count: 4 },
    { id: 4, name: 'Sports', icon: 'basketball', count: 2 },
    { id: 5, name: 'Career', icon: 'briefcase', count: 3 },
  ];

  const yourEvents = [
    { id: 1, title: 'CS Study Group', date: 'Mon, 6 PM', going: true },
    { id: 2, title: 'Basketball Tournament', date: 'Wed, 4 PM', going: true },
    { id: 3, title: 'Music Concert', date: 'Sat, 7 PM', going: false },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Events</Text>
            <Text style={styles.subtitle}>Discover campus happenings</Text>
          </View>
          <TouchableOpacity style={styles.createButton}>
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
        </View>

        {/* Event Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((category) => (
            <TouchableOpacity key={category.id} style={styles.categoryCard}>
              <View style={styles.categoryIcon}>
                <Ionicons name={category.icon as any} size={24} color="#8b5cf6" />
              </View>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryCount}>{category.count} events</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {upcomingEvents.map((event) => (
            <TouchableOpacity key={event.id} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <View style={[styles.eventCategory, { backgroundColor: event.category === 'Academic' ? '#dbeafe' : event.category === 'Social' ? '#fce7f3' : '#dcfce7' }]}>
                  <Text style={[styles.eventCategoryText, { color: event.category === 'Academic' ? '#1d4ed8' : event.category === 'Social' ? '#be185d' : '#15803d' }]}>
                    {event.category}
                  </Text>
                </View>
                <View style={styles.eventStats}>
                  <Ionicons name="people" size={14} color="#6b7280" />
                  <Text style={styles.eventStatText}>{event.attendees}</Text>
                </View>
              </View>
              
              <Text style={styles.eventTitle}>{event.title}</Text>
              
              <View style={styles.eventDetails}>
                <View style={styles.eventDetail}>
                  <Ionicons name="calendar-outline" size={16} color="#6b7280" />
                  <Text style={styles.eventDetailText}>{event.date}</Text>
                </View>
                <View style={styles.eventDetail}>
                  <Ionicons name="location-outline" size={16} color="#6b7280" />
                  <Text style={styles.eventDetailText}>{event.location}</Text>
                </View>
                <View style={styles.eventDetail}>
                  <Ionicons name="person-outline" size={16} color="#6b7280" />
                  <Text style={styles.eventDetailText}>{event.organizer}</Text>
                </View>
              </View>
              
              <View style={styles.eventActions}>
                <TouchableOpacity style={styles.interestedButton}>
                  <Ionicons name="heart-outline" size={16} color="#8b5cf6" />
                  <Text style={styles.interestedText}>Interested</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rsvpButton}>
                  <Text style={styles.rsvpText}>RSVP</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Your Events */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Events</Text>
          {yourEvents.map((event) => (
            <TouchableOpacity key={event.id} style={styles.yourEventCard}>
              <View style={styles.yourEventInfo}>
                <View style={styles.yourEventIcon}>
                  <Ionicons name="calendar" size={20} color="#8b5cf6" />
                </View>
                <View>
                  <Text style={styles.yourEventTitle}>{event.title}</Text>
                  <Text style={styles.yourEventDate}>{event.date}</Text>
                </View>
              </View>
              <View style={[styles.goingBadge, { backgroundColor: event.going ? '#d1fae5' : '#fef3c7' }]}>
                <Text style={[styles.goingText, { color: event.going ? '#065f46' : '#92400e' }]}>
                  {event.going ? 'Going ✓' : 'Maybe'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  categoriesScroll: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  categoriesContent: {
    paddingRight: 20,
  },
  categoryCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    width: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  seeAll: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventCategory: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  eventCategoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventStatText: {
    fontSize: 12,
    color: '#6b7280',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  eventDetails: {
    gap: 12,
    marginBottom: 20,
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDetailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  eventActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  interestedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  interestedText: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  rsvpButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  rsvpText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  yourEventCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  yourEventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  yourEventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yourEventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  yourEventDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  goingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  goingText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
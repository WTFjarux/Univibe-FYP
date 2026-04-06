// app/events/create.tsx - With transparent modal backgrounds

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { eventService } from "@/lib/eventService";

const categories = [
  "Academic",
  "Social",
  "Sports",
  "Career",
  "Cultural",
  "Workshop",
  "Other",
];

export default function CreateEventScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Academic");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3600000));
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [tempStartHour, setTempStartHour] = useState(startDate.getHours());
  const [tempStartMinute, setTempStartMinute] = useState(
    startDate.getMinutes(),
  );
  const [tempEndHour, setTempEndHour] = useState(endDate.getHours());
  const [tempEndMinute, setTempEndMinute] = useState(endDate.getMinutes());
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [visibility, setVisibility] = useState("campus");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [meetingLink, setMeetingLink] = useState("");
  const [tags, setTags] = useState("");

  // Generate hours (0-23) and minutes (0-59)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please grant photo library permissions",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCoverImage(result.assets[0].uri);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTimeFromHoursMinutes = (hour: number, minute: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
  };

  const getDateString = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const onStartDateConfirm = () => {
    if (tempStartDate) {
      const newDate = new Date(tempStartDate);
      newDate.setHours(startDate.getHours());
      newDate.setMinutes(startDate.getMinutes());
      setStartDate(newDate);

      // If end date is before new start date, update end date
      if (endDate <= newDate) {
        const newEndDate = new Date(newDate.getTime() + 3600000);
        setEndDate(newEndDate);
        setTempEndHour(newEndDate.getHours());
        setTempEndMinute(newEndDate.getMinutes());
      }
    }
    setShowStartCalendar(false);
  };

  const onEndDateConfirm = () => {
    if (tempEndDate) {
      const newDate = new Date(tempEndDate);
      newDate.setHours(endDate.getHours());
      newDate.setMinutes(endDate.getMinutes());

      if (newDate > startDate) {
        setEndDate(newDate);
      } else {
        Alert.alert("Invalid Date", "End date must be after start date");
      }
    }
    setShowEndCalendar(false);
  };

  const onStartTimeConfirm = () => {
    const newDate = new Date(startDate);
    newDate.setHours(tempStartHour);
    newDate.setMinutes(tempStartMinute);
    setStartDate(newDate);

    // If end date is before new start date, update end date
    if (endDate <= newDate) {
      const newEndDate = new Date(newDate.getTime() + 3600000);
      setEndDate(newEndDate);
      setTempEndHour(newEndDate.getHours());
      setTempEndMinute(newEndDate.getMinutes());
    }
    setShowStartTimeModal(false);
  };

  const onEndTimeConfirm = () => {
    const newDate = new Date(endDate);
    newDate.setHours(tempEndHour);
    newDate.setMinutes(tempEndMinute);

    if (newDate > startDate) {
      setEndDate(newDate);
      setShowEndTimeModal(false);
    } else {
      Alert.alert("Invalid Time", "End time must be after start time");
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!title.trim()) {
      Alert.alert("Error", "Please enter an event title");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Error", "Please enter an event description");
      return;
    }
    if (!location.trim() && !isOnline) {
      Alert.alert("Error", "Please enter an event location");
      return;
    }
    if (startDate >= endDate) {
      Alert.alert("Error", "End date must be after start date");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("category", category);
      formData.append("location", location.trim());
      formData.append("startDate", startDate.toISOString());
      formData.append("endDate", endDate.toISOString());
      formData.append("visibility", visibility);
      if (maxAttendees) formData.append("maxAttendees", maxAttendees);
      formData.append("isOnline", String(isOnline));
      if (meetingLink) formData.append("meetingLink", meetingLink);
      if (tags) formData.append("tags", tags);

      if (coverImage) {
        const filename = coverImage.split("/").pop() || "event.jpg";
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";
        formData.append("coverImage", {
          uri: coverImage,
          name: filename,
          type,
        } as any);
      }

      const response = await eventService.createEvent(formData);
      if (response.success) {
        Alert.alert("Success", "Event created successfully!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Error", response.message || "Failed to create event");
      }
    } catch (error) {
      console.error("Error creating event:", error);
      Alert.alert("Error", "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={28} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Event</Text>
            <TouchableOpacity
              style={[
                styles.createButton,
                (!title || !description) && styles.createButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || !title || !description}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Cover Image */}
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {coverImage ? (
                <Image source={{ uri: coverImage }} style={styles.coverImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={40} color="#9ca3af" />
                  <Text style={styles.imagePlaceholderText}>
                    Add Cover Image
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Name of the Event"
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                returnKeyType="next"
              />
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoriesContainer}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        category === cat && styles.categoryChipActive,
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          category === cat && styles.categoryChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Start Date & Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start Date & Time *</Text>
              <View style={styles.dateTimeContainer}>
                <TouchableOpacity
                  style={[styles.dateButton, styles.halfButton]}
                  onPress={() => {
                    setTempStartDate(getDateString(startDate));
                    setShowStartCalendar(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                  <Text style={styles.dateText}>{formatDate(startDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateButton, styles.halfButton]}
                  onPress={() => {
                    setTempStartHour(startDate.getHours());
                    setTempStartMinute(startDate.getMinutes());
                    setShowStartTimeModal(true);
                  }}
                >
                  <Ionicons name="time-outline" size={20} color="#6b7280" />
                  <Text style={styles.dateText}>{formatTime(startDate)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* End Date & Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>End Date & Time *</Text>
              <View style={styles.dateTimeContainer}>
                <TouchableOpacity
                  style={[styles.dateButton, styles.halfButton]}
                  onPress={() => {
                    setTempEndDate(getDateString(endDate));
                    setShowEndCalendar(true);
                  }}
                >
                  <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                  <Text style={styles.dateText}>{formatDate(endDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateButton, styles.halfButton]}
                  onPress={() => {
                    setTempEndHour(endDate.getHours());
                    setTempEndMinute(endDate.getMinutes());
                    setShowEndTimeModal(true);
                  }}
                >
                  <Ionicons name="time-outline" size={20} color="#6b7280" />
                  <Text style={styles.dateText}>{formatTime(endDate)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Location */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location *</Text>
              <TextInput
                style={styles.input}
                placeholder="Building, Room, or Address"
                placeholderTextColor="#9ca3af"
                value={location}
                onChangeText={setLocation}
                returnKeyType="next"
              />
            </View>

            {/* Online Event Toggle */}
            <View style={styles.inputGroup}>
              <View style={styles.switchContainer}>
                <Text style={styles.label}>Online Event</Text>
                <TouchableOpacity
                  style={[styles.switch, isOnline && styles.switchActive]}
                  onPress={() => setIsOnline(!isOnline)}
                >
                  <View
                    style={[
                      styles.switchKnob,
                      isOnline && styles.switchKnobActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {isOnline && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Meeting Link</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://zoom.us/..."
                  placeholderTextColor="#9ca3af"
                  value={meetingLink}
                  onChangeText={setMeetingLink}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>
            )}

            {/* Max Attendees */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Max Attendees (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Unlimited"
                placeholderTextColor="#9ca3af"
                value={maxAttendees}
                onChangeText={setMaxAttendees}
                keyboardType="numeric"
                returnKeyType="next"
              />
            </View>

            {/* Tags */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tags (comma-separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., AI, Workshop, Networking"
                placeholderTextColor="#9ca3af"
                value={tags}
                onChangeText={setTags}
                returnKeyType="next"
              />
              <Text style={styles.helperText}>Separate tags with commas</Text>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your event..."
                placeholderTextColor="#9ca3af"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {/* Visibility */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Visibility</Text>
              <View style={styles.visibilityContainer}>
                {["campus", "connections", "public"].map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[
                      styles.visibilityOption,
                      visibility === v && styles.visibilityOptionActive,
                    ]}
                    onPress={() => setVisibility(v)}
                  >
                    <Text
                      style={[
                        styles.visibilityText,
                        visibility === v && styles.visibilityTextActive,
                      ]}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Calendar Modal for Start Date */}
        <Modal
          visible={showStartCalendar}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowStartCalendar(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowStartCalendar(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Start Date</Text>
                <TouchableOpacity onPress={() => setShowStartCalendar(false)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={new Date(tempStartDate || getDateString(startDate))}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) {
                    setTempStartDate(getDateString(date));
                  }
                }}
                style={styles.datePicker}
              />
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={onStartDateConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Calendar Modal for End Date */}
        <Modal
          visible={showEndCalendar}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowEndCalendar(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowEndCalendar(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select End Date</Text>
                <TouchableOpacity onPress={() => setShowEndCalendar(false)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={new Date(tempEndDate || getDateString(endDate))}
                mode="date"
                display="spinner"
                minimumDate={new Date(getDateString(startDate))}
                onChange={(event, date) => {
                  if (date) {
                    setTempEndDate(getDateString(date));
                  }
                }}
                style={styles.datePicker}
              />
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={onEndDateConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Time Picker Modal for Start Time */}
        <Modal
          visible={showStartTimeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowStartTimeModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowStartTimeModal(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Start Time</Text>
                <TouchableOpacity onPress={() => setShowStartTimeModal(false)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              <View style={styles.timePickerContainer}>
                <View style={styles.timePickerColumn}>
                  <Text style={styles.timePickerLabel}>Hour</Text>
                  <Picker
                    selectedValue={tempStartHour}
                    onValueChange={(itemValue) => setTempStartHour(itemValue)}
                    style={styles.timePicker}
                  >
                    {hours.map((hour) => (
                      <Picker.Item
                        key={hour}
                        label={hour.toString().padStart(2, "0")}
                        value={hour}
                      />
                    ))}
                  </Picker>
                </View>
                <View style={styles.timePickerColumn}>
                  <Text style={styles.timePickerLabel}>Minute</Text>
                  <Picker
                    selectedValue={tempStartMinute}
                    onValueChange={(itemValue) => setTempStartMinute(itemValue)}
                    style={styles.timePicker}
                  >
                    {minutes.map((minute) => (
                      <Picker.Item
                        key={minute}
                        label={minute.toString().padStart(2, "0")}
                        value={minute}
                      />
                    ))}
                  </Picker>
                </View>
                <View style={styles.timePreviewColumn}>
                  <Text style={styles.timePickerLabel}>Preview</Text>
                  <Text style={styles.timePreview}>
                    {formatTimeFromHoursMinutes(tempStartHour, tempStartMinute)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={onStartTimeConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Time Picker Modal for End Time */}
        <Modal
          visible={showEndTimeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowEndTimeModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowEndTimeModal(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select End Time</Text>
                <TouchableOpacity onPress={() => setShowEndTimeModal(false)}>
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>
              <View style={styles.timePickerContainer}>
                <View style={styles.timePickerColumn}>
                  <Text style={styles.timePickerLabel}>Hour</Text>
                  <Picker
                    selectedValue={tempEndHour}
                    onValueChange={(itemValue) => setTempEndHour(itemValue)}
                    style={styles.timePicker}
                  >
                    {hours.map((hour) => (
                      <Picker.Item
                        key={hour}
                        label={hour.toString().padStart(2, "0")}
                        value={hour}
                      />
                    ))}
                  </Picker>
                </View>
                <View style={styles.timePickerColumn}>
                  <Text style={styles.timePickerLabel}>Minute</Text>
                  <Picker
                    selectedValue={tempEndMinute}
                    onValueChange={(itemValue) => setTempEndMinute(itemValue)}
                    style={styles.timePicker}
                  >
                    {minutes.map((minute) => (
                      <Picker.Item
                        key={minute}
                        label={minute.toString().padStart(2, "0")}
                        value={minute}
                      />
                    ))}
                  </Picker>
                </View>
                <View style={styles.timePreviewColumn}>
                  <Text style={styles.timePickerLabel}>Preview</Text>
                  <Text style={styles.timePreview}>
                    {formatTimeFromHoursMinutes(tempEndHour, tempEndMinute)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={onEndTimeConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },
  createButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  imagePicker: {
    marginBottom: 20,
  },
  coverImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: "#9ca3af",
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    fontFamily: "SofiaSans-Bold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#fff",
    fontFamily: "SofiaSans-Regular",
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  dateTimeContainer: {
    flexDirection: "row",
    gap: 12,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: "#fff",
  },
  halfButton: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    color: "#111827",
    flex: 1,
    fontFamily: "SofiaSans-Regular",
  },
  categoriesContainer: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  categoryChipActive: {
    backgroundColor: "#8b5cf6",
  },
  categoryChipText: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  categoryChipTextActive: {
    color: "#fff",
    fontFamily: "SofiaSans-Bold",
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switch: {
    width: 50,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#d1d5db",
    padding: 2,
  },
  switchActive: {
    backgroundColor: "#8b5cf6",
  },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
  },
  switchKnobActive: {
    transform: [{ translateX: 24 }],
  },
  helperText: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
    fontFamily: "SofiaSans-Regular",
  },
  visibilityContainer: {
    flexDirection: "row",
    gap: 12,
  },
  visibilityOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  visibilityOptionActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  visibilityText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
  },
  visibilityTextActive: {
    color: "#fff",
    fontFamily: "SofiaSans-Bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },
  confirmButton: {
    backgroundColor: "#8b5cf6",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  datePicker: {
    height: 200,
  },
  timePickerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  timePickerColumn: {
    flex: 1,
    alignItems: "center",
  },
  timePreviewColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timePickerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    fontFamily: "SofiaSans-Bold",
  },
  timePicker: {
    width: "100%",
    height: 150,
  },
  timePreview: {
    fontSize: 18,
    fontWeight: "600",
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Bold",
    textAlign: "center",
  },
});

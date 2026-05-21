// app/events/create.tsx - Simplified version
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { eventService } from "@/lib/services/eventService";
import {
  DatePickerModal,
  TimePickerModal,
} from "@/app/components/Events/DateTimePickerModal";
import {
  ImagePickerComponent,
  ImageItem,
} from "@/app/components/Events/ImagePicker";

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
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Academic");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3600000));
  const [images, setImages] = useState<ImageItem[]>([]);
  const [visibility, setVisibility] = useState("campus");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [meetingLink, setMeetingLink] = useState("");
  const [tags, setTags] = useState("");

  // Modal States
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);

  // Temp States
  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());
  const [tempStartHour, setTempStartHour] = useState(startDate.getHours());
  const [tempStartMinute, setTempStartMinute] = useState(
    startDate.getMinutes(),
  );
  const [tempEndHour, setTempEndHour] = useState(endDate.getHours());
  const [tempEndMinute, setTempEndMinute] = useState(endDate.getMinutes());

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const onStartDateConfirm = () => {
    const newDate = new Date(tempStartDate);
    newDate.setHours(startDate.getHours(), startDate.getMinutes());
    setStartDate(newDate);
    if (endDate <= newDate) {
      const newEndDate = new Date(newDate.getTime() + 3600000);
      setEndDate(newEndDate);
      setTempEndHour(newEndDate.getHours());
      setTempEndMinute(newEndDate.getMinutes());
    }
    setShowStartDate(false);
  };

  const onEndDateConfirm = () => {
    const newDate = new Date(tempEndDate);
    newDate.setHours(endDate.getHours(), endDate.getMinutes());
    const startDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    const endDay = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      newDate.getDate(),
    );
    if (endDay >= startDay) {
      setEndDate(newDate);
    } else {
      Alert.alert("Invalid Date", "End date must be on or after start date");
    }
    setShowEndDate(false);
  };

  const onStartTimeConfirm = () => {
    const newDate = new Date(startDate);
    newDate.setHours(tempStartHour, tempStartMinute);
    setStartDate(newDate);
    if (endDate <= newDate) {
      const newEndDate = new Date(newDate.getTime() + 3600000);
      setEndDate(newEndDate);
      setTempEndHour(newEndDate.getHours());
      setTempEndMinute(newEndDate.getMinutes());
    }
    setShowStartTime(false);
  };

  const onEndTimeConfirm = () => {
    const newDate = new Date(endDate);
    newDate.setHours(tempEndHour, tempEndMinute);
    if (newDate > startDate) {
      setEndDate(newDate);
    } else {
      Alert.alert("Invalid Time", "End time must be after start time");
    }
    setShowEndTime(false);
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!title.trim()) {
      Alert.alert("Error", "Please enter event title");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Error", "Please enter event description");
      return;
    }
    if (!location.trim() && !isOnline) {
      Alert.alert("Error", "Please enter event location");
      return;
    }
    if (startDate >= endDate) {
      Alert.alert("Error", "End date must be after start date");
      return;
    }
    if (images.length === 0) {
      Alert.alert("Error", "Please add at least one image for your event");
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
      images.forEach((image) => {
        formData.append("images", {
          uri: image.uri,
          name: image.fileName,
          type: image.type,
        } as any);
      });
      const response = await eventService.createEvent(formData);
      if (response.success) {
        Alert.alert("Success!", "Event created successfully", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Error", response.message || "Failed to create event");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Create Event
          </Text>
          <TouchableOpacity
            style={[
              styles.createButton,
              { backgroundColor: colors.primary },
              (!title || !description || images.length === 0) && [
                styles.createButtonDisabled,
                { backgroundColor: colors.textMuted },
              ],
            ]}
            onPress={handleSubmit}
            disabled={loading || !title || !description || images.length === 0}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ImagePickerComponent
            images={images}
            onImagesChange={setImages}
            maxImages={5}
          />

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Event Title *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Enter event title"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Category *
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoriesContainer}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      { backgroundColor: colors.skeleton },
                      category === cat && [
                        styles.categoryChipActive,
                        { backgroundColor: colors.primary },
                      ],
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: colors.textSecondary },
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

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Start Date & Time *
            </Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.halfButton,
                  styles.dateButton,
                  { borderColor: colors.border },
                ]}
                onPress={() => setShowStartDate(true)}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {formatDate(startDate)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.halfButton,
                  styles.dateButton,
                  { borderColor: colors.border },
                ]}
                onPress={() => setShowStartTime(true)}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {formatTime(startDate)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              End Date & Time *
            </Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.halfButton,
                  styles.dateButton,
                  { borderColor: colors.border },
                ]}
                onPress={() => setShowEndDate(true)}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {formatDate(endDate)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.halfButton,
                  styles.dateButton,
                  { borderColor: colors.border },
                ]}
                onPress={() => setShowEndTime(true)}
              >
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {formatTime(endDate)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Location *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Building, room, or address"
              placeholderTextColor={colors.textMuted}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.switchContainer}>
              <Text style={[styles.label, { color: colors.text }]}>
                Online Event
              </Text>
              <TouchableOpacity
                style={[
                  styles.switch,
                  { backgroundColor: colors.textMuted },
                  isOnline && [
                    styles.switchActive,
                    { backgroundColor: colors.primary },
                  ],
                ]}
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
              <Text style={[styles.label, { color: colors.text }]}>
                Meeting Link
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="https://zoom.us/..."
                placeholderTextColor={colors.textMuted}
                value={meetingLink}
                onChangeText={setMeetingLink}
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Max Attendees (Optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Unlimited"
              placeholderTextColor={colors.textMuted}
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Tags (comma-separated)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g., Workshop, Networking"
              placeholderTextColor={colors.textMuted}
              value={tags}
              onChangeText={setTags}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Description *
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Describe your event..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>
              {description.length}/2000
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Visibility
            </Text>
            <View style={styles.visibilityContainer}>
              {[
                { value: "campus", label: "Campus", icon: "business-outline" },
                {
                  value: "connections",
                  label: "Connections",
                  icon: "people-outline",
                },
                { value: "public", label: "Public", icon: "globe-outline" },
              ].map((v) => (
                <TouchableOpacity
                  key={v.value}
                  style={[
                    styles.visibilityOption,
                    { borderColor: colors.border },
                    visibility === v.value && [
                      styles.visibilityOptionActive,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ],
                  ]}
                  onPress={() => setVisibility(v.value)}
                >
                  <Ionicons
                    name={v.icon as any}
                    size={20}
                    color={
                      visibility === v.value ? "#fff" : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.visibilityText,
                      { color: colors.textSecondary },
                      visibility === v.value && styles.visibilityTextActive,
                    ]}
                  >
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showStartDate}
        onClose={() => setShowStartDate(false)}
        onConfirm={onStartDateConfirm}
        title="Select Start Date"
        date={tempStartDate}
        setDate={setTempStartDate}
      />
      <DatePickerModal
        visible={showEndDate}
        onClose={() => setShowEndDate(false)}
        onConfirm={onEndDateConfirm}
        title="Select End Date"
        date={tempEndDate}
        setDate={setTempEndDate}
      />
      <TimePickerModal
        visible={showStartTime}
        onClose={() => setShowStartTime(false)}
        onConfirm={onStartTimeConfirm}
        title="Select Start Time"
        hour={tempStartHour}
        minute={tempStartMinute}
        setHour={setTempStartHour}
        setMinute={setTempStartMinute}
      />
      <TimePickerModal
        visible={showEndTime}
        onClose={() => setShowEndTime(false)}
        onConfirm={onEndTimeConfirm}
        title="Select End Time"
        hour={tempEndHour}
        minute={tempEndMinute}
        setHour={setTempEndHour}
        setMinute={setTempEndMinute}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  createButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  createButtonDisabled: {},
  createButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    fontFamily: "SofiaSans-Bold",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "SofiaSans-Regular",
  },
  textArea: { minHeight: 120 },
  charCount: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
    fontFamily: "SofiaSans-Regular",
  },
  row: { flexDirection: "row", gap: 12 },
  halfButton: { flex: 1 },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  dateText: { fontSize: 16, flex: 1, fontFamily: "SofiaSans-Regular" },
  categoriesContainer: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  categoryChipActive: {},
  categoryChipText: { fontSize: 14, fontFamily: "SofiaSans-Regular" },
  categoryChipTextActive: { color: "#fff", fontFamily: "SofiaSans-Bold" },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switch: { width: 50, height: 26, borderRadius: 13, padding: 2 },
  switchActive: {},
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
  },
  switchKnobActive: { transform: [{ translateX: 24 }] },
  visibilityContainer: { flexDirection: "row", gap: 12 },
  visibilityOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  visibilityOptionActive: {},
  visibilityText: { fontSize: 14, fontFamily: "SofiaSans-Regular" },
  visibilityTextActive: { color: "#fff", fontFamily: "SofiaSans-Bold" },
});

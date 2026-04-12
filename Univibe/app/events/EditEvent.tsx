// Univibe/app/events/EditEvent.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { eventService } from "@/lib/services/eventService";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  ImagePickerComponent,
  ImageItem,
} from "@/app/components/Events/ImagePicker";
import {
  DatePickerModal,
  TimePickerModal,
} from "@/app/components/Events/DateTimePickerModal";
import DiscardChangesModal from "@/app/components/DiscardChangesModal";

const categories = [
  "Academic",
  "Social",
  "Sports",
  "Career",
  "Cultural",
  "Workshop",
  "Other",
];

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Academic");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3600000));
  const [images, setImages] = useState<ImageItem[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [existingCoverImage, setExistingCoverImage] = useState<string>("");
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [visibility, setVisibility] = useState("campus");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [meetingLink, setMeetingLink] = useState("");
  const [tags, setTags] = useState("");

  // Original State for tracking changes
  const [originalData, setOriginalData] = useState({
    title: "",
    description: "",
    category: "Academic",
    location: "",
    startDate: new Date(),
    endDate: new Date(),
    visibility: "campus",
    maxAttendees: "",
    isOnline: false,
    meetingLink: "",
    tags: "",
    existingImages: [] as string[],
    existingCoverImage: "",
  });

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

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id]);

  // Check for changes whenever form fields update
  useEffect(() => {
    if (!loading) {
      const hasAnyChanges =
        title !== originalData.title ||
        description !== originalData.description ||
        category !== originalData.category ||
        location !== originalData.location ||
        startDate.getTime() !== originalData.startDate.getTime() ||
        endDate.getTime() !== originalData.endDate.getTime() ||
        visibility !== originalData.visibility ||
        maxAttendees !== originalData.maxAttendees ||
        isOnline !== originalData.isOnline ||
        meetingLink !== originalData.meetingLink ||
        tags !== originalData.tags ||
        images.length > 0 ||
        removedImages.length > 0 ||
        existingImages.length !== originalData.existingImages.length ||
        JSON.stringify(existingImages) !==
          JSON.stringify(originalData.existingImages);

      setHasChanges(hasAnyChanges);
    }
  }, [
    title,
    description,
    category,
    location,
    startDate,
    endDate,
    visibility,
    maxAttendees,
    isOnline,
    meetingLink,
    tags,
    images,
    removedImages,
    existingImages,
    loading,
  ]);

  const fetchEvent = async () => {
    try {
      const response = await eventService.getEventById(id);
      if (response.success && response.event) {
        const event = response.event;

        // Check if user is organizer
        if (event.organizer._id !== user?.id) {
          Alert.alert(
            "Unauthorized",
            "You don't have permission to edit this event",
          );
          router.back();
          return;
        }

        // Populate form with event data
        setTitle(event.title);
        setDescription(event.description);
        setCategory(event.category);
        setLocation(event.location);
        setStartDate(new Date(event.startDate));
        setEndDate(new Date(event.endDate));
        setVisibility(event.visibility || "campus");
        setMaxAttendees(event.maxAttendees?.toString() || "");
        setIsOnline(event.isOnline || false);
        setMeetingLink(event.meetingLink || "");
        setTags(event.tags?.join(", ") || "");

        // Set existing images
        let imagesList: string[] = [];
        let coverImage = "";

        if (event.imageUrls && event.imageUrls.length > 0) {
          imagesList = event.imageUrls;
          coverImage = event.imageUrls[0];
        } else if (event.coverImage) {
          imagesList = [event.coverImage];
          coverImage = event.coverImage;
        }

        setExistingImages(imagesList);
        setExistingCoverImage(coverImage);

        // Store original data for change tracking
        setOriginalData({
          title: event.title,
          description: event.description,
          category: event.category,
          location: event.location,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
          visibility: event.visibility || "campus",
          maxAttendees: event.maxAttendees?.toString() || "",
          isOnline: event.isOnline || false,
          meetingLink: event.meetingLink || "",
          tags: event.tags?.join(", ") || "",
          existingImages: imagesList,
          existingCoverImage: coverImage,
        });

        // Update temp states
        setTempStartDate(new Date(event.startDate));
        setTempEndDate(new Date(event.endDate));
        setTempStartHour(new Date(event.startDate).getHours());
        setTempStartMinute(new Date(event.startDate).getMinutes());
        setTempEndHour(new Date(event.endDate).getHours());
        setTempEndMinute(new Date(event.endDate).getMinutes());
      } else {
        Alert.alert("Error", response.message || "Failed to load event");
        router.back();
      }
    } catch (error) {
      console.error("Error fetching event:", error);
      Alert.alert("Error", "Failed to load event");
      router.back();
    } finally {
      setLoading(false);
    }
  };

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
    if (newDate > startDate) {
      setEndDate(newDate);
    } else {
      Alert.alert("Invalid Date", "End date must be after start date");
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

  const handleRemoveExistingImage = (imageUrl: string) => {
    Alert.alert("Remove Image", "Remove this image from your event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          // If removing the cover image
          if (imageUrl === existingCoverImage) {
            setExistingCoverImage("");
          }
          setExistingImages((prev) => prev.filter((img) => img !== imageUrl));
          setRemovedImages((prev) => [...prev, imageUrl]);
        },
      },
    ]);
  };

  const handleReplaceCoverImage = (newCoverUri: string) => {
    // If there's an existing cover image, mark it for removal
    if (existingCoverImage) {
      setRemovedImages((prev) => [...prev, existingCoverImage]);
      setExistingImages((prev) =>
        prev.filter((img) => img !== existingCoverImage),
      );
      setExistingCoverImage("");
    }

    // Add the new cover image to images array
    const filename = newCoverUri.split("/").pop() || `cover_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    const newCoverImage: ImageItem = {
      id: `${Date.now()}_cover_${Math.random()}`,
      uri: newCoverUri,
      fileName: filename,
      type: type,
      isCover: true,
    };

    setImages([newCoverImage, ...images]);
  };

  const handleBackPress = () => {
    if (hasChanges) {
      setShowDiscardModal(true);
    } else {
      router.back();
    }
  };

  const handleDiscardChanges = () => {
    setShowDiscardModal(false);
    router.back();
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
    if (images.length === 0 && existingImages.length === 0) {
      Alert.alert("Error", "Please add at least one image for your event");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();

      // Basic info
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

      // Append removed images
      if (removedImages.length > 0) {
        formData.append("removedImages", JSON.stringify(removedImages));
      }

      // Append new images
      images.forEach((image) => {
        formData.append("images", {
          uri: image.uri,
          name: image.fileName,
          type: image.type,
        } as any);
      });

      const response = await eventService.updateEvent(id, formData);

      if (response.success) {
        Alert.alert("Success!", "Event updated successfully", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Error", response.message || "Failed to update event");
      }
    } catch (error) {
      console.error("Update event error:", error);
      Alert.alert("Error", "Failed to update event");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </SafeAreaView>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackPress}>
              <Ionicons name="close" size={28} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Event</Text>
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!hasChanges || !title || !description) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || !hasChanges || !title || !description}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Image Picker with Edit Mode Support */}
            <ImagePickerComponent
              images={images}
              onImagesChange={setImages}
              maxImages={5}
              title="Additional Photos"
              subtitle="Optional"
              showCover={true}
              isEditMode={true}
              existingImages={existingImages}
              existingCoverImage={existingCoverImage}
              onRemoveExistingImage={handleRemoveExistingImage}
              onReplaceCoverImage={handleReplaceCoverImage}
            />

            {/* Form Fields */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter event title"
                value={title}
                onChangeText={setTitle}
              />
            </View>

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
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.halfButton, styles.dateButton]}
                  onPress={() => setShowStartDate(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                  <Text style={styles.dateText}>{formatDate(startDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.halfButton, styles.dateButton]}
                  onPress={() => setShowStartTime(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#6b7280" />
                  <Text style={styles.dateText}>{formatTime(startDate)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* End Date & Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>End Date & Time *</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.halfButton, styles.dateButton]}
                  onPress={() => setShowEndDate(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                  <Text style={styles.dateText}>{formatDate(endDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.halfButton, styles.dateButton]}
                  onPress={() => setShowEndTime(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#6b7280" />
                  <Text style={styles.dateText}>{formatTime(endDate)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location *</Text>
              <TextInput
                style={styles.input}
                placeholder="Building, room, or address"
                value={location}
                onChangeText={setLocation}
              />
            </View>

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
                  value={meetingLink}
                  onChangeText={setMeetingLink}
                  autoCapitalize="none"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Max Attendees (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Unlimited"
                value={maxAttendees}
                onChangeText={setMaxAttendees}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tags (comma-separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Workshop, Networking"
                value={tags}
                onChangeText={setTags}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your event..."
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{description.length}/2000</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Visibility</Text>
              <View style={styles.visibilityContainer}>
                {[
                  {
                    value: "campus",
                    label: "Campus",
                    icon: "business-outline",
                  },
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
                      visibility === v.value && styles.visibilityOptionActive,
                    ]}
                    onPress={() => setVisibility(v.value)}
                  >
                    <Ionicons
                      name={v.icon as any}
                      size={20}
                      color={visibility === v.value ? "#fff" : "#6b7280"}
                    />
                    <Text
                      style={[
                        styles.visibilityText,
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

        {/* Discard Changes Modal - Using Reusable Component */}
        <DiscardChangesModal
          visible={showDiscardModal}
          onClose={() => setShowDiscardModal(false)}
          onDiscard={handleDiscardChanges}
        />

        {/* Modals */}
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
          minimumDate={startDate}
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
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },
  saveButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonDisabled: { backgroundColor: "#d1d5db" },
  saveButtonText: {
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
  textArea: { minHeight: 120 },
  charCount: {
    fontSize: 11,
    color: "#9ca3af",
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
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    color: "#111827",
    flex: 1,
    fontFamily: "SofiaSans-Regular",
  },
  categoriesContainer: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  categoryChipActive: { backgroundColor: "#8b5cf6" },
  categoryChipText: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  categoryChipTextActive: { color: "#fff", fontFamily: "SofiaSans-Bold" },
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
  switchActive: { backgroundColor: "#8b5cf6" },
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
    borderColor: "#e5e7eb",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  visibilityOptionActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  visibilityText: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  visibilityTextActive: { color: "#fff", fontFamily: "SofiaSans-Bold" },
});

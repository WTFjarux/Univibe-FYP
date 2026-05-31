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
import { useTheme } from "@/lib/contexts/ThemeContext";
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
  const { colors } = useTheme();
  const [isCommunityEvent, setIsCommunityEvent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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

  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);

  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());
  const [tempStartHour, setTempStartHour] = useState(startDate.getHours());
  const [tempStartMinute, setTempStartMinute] = useState(
    startDate.getMinutes(),
  );
  const [tempEndHour, setTempEndHour] = useState(endDate.getHours());
  const [tempEndMinute, setTempEndMinute] = useState(endDate.getMinutes());

  useEffect(() => {
    if (id) fetchEvent();
  }, [id]);

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
        if (
          event.community &&
          (typeof event.community === "object"
            ? event.community._id
            : event.community)
        ) {
          setIsCommunityEvent(true);
        }
        if (event.organizer._id !== user?.id) {
          Alert.alert(
            "Unauthorized",
            "You don't have permission to edit this event",
          );
          router.back();
          return;
        }
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
    if (endDay >= startDay) setEndDate(newDate);
    else Alert.alert("Invalid Date", "End date must be after start date");
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
    if (newDate > startDate) setEndDate(newDate);
    else Alert.alert("Invalid Time", "End time must be after start time");
    setShowEndTime(false);
  };

  const handleRemoveExistingImage = (imageUrl: string) => {
    Alert.alert("Remove Image", "Remove this image from your event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          if (imageUrl === existingCoverImage) setExistingCoverImage("");
          setExistingImages((prev) => prev.filter((img) => img !== imageUrl));
          setRemovedImages((prev) => [...prev, imageUrl]);
        },
      },
    ]);
  };
  const handleReplaceCoverImage = (newCoverUri: string) => {
    if (existingCoverImage) {
      setRemovedImages((prev) => [...prev, existingCoverImage]);
      setExistingImages((prev) =>
        prev.filter((img) => img !== existingCoverImage),
      );
      setExistingCoverImage("");
    }
    const filename = newCoverUri.split("/").pop() || `cover_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";
    const newCoverImage: ImageItem = {
      id: `${Date.now()}_cover_${Math.random()}`,
      uri: newCoverUri,
      fileName: filename,
      type,
      isCover: true,
    };
    setImages([newCoverImage, ...images]);
  };

  const handleBackPress = () => {
    if (hasChanges) setShowDiscardModal(true);
    else router.back();
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
      Alert.alert("Error", "Please add at least one image");
      return;
    }
    setSubmitting(true);
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
      if (removedImages.length > 0)
        formData.append("removedImages", JSON.stringify(removedImages));
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
      Alert.alert("Error", "Failed to update event");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handleBackPress}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Edit Event
            </Text>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                (!hasChanges || !title || !description) && [
                  styles.saveButtonDisabled,
                  { backgroundColor: colors.textMuted },
                ],
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

            {/* ✅ Visibility - No public option */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Visibility
              </Text>
              <View style={styles.visibilityContainer}>
                {isCommunityEvent
                  ? [
                      {
                        value: "campus",
                        label: "Campus",
                        icon: "school-outline" as const,
                      },
                      {
                        value: "community",
                        label: "Community",
                        icon: "people" as const,
                      },
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
                          name={v.icon}
                          size={20}
                          color={
                            visibility === v.value
                              ? "#fff"
                              : colors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.visibilityText,
                            { color: colors.textSecondary },
                            visibility === v.value &&
                              styles.visibilityTextActive,
                          ]}
                        >
                          {v.label}
                        </Text>
                      </TouchableOpacity>
                    ))
                  : [
                      {
                        value: "campus",
                        label: "Campus",
                        icon: "school-outline" as const,
                      },
                      {
                        value: "connections",
                        label: "Connections",
                        icon: "people-outline" as const,
                      },
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
                          name={v.icon}
                          size={20}
                          color={
                            visibility === v.value
                              ? "#fff"
                              : colors.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.visibilityText,
                            { color: colors.textSecondary },
                            visibility === v.value &&
                              styles.visibilityTextActive,
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
        <DiscardChangesModal
          visible={showDiscardModal}
          onClose={() => setShowDiscardModal(false)}
          onDiscard={handleDiscardChanges}
        />
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
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  saveButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  saveButtonDisabled: {},
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

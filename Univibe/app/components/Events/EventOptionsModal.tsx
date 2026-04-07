// app/components/Events/EventOptionsModal.tsx
import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform, // Add this import
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EventOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  eventId: string;
  isOrganizer: boolean;
  isSaved?: boolean;
  isReported?: boolean;
  isInterested?: boolean;
  isRsvpd?: boolean;
  onEdit?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
  onSave?: (eventId: string) => void;
  onReport?: (eventId: string) => void;
  onShare?: (eventId: string) => void;
  onAddToCalendar?: (eventId: string) => void;
  onMuteOrganizer?: (organizerId: string) => void;
  onBlockOrganizer?: (organizerId: string) => void;
  organizerId?: string;
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
}

const EventOptionsModal: React.FC<EventOptionsModalProps> = ({
  visible,
  onClose,
  eventId,
  isOrganizer,
  isSaved = false,
  isReported = false,
  isInterested = false,
  isRsvpd = false,
  onEdit,
  onDelete,
  onSave,
  onReport,
  onShare,
  onAddToCalendar,
  onMuteOrganizer,
  onBlockOrganizer,
  organizerId,
  eventTitle,
  eventDate,
  eventLocation,
}) => {
  /**
   * Handle edit event action
   */
  const handleEdit = () => {
    onClose();
    if (onEdit) onEdit(eventId);
  };

  /**
   * Handle delete event with confirmation
   */
  const handleDelete = () => {
    Alert.alert(
      "Delete Event",
      "Are you sure you want to delete this event? This action cannot be undone. All RSVPs and interested users will be notified.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onClose();
            if (onDelete) onDelete(eventId);
          },
        },
      ],
    );
  };

  /**
   * Handle save/unsave event
   */
  const handleSave = () => {
    onClose();
    if (onSave) onSave(eventId);
  };

  /**
   * Handle report event with reason selection
   */
  const handleReport = () => {
    Alert.alert(
      "Report Event",
      "Why are you reporting this event?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Spam or Misleading",
          onPress: () => {
            onClose();
            if (onReport) onReport(eventId);
          },
        },
        {
          text: "Inappropriate Content",
          onPress: () => {
            onClose();
            if (onReport) onReport(eventId);
          },
        },
        {
          text: "False Information",
          onPress: () => {
            onClose();
            if (onReport) onReport(eventId);
          },
        },
        {
          text: "Duplicate Event",
          onPress: () => {
            onClose();
            if (onReport) onReport(eventId);
          },
        },
        {
          text: "Harassment or Hate Speech",
          onPress: () => {
            onClose();
            if (onReport) onReport(eventId);
          },
        },
      ],
      { cancelable: true },
    );
  };

  /**
   * Handle share event
   */
  const handleShare = () => {
    onClose();
    if (onShare) onShare(eventId);
  };

  /**
   * Handle add to calendar
   */
  const handleAddToCalendar = () => {
    onClose();
    if (onAddToCalendar) onAddToCalendar(eventId);
  };

  /**
   * Handle mute organizer
   */
  const handleMuteOrganizer = () => {
    Alert.alert(
      "Mute Organizer",
      `Are you sure you want to mute ${eventTitle ? 'the organizer of "' + eventTitle + '"' : "this organizer"}? You won't see events from this organizer anymore.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute",
          style: "destructive",
          onPress: () => {
            onClose();
            if (onMuteOrganizer && organizerId) onMuteOrganizer(organizerId);
          },
        },
      ],
    );
  };

  /**
   * Handle block organizer
   */
  const handleBlockOrganizer = () => {
    Alert.alert(
      "Block Organizer",
      `Are you sure you want to block ${eventTitle ? 'the organizer of "' + eventTitle + '"' : "this organizer"}? You won't see their events and they won't see yours.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            onClose();
            if (onBlockOrganizer && organizerId) onBlockOrganizer(organizerId);
          },
        },
      ],
    );
  };

  /**
   * Render organizer options (Edit/Delete)
   */
  const renderOrganizerOptions = () => (
    <>
      <TouchableOpacity style={styles.optionItem} onPress={handleEdit}>
        <Ionicons name="create-outline" size={22} color="#8b5cf6" />
        <Text style={styles.optionText}>Edit Event</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={22} color="#ef4444" />
        <Text style={[styles.optionText, styles.deleteText]}>Delete Event</Text>
      </TouchableOpacity>

      <View style={styles.divider} />
    </>
  );

  /**
   * Render organizer actions (Mute/Block for attendees)
   */
  const renderOrganizerActions = () => (
    <>
      <TouchableOpacity style={styles.optionItem} onPress={handleMuteOrganizer}>
        <Ionicons name="volume-mute-outline" size={22} color="#6b7280" />
        <Text style={styles.optionText}>Mute Organizer</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionItem}
        onPress={handleBlockOrganizer}
      >
        <Ionicons name="ban-outline" size={22} color="#ef4444" />
        <Text style={[styles.optionText, styles.deleteText]}>
          Block Organizer
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />
    </>
  );

  /**
   * Render common options for all users
   */
  const renderCommonOptions = () => (
    <>
      <TouchableOpacity style={styles.optionItem} onPress={handleSave}>
        <Ionicons
          name={isSaved ? "bookmark" : "bookmark-outline"}
          size={22}
          color={isSaved ? "#8b5cf6" : "#6b7280"}
        />
        <Text style={[styles.optionText, isSaved && styles.savedText]}>
          {isSaved ? "Saved" : "Save Event"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleAddToCalendar}>
        <Ionicons name="calendar-outline" size={22} color="#6b7280" />
        <Text style={styles.optionText}>Add to Calendar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleShare}>
        <Ionicons name="share-outline" size={22} color="#6b7280" />
        <Text style={styles.optionText}>Share Event</Text>
      </TouchableOpacity>
    </>
  );

  /**
   * Render event status info (for non-organizers)
   */
  const renderEventStatus = () => (
    <>
      <View style={styles.statusSection}>
        <View style={styles.statusHeader}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#9ca3af"
          />
          <Text style={styles.statusTitle}>Your Status</Text>
        </View>

        {isInterested && (
          <View style={styles.statusItem}>
            <Ionicons name="heart" size={18} color="#ef4444" />
            <Text style={styles.statusText}>
              You're interested in this event
            </Text>
          </View>
        )}

        {isRsvpd && (
          <View style={styles.statusItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.statusText}>You're attending this event</Text>
          </View>
        )}

        {!isInterested && !isRsvpd && (
          <View style={styles.statusItem}>
            <Ionicons name="ellipsis-horizontal" size={18} color="#9ca3af" />
            <Text style={styles.statusText}>No RSVP or interest yet</Text>
          </View>
        )}
      </View>
      <View style={styles.divider} />
    </>
  );

  /**
   * Render report option (only for non-organizers)
   */
  const renderReportOption = () => (
    <>
      <TouchableOpacity style={styles.optionItem} onPress={handleReport}>
        <Ionicons
          name={isReported ? "flag" : "flag-outline"}
          size={22}
          color={isReported ? "#ef4444" : "#6b7280"}
        />
        <Text style={[styles.optionText, isReported && styles.reportedText]}>
          {isReported ? "Reported" : "Report Event"}
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          {/* Header with event info if available */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Event Options</Text>
              {eventTitle && (
                <Text style={styles.eventTitlePreview} numberOfLines={1}>
                  {eventTitle}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Dynamic Options based on ownership */}
          {isOrganizer ? renderOrganizerOptions() : renderOrganizerActions()}

          {/* Event Status for non-organizers */}
          {!isOrganizer && renderEventStatus()}

          {/* Common Options for all users */}
          {renderCommonOptions()}

          {/* Report option for non-organizers */}
          {!isOrganizer && renderReportOption()}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "SofiaSans-Bold",
    fontWeight: "600",
    color: "#111827",
  },
  eventTitlePreview: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    color: "#9ca3af",
    marginTop: 2,
    maxWidth: 250,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontFamily: "SofiaSans-Regular",
    color: "#374151",
    flex: 1,
  },
  deleteText: {
    color: "#ef4444",
  },
  savedText: {
    color: "#8b5cf6",
  },
  reportedText: {
    color: "#ef4444",
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 8,
  },
  statusSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  statusTitle: {
    fontSize: 13,
    fontFamily: "SofiaSans-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    color: "#374151",
    flex: 1,
  },
});

export default EventOptionsModal; 

// components/DateTimePickerModal.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";

interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}

const CustomModal = ({
  visible,
  onClose,
  onConfirm,
  title,
  children,
}: CustomModalProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
        </View>
        {children}
        <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  date: Date;
  setDate: (date: Date) => void;
  minimumDate?: Date;
}

export const DatePickerModal = ({
  visible,
  onClose,
  onConfirm,
  title,
  date,
  setDate,
  minimumDate,
}: DatePickerModalProps) => {
  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
    >
      <DateTimePicker
        value={date}
        mode="date"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        minimumDate={minimumDate}
        onChange={(e, d) => d && setDate(d)}
        style={styles.datePicker}
      />
    </CustomModal>
  );
};

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  hour: number;
  minute: number;
  setHour: (hour: number) => void;
  setMinute: (minute: number) => void;
}

const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = Array.from({ length: 60 }, (_, i) => i);

export const TimePickerModal = ({
  visible,
  onClose,
  onConfirm,
  title,
  hour,
  minute,
  setHour,
  setMinute,
}: TimePickerModalProps) => {
  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
    >
      <View style={styles.timePickerContainer}>
        <View style={styles.timePickerColumn}>
          <Text style={styles.timePickerLabel}>Hour</Text>
          <Picker
            selectedValue={hour}
            onValueChange={setHour}
            style={styles.timePicker}
          >
            {hours.map((item) => (
              <Picker.Item
                key={item}
                label={item.toString().padStart(2, "0")}
                value={item}
              />
            ))}
          </Picker>
        </View>
        <View style={styles.timePickerColumn}>
          <Text style={styles.timePickerLabel}>Minute</Text>
          <Picker
            selectedValue={minute}
            onValueChange={setMinute}
            style={styles.timePicker}
          >
            {minutes.map((item) => (
              <Picker.Item
                key={item}
                label={item.toString().padStart(2, "0")}
                value={item}
              />
            ))}
          </Picker>
        </View>
        <View style={styles.timePreviewColumn}>
          <Text style={styles.timePickerLabel}>Preview</Text>
          <Text style={styles.timePreview}>
            {`${hour % 12 || 12}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`}
          </Text>
        </View>
      </View>
    </CustomModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    maxHeight: "80%",
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
  datePicker: { height: 200 },
  timePickerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  timePickerColumn: { flex: 1, alignItems: "center" },
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
  timePicker: { width: "100%", height: 150 },
  timePreview: {
    fontSize: 18,
    fontWeight: "600",
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Bold",
    textAlign: "center",
  },
});

export default DatePickerModal;

// app/components/Feed/Comment/ImageModal.tsx
import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface ImageModalProps {
  visible: boolean;
  onClose: () => void;
  images: Array<{ url: string }>;
  selectedIndex: number;
  onScroll: (event: any) => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  visible,
  onClose,
  images,
  selectedIndex,
  onScroll,
}) => {
  return (
    <Modal visible={visible} transparent={true} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.modalClose} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          decelerationRate="fast"
          snapToInterval={screenWidth}
          snapToAlignment="center"
        >
          {images?.map((img, index) => (
            <View key={index} style={styles.modalImageContainer}>
              <Image
                source={{ uri: img.url }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>

        {images?.length > 1 && (
          <View style={styles.modalCounter}>
            <Text style={styles.modalCounterText}>
              {selectedIndex + 1} / {images.length}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  modalClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImageContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  modalCounter: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ImageModal;

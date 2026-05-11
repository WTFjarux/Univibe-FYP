// app/screens/PrivacyPolicy.tsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.lastUpdated}>Last updated: January 2024</Text>

        <Text style={styles.intro}>
          At Univibe, we take your privacy seriously. This Privacy Policy
          explains how we collect, use, disclose, and safeguard your information
          when you use our mobile application. Please read this policy
          carefully. If you do not agree with the terms of this policy, please
          do not access the application.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.heading}>1. Information We Collect</Text>
        <Text style={styles.subheading}>Personal Information</Text>
        <Text style={styles.paragraph}>
          We may collect personally identifiable information that you
          voluntarily provide when registering for an account, such as your
          name, email address, university affiliation, and profile details. You
          may also provide additional information when completing your profile,
          such as your major, graduation year, and social media links.
        </Text>

        <Text style={styles.subheading}>Content and Usage Data</Text>
        <Text style={styles.paragraph}>
          We collect content that you create, post, or share on the platform,
          including text posts, images, comments, and messages. We also collect
          information about how you interact with the app, including features
          used, pages visited, and time spent on the platform to improve your
          experience.
        </Text>

        <Text style={styles.subheading}>Device Information</Text>
        <Text style={styles.paragraph}>
          We automatically collect certain information about your device,
          including device type, operating system, unique device identifiers,
          and mobile network information. This helps us optimize the app for
          different devices and troubleshoot technical issues.
        </Text>

        <Text style={styles.heading}>2. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use the collected information for the following purposes:
        </Text>
        <Text style={styles.bullet}>• To create and manage your account</Text>
        <Text style={styles.bullet}>
          • To provide and personalize campus-specific content
        </Text>
        <Text style={styles.bullet}>
          • To facilitate connections and communication between students
        </Text>
        <Text style={styles.bullet}>
          • To send notifications about activity relevant to you
        </Text>
        <Text style={styles.bullet}>
          • To improve our services and develop new features
        </Text>
        <Text style={styles.bullet}>
          • To detect and prevent fraudulent or abusive behavior
        </Text>
        <Text style={styles.bullet}>• To comply with legal obligations</Text>

        <Text style={styles.heading}>3. Sharing Your Information</Text>
        <Text style={styles.paragraph}>
          We do not sell, trade, or rent your personal information to third
          parties. We may share information in the following circumstances:
        </Text>
        <Text style={styles.bullet}>
          • With your consent or at your direction
        </Text>
        <Text style={styles.bullet}>
          • With service providers who assist in operating our platform
        </Text>
        <Text style={styles.bullet}>
          • To comply with legal requirements or respond to lawful requests
        </Text>
        <Text style={styles.bullet}>
          • To protect the rights, property, or safety of Univibe, our users, or
          others
        </Text>
        <Text style={styles.paragraph}>
          Content you share publicly on Univibe, such as posts and comments, may
          be visible to other users according to your privacy settings and
          visibility preferences.
        </Text>

        <Text style={styles.heading}>4. Data Security</Text>
        <Text style={styles.paragraph}>
          We implement industry-standard security measures to protect your
          personal information from unauthorized access, alteration, disclosure,
          or destruction. These measures include encryption, secure socket layer
          technology, and regular security assessments. However, no method of
          transmission over the Internet or electronic storage is 100% secure,
          and we cannot guarantee absolute security.
        </Text>

        <Text style={styles.heading}>5. Data Retention</Text>
        <Text style={styles.paragraph}>
          We retain your information for as long as your account is active or as
          needed to provide you services. You can delete your account at any
          time, which will remove your profile and content from public view.
          Some information may be retained in our backup systems for a limited
          period before permanent deletion.
        </Text>

        <Text style={styles.heading}>6. Your Rights</Text>
        <Text style={styles.paragraph}>
          Depending on your location, you may have the following rights
          regarding your personal data:
        </Text>
        <Text style={styles.bullet}>
          • Access and receive a copy of your data
        </Text>
        <Text style={styles.bullet}>
          • Correct inaccurate or incomplete information
        </Text>
        <Text style={styles.bullet}>
          • Delete your account and associated data
        </Text>
        <Text style={styles.bullet}>
          • Restrict or object to certain processing activities
        </Text>
        <Text style={styles.bullet}>
          • Data portability to another service provider
        </Text>
        <Text style={styles.paragraph}>
          To exercise these rights, contact us using the information provided
          below. We will respond within a reasonable timeframe.
        </Text>

        <Text style={styles.heading}>7. Cookies and Tracking</Text>
        <Text style={styles.paragraph}>
          We use cookies and similar tracking technologies to enhance your
          experience, analyze app usage patterns, and improve our services. You
          can control cookie preferences through your device settings. Note that
          disabling cookies may affect certain features of the application.
        </Text>

        <Text style={styles.heading}>8. Children's Privacy</Text>
        <Text style={styles.paragraph}>
          Univibe is not intended for individuals under the age of 13. We do not
          knowingly collect personal information from children under 13. If we
          become aware that we have collected such information, we will take
          immediate steps to delete it from our servers.
        </Text>

        <Text style={styles.heading}>9. Third-Party Links</Text>
        <Text style={styles.paragraph}>
          Our application may contain links to third-party websites or services
          that are not owned or controlled by Univibe. We are not responsible
          for the privacy practices of these third parties. We encourage you to
          review the privacy policies of any third-party services you access.
        </Text>

        <Text style={styles.heading}>10. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will notify
          you of any material changes by posting the new policy on this page
          and, where appropriate, through in-app notifications or email. Your
          continued use of Univibe after such modifications constitutes
          acceptance of the updated policy.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.heading}>Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions, concerns, or requests regarding this
          Privacy Policy or our data practices, please contact us:
        </Text>
        <View style={styles.contactCard}>
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={20} color="#8b5cf6" />
            <Text style={styles.contactText}>univibe.fyp@gmail.com</Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="location-outline" size={20} color="#8b5cf6" />
            <Text style={styles.contactText}>
              Herald College Kathmandu, Nepal
            </Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={20} color="#8b5cf6" />
            <Text style={styles.contactText}>+977-9864731469</Text>
          </View>
        </View>

        <Text style={styles.effectiveDate}>
          Effective Date: January 1, 2024
        </Text>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#ffffff",
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  lastUpdated: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 16,
    fontFamily: "SofiaSans-Regular",
  },
  intro: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 24,
    marginBottom: 16,
    fontFamily: "SofiaSans-Regular",
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginTop: 24,
    marginBottom: 10,
    fontFamily: "SofiaSans-Bold",
  },
  subheading: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
    marginBottom: 6,
    fontFamily: "SofiaSans-SemiBold",
  },
  paragraph: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 24,
    marginBottom: 12,
    fontFamily: "SofiaSans-Regular",
  },
  bullet: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 24,
    marginBottom: 4,
    paddingLeft: 8,
    fontFamily: "SofiaSans-Regular",
  },
  contactCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  contactText: {
    fontSize: 15,
    color: "#374151",
    fontFamily: "SofiaSans-Regular",
  },
  effectiveDate: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
  },
  bottomPadding: { height: 20 },
});

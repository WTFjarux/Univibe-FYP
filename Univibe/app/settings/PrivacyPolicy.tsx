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
import { useTheme } from "../../lib/contexts/ThemeContext";

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Privacy Policy
        </Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
          Last updated: January 2024
        </Text>
        <Text style={[styles.intro, { color: colors.text }]}>
          At Univibe, we take your privacy seriously. This Privacy Policy
          explains how we collect, use, disclose, and safeguard your information
          when you use our mobile application. Please read this policy
          carefully. If you do not agree with the terms of this policy, please
          do not access the application.
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.heading, { color: colors.text }]}>
          1. Information We Collect
        </Text>
        <Text style={[styles.subheading, { color: colors.text }]}>
          Personal Information
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We may collect personally identifiable information that you
          voluntarily provide when registering for an account, such as your
          name, email address, university affiliation, and profile details. You
          may also provide additional information when completing your profile,
          such as your major, graduation year, and social media links.
        </Text>
        <Text style={[styles.subheading, { color: colors.text }]}>
          Content and Usage Data
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We collect content that you create, post, or share on the platform,
          including text posts, images, comments, and messages. We also collect
          information about how you interact with the app, including features
          used, pages visited, and time spent on the platform to improve your
          experience.
        </Text>
        <Text style={[styles.subheading, { color: colors.text }]}>
          Device Information
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We automatically collect certain information about your device,
          including device type, operating system, unique device identifiers,
          and mobile network information. This helps us optimize the app for
          different devices and troubleshoot technical issues.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          2. How We Use Your Information
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We use the collected information for the following purposes:
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • To create and manage your account
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • To provide and personalize campus-specific content
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • To facilitate connections and communication between students
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • To send notifications about activity relevant to you
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • To improve our services and develop new features
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • To detect and prevent fraudulent or abusive behavior
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • To comply with legal obligations
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          3. Sharing Your Information
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We do not sell, trade, or rent your personal information to third
          parties. We may share information in the following circumstances:
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • With your consent or at your direction
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • With service providers who assist in operating our platform
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • To comply with legal requirements or respond to lawful requests
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • To protect the rights, property, or safety of Univibe, our users, or
          others
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Content you share publicly on Univibe, such as posts and comments, may
          be visible to other users according to your privacy settings and
          visibility preferences.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          4. Data Security
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We implement industry-standard security measures to protect your
          personal information from unauthorized access, alteration, disclosure,
          or destruction. These measures include encryption, secure socket layer
          technology, and regular security assessments. However, no method of
          transmission over the Internet or electronic storage is 100% secure,
          and we cannot guarantee absolute security.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          5. Data Retention
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We retain your information for as long as your account is active or as
          needed to provide you services. You can delete your account at any
          time, which will remove your profile and content from public view.
          Some information may be retained in our backup systems for a limited
          period before permanent deletion.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          6. Your Rights
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Depending on your location, you may have the following rights
          regarding your personal data:
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Access and receive a copy of your data
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Correct inaccurate or incomplete information
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Delete your account and associated data
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Restrict or object to certain processing activities
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Data portability to another service provider
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          To exercise these rights, contact us using the information provided
          below. We will respond within a reasonable timeframe.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          7. Cookies and Tracking
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We use cookies and similar tracking technologies to enhance your
          experience, analyze app usage patterns, and improve our services. You
          can control cookie preferences through your device settings. Note that
          disabling cookies may affect certain features of the application.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          8. Children's Privacy
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Univibe is not intended for individuals under the age of 13. We do not
          knowingly collect personal information from children under 13. If we
          become aware that we have collected such information, we will take
          immediate steps to delete it from our servers.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          9. Third-Party Links
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Our application may contain links to third-party websites or services
          that are not owned or controlled by Univibe. We are not responsible
          for the privacy practices of these third parties. We encourage you to
          review the privacy policies of any third-party services you access.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          10. Changes to This Policy
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We may update this Privacy Policy from time to time. We will notify
          you of any material changes by posting the new policy on this page
          and, where appropriate, through in-app notifications or email. Your
          continued use of Univibe after such modifications constitutes
          acceptance of the updated policy.
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.heading, { color: colors.text }]}>Contact Us</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          If you have any questions, concerns, or requests regarding this
          Privacy Policy or our data practices, please contact us:
        </Text>
        <View
          style={[
            styles.contactCard,
            { backgroundColor: colors.skeleton, borderColor: colors.border },
          ]}
        >
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
            <Text style={[styles.contactText, { color: colors.text }]}>
              univibe.fyp@gmail.com
            </Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons
              name="location-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.contactText, { color: colors.text }]}>
              Herald College Kathmandu, Nepal
            </Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={20} color={colors.primary} />
            <Text style={[styles.contactText, { color: colors.text }]}>
              +977-9864731469
            </Text>
          </View>
        </View>
        <Text style={[styles.effectiveDate, { color: colors.textMuted }]}>
          Effective Date: January 1, 2024
        </Text>
        <View style={styles.bottomPadding} />
      </ScrollView>
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
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  lastUpdated: {
    fontSize: 13,
    marginBottom: 16,
    fontFamily: "SofiaSans-Regular",
  },
  intro: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
    fontFamily: "SofiaSans-Regular",
  },
  divider: { height: 1, marginVertical: 16 },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 10,
    fontFamily: "SofiaSans-Bold",
  },
  subheading: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
    fontFamily: "SofiaSans-SemiBold",
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
    fontFamily: "SofiaSans-Regular",
  },
  bullet: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 4,
    paddingLeft: 8,
    fontFamily: "SofiaSans-Regular",
  },
  contactCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  contactText: { fontSize: 15, fontFamily: "SofiaSans-Regular" },
  effectiveDate: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
  },
  bottomPadding: { height: 20 },
});

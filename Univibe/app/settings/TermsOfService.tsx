// app/screens/TermsOfService.tsx

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

export default function TermsOfServiceScreen() {
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
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Terms of Service
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
          Welcome to Univibe! These Terms of Service ("Terms") govern your
          access to and use of the Univibe mobile application and related
          services. By accessing or using Univibe, you agree to be bound by
          these Terms. If you do not agree, please discontinue use immediately.
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.heading, { color: colors.text }]}>
          1. Acceptance of Terms
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          By creating an account or using Univibe in any way, you acknowledge
          that you have read, understood, and agree to be bound by these Terms
          and our Privacy Policy. These Terms constitute a legally binding
          agreement between you and Univibe.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          2. Eligibility
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          To use Univibe, you must be at least 13 years of age. If you are
          between 13 and 18, you must have parental or guardian consent to use
          the platform. By using Univibe, you represent and warrant that you
          meet these eligibility requirements.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          3. Account Registration
        </Text>
        <Text style={[styles.subheading, { color: colors.text }]}>
          Accurate Information
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          You agree to provide accurate, current, and complete information
          during registration and to update such information to keep it
          accurate. You are solely responsible for maintaining the
          confidentiality of your login credentials.
        </Text>
        <Text style={[styles.subheading, { color: colors.text }]}>
          Account Security
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          You are responsible for all activities that occur under your account.
          Notify us immediately of any unauthorized use or security breach.
          Univibe is not liable for any loss or damage arising from your failure
          to secure your account.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          4. User Conduct
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          As a Univibe user, you agree to use the platform responsibly. You
          agree NOT to:
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Post content that is unlawful, harmful, threatening, abusive,
          harassing, defamatory, or otherwise objectionable
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Impersonate any person or entity or falsely state your affiliation
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Share content that infringes upon intellectual property rights
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Upload viruses, malware, or any malicious code
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Use the platform for spam, unauthorized advertising, or solicitation
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Attempt to access others' accounts or circumvent security measures
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Harass, bully, intimidate, or harm other users
        </Text>
        <Text style={[styles.bullet, { color: colors.textSecondary }]}>
          • Violate any applicable laws or regulations
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          5. Content Ownership and License
        </Text>
        <Text style={[styles.subheading, { color: colors.text }]}>
          Your Content
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          You retain full ownership of all content you create and share on
          Univibe. By posting content, you grant Univibe a worldwide,
          non-exclusive, royalty-free license to host, use, distribute, modify,
          and display your content solely for the purpose of operating and
          improving the platform.
        </Text>
        <Text style={[styles.subheading, { color: colors.text }]}>
          Univibe Content
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          All trademarks, logos, graphics, and software are the property of
          Univibe and are protected by intellectual property laws. You may not
          copy, modify, or distribute any Univibe content without written
          permission.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          6. Content Moderation
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We reserve the right, but have no obligation, to monitor, review, and
          remove content that violates these Terms or is otherwise deemed
          inappropriate. We may suspend or permanently terminate accounts that
          repeatedly violate our community guidelines without prior notice.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>7. Privacy</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Your privacy is important to us. Our Privacy Policy explains how we
          collect, use, and protect your personal information. By using Univibe,
          you consent to the data practices described in our Privacy Policy.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          8. Third-Party Services
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Univibe may integrate with or contain links to third-party services.
          We are not responsible for the content, accuracy, or practices of
          these services. Your interactions with third parties are solely
          between you and the third party.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          9. Disclaimer of Warranties
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          Univibe is provided on an "as is" and "as available" basis. We make no
          warranties, express or implied, regarding the reliability, accuracy,
          or availability of the platform. We do not guarantee that the service
          will be uninterrupted, secure, or error-free.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          10. Limitation of Liability
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          To the fullest extent permitted by law, Univibe and its affiliates
          shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages arising from your use of the
          platform. Our total liability for any claim shall not exceed the
          amount paid by you, if any, for accessing Univibe.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          11. Indemnification
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          You agree to indemnify and hold harmless Univibe, its team members,
          and affiliates from any claims, damages, losses, or expenses arising
          from your violation of these Terms or your use of the platform.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          12. Termination
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We may terminate or suspend your account at any time, with or without
          cause, including for violation of these Terms. Upon termination, your
          right to use Univibe will immediately cease. You may delete your
          account at any time through the app settings.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          13. Changes to Terms
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          We reserve the right to modify these Terms at any time. Material
          changes will be communicated through the app or via email. Your
          continued use after modifications constitutes acceptance of the
          updated Terms.
        </Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          14. Governing Law
        </Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          These Terms shall be governed by and construed in accordance with the
          laws of Nepal. Any disputes arising from these Terms shall be subject
          to the exclusive jurisdiction of the courts in Kathmandu, Nepal.
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.heading, { color: colors.text }]}>Contact Us</Text>
        <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
          If you have any questions about these Terms of Service, please contact
          our support team:
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

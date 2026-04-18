// Copyright & DMCA screen — static, no database queries.
// Accessible from the profile screen via the "Copyright & Legal" row.
// Hebrew sections: right-aligned. English sections: left-aligned, below a divider.

import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CONTACT_EMAIL = 'neryamaor1@gmail.com';
const EMAIL_SUBJECT = 'Copyright Infringement Report — MuFeed';

export default function CopyrightScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function openEmail() {
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`;
    Linking.openURL(url);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Back button */}
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>→ חזרה</Text>
      </Pressable>

      {/* ── Hebrew sections ────────────────────────────────────────────────── */}

      <Text style={styles.pageTitle}>זכויות יוצרים וחוק</Text>

      <Text style={styles.intro}>
        ״מופיד״ היא פלטפורמה ללימוד ערבית פלסטינית דרך תוכן וידאו קצר.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>תוכן וזכויות יוצרים</Text>
        <Text style={styles.body}>
          ״מופיד״ משתמשת בקטעי וידאו קצרים לצורכי לימוד שפה וניתוח בלשני-תרבותי. אנו מכבדים
          את זכויות היוצרים של יוצרי התוכן. אם אתה בעל הזכויות על תוכן המופיע בפלטפורמה
          ומעוניין שנסיר אותו, אנא צור איתנו קשר.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>דיווח על הפרת זכויות יוצרים (DMCA)</Text>
        <Text style={styles.body}>
          לדיווח על תוכן או לבקשת הסרה, שלח אלינו אימייל עם פרטי התוכן הרלוונטי.
        </Text>
        <Pressable style={styles.emailButton} onPress={openEmail}>
          <Text style={styles.emailButtonText}>צור קשר</Text>
        </Pressable>
        <Text style={styles.emailAddress}>{CONTACT_EMAIL}</Text>
        <Text style={styles.note}>אנו נבחן את כל הדיווחים ונשיב תוך 5 ימי עסקים.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>הצהרת אחריות</Text>
        <Text style={styles.body}>
          האפליקציה מיועדת ללימוד שפה ותרבות. כל סימני המסחר וזכויות היוצרים שייכים
          לבעליהם המקוריים.
        </Text>
      </View>

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── English sections ──────────────────────────────────────────────── */}

      <Text style={styles.pageTitleEn}>Copyright & Legal</Text>

      <Text style={styles.introEn}>
        MuFeed is a language learning platform dedicated to teaching Palestinian Spoken Arabic
        through short video content.
      </Text>

      <View style={styles.sectionEn}>
        <Text style={styles.sectionTitleEn}>Content & Copyright</Text>
        <Text style={styles.bodyEn}>
          MuFeed uses short video clips for language learning and linguistic-cultural analysis. We
          respect the intellectual property rights of content creators. If you are the rights holder
          of content appearing on this platform and would like it removed, please contact us.
        </Text>
      </View>

      <View style={styles.sectionEn}>
        <Text style={styles.sectionTitleEn}>Report Copyright Infringement (DMCA)</Text>
        <Text style={styles.bodyEn}>
          To report content or request removal, please email us with the relevant content details.
        </Text>
        <Pressable style={styles.emailButtonEn} onPress={openEmail}>
          <Text style={styles.emailButtonText}>Contact Us</Text>
        </Pressable>
        <Text style={styles.emailAddressEn}>{CONTACT_EMAIL}</Text>
        <Text style={styles.noteEn}>
          We will review all reports and respond within 5 business days.
        </Text>
      </View>

      <View style={styles.sectionEn}>
        <Text style={styles.sectionTitleEn}>Disclaimer</Text>
        <Text style={styles.bodyEn}>
          This app is dedicated to language and culture learning. All trademarks and copyrights
          belong to their respective owners.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 20,
  },
  backText: {
    color: '#6b7280',
    fontSize: 15,
  },

  // ── Hebrew styles ────────────────────────────────────────────────────────────
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    textAlign: 'right',
    marginBottom: 16,
  },
  intro: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'right',
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    textAlign: 'right',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'right',
    lineHeight: 22,
  },
  emailButton: {
    marginTop: 14,
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'flex-end',
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emailAddress: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'right',
  },
  note: {
    marginTop: 10,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'right',
    lineHeight: 20,
  },

  // ── Divider ──────────────────────────────────────────────────────────────────
  divider: {
    borderTopWidth: 2,
    borderTopColor: '#d1d5db',
    marginVertical: 32,
  },

  // ── English styles ───────────────────────────────────────────────────────────
  pageTitleEn: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    textAlign: 'left',
    marginBottom: 16,
  },
  introEn: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'left',
    lineHeight: 24,
    marginBottom: 24,
  },
  sectionEn: {
    marginBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 20,
  },
  sectionTitleEn: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    textAlign: 'left',
    marginBottom: 10,
  },
  bodyEn: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'left',
    lineHeight: 22,
  },
  emailButtonEn: {
    marginTop: 14,
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  emailAddressEn: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'left',
  },
  noteEn: {
    marginTop: 10,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'left',
    lineHeight: 20,
  },
});

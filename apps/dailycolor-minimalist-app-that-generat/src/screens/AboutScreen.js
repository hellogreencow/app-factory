
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useColorContext } from '../context/AppContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const appVersion = require('../../package.json').version;

export default function AboutScreen() {
  const { theme } = useColorContext();

  const openPrivacyPolicy = () => {
    Linking.openURL('https://example.com/privacy-policy'); // Replace with your actual privacy policy URL
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.backgroundColor }]}>
      <ScrollView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.section}>
          <Text style={[styles.heading, { color: theme.textColor }]}>About DailyColor</Text>
          <Text style={[styles.text, { color: theme.textColor }]}>
            DailyColor is a minimalist app that generates a unique color each day based on the date.
          </Text>
          <Text style={[styles.text, { color: theme.textColor }]}>Version: {appVersion}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.heading, { color: theme.textColor }]}>Credits</Text>
          <Text style={[styles.text, { color: theme.textColor }]}>
            Developed by: Your Name
          </Text>
          <Text style={[styles.text, { color: theme.textColor }]}>
            Libraries Used:
          </Text>
          <Text style={[styles.listItem, { color: theme.textColor }]}>- React Native</Text>
          <Text style={[styles.listItem, { color: theme.textColor }]}>- Expo</Text>
          <Text style={[styles.listItem, { color: theme.textColor }]}>- @react-native-async-storage/async-storage</Text>
          <Text style={[styles.listItem, { color: theme.textColor }]}>- react-native-safe-area-context</Text>
          <Text style={[styles.listItem, { color: theme.textColor }]}>- @react-navigation/*</Text>
          <Text style={[styles.listItem, { color: theme.textColor }]}>- date-fns</Text>
          <Text style={[styles.listItem, { color: theme.textColor }]}>- expo-status-bar</Text>
          <Text style={[styles.listItem, { color: theme.textColor }]}>- expo-vector-icons</Text>
        </View>

        <TouchableOpacity style={styles.privacyPolicyButton} onPress={openPrivacyPolicy} testID="privacy-policy-button" accessibilityLabel="Privacy Policy">
          <Text style={styles.privacyPolicyText}>Privacy Policy</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    marginBottom: 5,
  },
  listItem: {
    fontSize: 16,
    marginLeft: 10,
  },
  privacyPolicyButton: {
    marginTop: 20,
  },
  privacyPolicyText: {
    color: '#BB86FC',
    fontSize: 16,
  },
});

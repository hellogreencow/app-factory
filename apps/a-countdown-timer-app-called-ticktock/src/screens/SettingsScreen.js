import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTimerContext } from '../context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen = () => {
  const { theme } = useContext(useTimerContext);
  const [isDarkMode, setIsDarkMode] = useState(theme.theme === 'dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const toggleTheme = async () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    // Implement theme switching logic here, e.g., using context or Redux
    try {
      await AsyncStorage.setItem('@ticktock_theme', newTheme);
      // Reload the app or update the context
    } catch (error) {
      console.error("Error saving theme to AsyncStorage:", error);
    }
    console.log("Theme toggled to:", newTheme);
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
    // Implement notification settings logic here
    console.log("Notifications toggled to:", !notificationsEnabled);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <LinearGradient
        colors={[theme.accentColor, theme.secondaryAccent]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerText}>Settings</Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Theme</Text>
        <View style={[styles.settingItem, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
          <View style={styles.settingInfo}>
            <Ionicons name="ios-moon-outline" size={24} color={theme.textColor} style={styles.icon} />
            <Text style={[styles.settingLabel, { color: theme.textColor }]}>Dark Mode</Text>
            <Text style={[styles.settingDescription, { color: theme.textColor }]}>
              {isDarkMode ? "Deep night" : "Pure light"}
            </Text>
          </View>
          <Switch
            testID="theme-switch"
            accessibilityLabel="theme-switch"
            trackColor={{ false: "#767577", true: theme.secondaryAccent }}
            thumbColor={isDarkMode ? theme.accentColor : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={toggleTheme}
            value={isDarkMode}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Notifications</Text>
        <View style={[styles.settingItem, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications-outline" size={24} color={theme.textColor} style={styles.icon} />
            <Text style={[styles.settingLabel, { color: theme.textColor }]}>Timer Completion</Text>
            <Text style={[styles.settingDescription, { color: theme.textColor }]}>
              Receive notifications when timers complete.
            </Text>
          </View>
          <Switch
            testID="notification-switch"
            accessibilityLabel="notification-switch"
            trackColor={{ false: "#767577", true: theme.secondaryAccent }}
            thumbColor={notificationsEnabled ? theme.accentColor : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={toggleNotifications}
            value={notificationsEnabled}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>About</Text>
        <View style={[styles.aboutSection, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
          <Text style={[styles.aboutText, { color: theme.textColor }]}>
            TickTock - A modern countdown timer app.
          </Text>
          <Text style={[styles.aboutText, { color: theme.textColor }]}>
            Created with React Native and Expo.
          </Text>
          <Text style={[styles.aboutText, { color: theme.textColor }]}>
            Version 1.0.0
          </Text>
          <TouchableOpacity testID="about-credits" accessibilityLabel="about-credits">
            <Text style={[styles.creditsText, { color: theme.secondaryAccent }]}>
              Credits & Acknowledgements
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginBottom: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerGradient: {
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 10,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingDescription: {
    fontSize: 14,
    color: 'gray',
  },
  icon: {
    marginRight: 10,
  },
  aboutSection: {
    padding: 16,
  },
  aboutText: {
    fontSize: 14,
    marginBottom: 8,
  },
  creditsText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
});

export default SettingsScreen;

import React, { useContext, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { AppContext } from '../context/AppContext';

const ProfileScreen = () => {
  const { theme } = useContext(AppContext);
  const [isDarkMode, setIsDarkMode] = useState(theme.theme === 'dark');

  useEffect(() => {
    setIsDarkMode(theme.theme === 'dark');
  }, [theme.theme]);

  const toggleDarkMode = async () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    try {
      await AsyncStorage.setItem('theme', newTheme);
      // Reload the app or use a context update function to apply the new theme
      // For simplicity, we'll just show an alert here.
      Alert.alert('Theme Changed', 'Please restart the app to apply the new theme.');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
    setIsDarkMode(!isDarkMode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          testID: 'logout-cancel-button',
          accessibilityLabel: 'Cancel logout',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            // Implement logout logic here (e.g., clear user data, navigate to login screen)
            console.log('Logout pressed');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
          testID: 'logout-confirm-button',
          accessibilityLabel: 'Confirm logout',
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <LinearGradient
      colors={[theme.backgroundColor, theme.cardColor]}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.profileInfoContainer} testID="profile-info-container">
          <Ionicons name="person-circle-outline" size={80} color={theme.accentColor} testID="profile-icon" accessibilityLabel="Profile Icon" />
          <Text style={[styles.profileName, { color: theme.textColor }]} testID="profile-name">
            The Observer
          </Text>
          <Text style={[styles.profileEmail, { color: theme.secondaryAccent }]} testID="profile-email">
            user@example.com
          </Text>
        </View>

        <View style={styles.settingsContainer} testID="settings-container">
          <Text style={[styles.settingsTitle, { color: theme.textColor }]}>Apparatus Calibration</Text>

          <View style={[styles.settingItem, { backgroundColor: theme.cardColor }]}>
            <View style={styles.settingItemLeft}>
              <Ionicons name="moon-outline" size={24} color={theme.textColor} testID="dark-mode-icon" accessibilityLabel="Dark Mode Icon" />
              <Text style={[styles.settingText, { color: theme.textColor }]}>Dark Mode</Text>
            </View>
            <Switch
              trackColor={{ false: "#767577", true: theme.secondaryAccent }}
              thumbColor={isDarkMode ? theme.accentColor : "#f4f3f4"}
              ios_backgroundColor="#3e3e3e"
              onValueChange={toggleDarkMode}
              value={isDarkMode}
              testID="dark-mode-switch"
              accessibilityLabel="Toggle Dark Mode"
            />
          </View>

          {/* Add more settings options here */}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.accentColor }]}
          onPress={handleLogout}
          testID="logout-button"
          accessibilityLabel="Logout"
        >
          <Ionicons name="log-out-outline" size={24} color={theme.textColor} style={styles.logoutIcon} testID="logout-icon" accessibilityLabel="Logout Icon"/>
          <Text style={[styles.logoutButtonText, { color: theme.textColor }]}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
  },
  profileInfoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  profileEmail: {
    fontSize: 16,
    color: 'gray',
  },
  settingsContainer: {
    width: '100%',
    marginBottom: 30,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 18,
    marginLeft: 10,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    width: '100%',
  },
  logoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutIcon: {
    marginRight: 10,
  },
});

export default ProfileScreen;

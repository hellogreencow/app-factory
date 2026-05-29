import React, { useContext, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

import { AppContext } from '../context/AppContext';

const SettingsScreen = () => {
  const { theme, setTheme, items, useLogs } = useContext(AppContext);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const toggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTheme(prevTheme => ({
      ...prevTheme,
      theme: prevTheme.theme === 'dark' ? 'light' : 'dark',
      backgroundColor: prevTheme.theme === 'dark' ? '#FFFFFF' : '#121212',
      cardColor: prevTheme.theme === 'dark' ? '#F0F0F0' : '#1E1E1E',
      textColor: prevTheme.theme === 'dark' ? '#000000' : '#FFFFFF',
    }));
  };

  const toggleNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotificationsEnabled(!notificationsEnabled);
  };

  const exportData = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const data = {
        items: items || [],
        useLogs: useLogs || [],
      };
      const filename = FileSystem.documentDirectory + 'price_per_use_data.json';
      await FileSystem.writeAsStringAsync(filename, JSON.stringify(data, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(filename, {
          mimeType: 'application/json',
          dialogTitle: 'Export PricePerUse Data',
          UTI: 'com.json',
        });
      } else {
        await Sharing.shareAsync(filename, {
          mimeType: 'application/json',
          dialogTitle: 'Export PricePerUse Data',
        });
      }

    } catch (err) {
      console.error(err);
      Alert.alert("Export Failed", "There was an error exporting the data. Please try again.");
    }
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
          <View style={styles.settingLeft}>
            <Ionicons name="ios-moon-outline" size={24} color={theme.textColor} />
            <Text style={[styles.settingText, { color: theme.textColor }]}>Dark Mode</Text>
          </View>
          <Switch
            testID="theme-toggle-switch"
            accessibilityLabel="Toggle Dark Mode"
            trackColor={{ false: '#767577', true: theme.secondaryAccent }}
            thumbColor={theme.theme === 'dark' ? theme.accentColor : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
            onValueChange={toggleTheme}
            value={theme.theme === 'dark'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Notifications</Text>
        <View style={[styles.settingItem, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}>
          <View style={styles.settingLeft}>
            <Ionicons name="ios-notifications-outline" size={24} color={theme.textColor} />
            <Text style={[styles.settingText, { color: theme.textColor }]}>Enable Notifications</Text>
          </View>
          <Switch
            testID="notification-settings-switch"
            accessibilityLabel="Enable Notifications"
            trackColor={{ false: '#767577', true: theme.secondaryAccent }}
            thumbColor={notificationsEnabled ? theme.accentColor : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
            onValueChange={toggleNotifications}
            value={notificationsEnabled}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Data</Text>
        <TouchableOpacity
          style={[styles.settingItem, { backgroundColor: theme.cardColor, borderRadius: theme.borderRadius }]}
          onPress={exportData}
          testID="data-export-button"
          accessibilityLabel="Export Data"
        >
          <View style={styles.settingLeft}>
            <MaterialIcons name="file-download" size={24} color={theme.textColor} />
            <Text style={[styles.settingText, { color: theme.textColor }]}>Export Data</Text>
          </View>
          <Ionicons name="ios-chevron-forward" size={20} color={theme.textColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.textColor }]}>PricePerUse App</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  headerGradient: {
    padding: 20,
    borderRadius: 15,
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
    fontWeight: '600',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 10,
    marginBottom: 10,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    marginLeft: 10,
  },
  footer: {
    alignItems: 'center',
    marginTop: 30,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: 'gray',
  },
});

export default SettingsScreen;

import React, { useContext, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';

import { AppContext } from '../context/AppContext';

const generateTestID = (base) => `settings-screen-${base}`;

export default function SettingsScreen() {
  const { theme, setTheme, poops, setPoops } = useContext(AppContext);
  const [isDarkMode, setIsDarkMode] = useState(theme?.backgroundColor === '#121212');

  const toggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newTheme = isDarkMode
      ? {
        backgroundColor: "#FFFFFF",
        cardColor: "#F0F0F0",
        textColor: "#000000",
        accentColor: "#6200EE",
        secondaryAccent: "#3700B3",
        borderRadius: 8
      }
      : {
        backgroundColor: "#121212",
        cardColor: "#212121",
        textColor: "#FFFFFF",
        accentColor: "#03DAC5",
        secondaryAccent: "#BB86FC",
        borderRadius: 8
      };

    setIsDarkMode(!isDarkMode);
    setTheme(newTheme);
  };

  const exportData = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const filename = FileSystem.documentDirectory + 'pooptrack_data.json';
      await FileSystem.writeAsStringAsync(filename, JSON.stringify(poops || []), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Sharing not available", "Sharing is not available on this device.");
        return;
      }

      await Sharing.shareAsync(filename, {
        mimeType: 'application/json',
        dialogTitle: 'Share PoopTrack Data',
        UTI: 'com.json',
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      Alert.alert('Error', 'Could not export data. Please try again.');
    }
  };

  const clearData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Clear Data",
      "Are you sure you want to clear all poop data? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "OK",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('@pooptrack_poops');
              setPoops([]);
              Alert.alert("Data Cleared", "All poop data has been cleared.");
            } catch (error) {
              console.error("Error clearing data:", error);
              Alert.alert('Error', 'Could not clear data. Please try again.');
            }
          }
        }
      ],
      { cancelable: false }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme?.backgroundColor }]}>
      <LinearGradient
        colors={[theme?.secondaryAccent || '#BB86FC', theme?.accentColor || '#03DAC5']}
        style={styles.headerGradient}
      />
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme?.textColor }]}>Theme</Text>
          <View style={[styles.settingItem, { backgroundColor: theme?.cardColor }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="ios-moon" size={24} color={theme?.textColor} style={styles.settingIcon} />
              <Text style={[styles.settingText, { color: theme?.textColor }]}>Dark Mode</Text>
            </View>
            <Switch
              trackColor={{ false: "#767577", true: theme?.accentColor }}
              thumbColor={isDarkMode ? theme?.secondaryAccent : "#f4f3f4"}
              ios_backgroundColor="#3e3e3e"
              onValueChange={toggleTheme}
              value={isDarkMode}
              testID={generateTestID('theme-toggle-switch')}
              accessibilityLabel="Toggle dark mode"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme?.textColor }]}>Data Management</Text>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme?.cardColor }]}
            onPress={exportData}
            testID={generateTestID('export-data-button')}
            accessibilityLabel="Export data"
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="file-upload" size={24} color={theme?.textColor} style={styles.settingIcon} />
              <Text style={[styles.settingText, { color: theme?.textColor }]}>Export Data</Text>
            </View>
            <Ionicons name="ios-download-outline" size={24} color={theme?.textColor} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme?.cardColor }]}
            onPress={clearData}
            testID={generateTestID('clear-data-button')}
            accessibilityLabel="Clear data"
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="delete" size={24} color={theme?.textColor} style={styles.settingIcon} />
              <Text style={[styles.settingText, { color: theme?.textColor }]}>Clear Data</Text>
            </View>
            <Ionicons name="ios-trash-outline" size={24} color={theme?.textColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    height: 80,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  scrollContainer: {
    padding: 20,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 10,
  },
  settingText: {
    fontSize: 16,
  },
  spacer: {
    height: 20,
  },
});

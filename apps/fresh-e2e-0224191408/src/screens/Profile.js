import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, SafeAreaView, Switch, FlatList, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

import { useAppData } from '../context/AppContext';

const Profile = () => {
  const { debts } = useAppData();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  const toggleNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotificationsEnabled(previousState => !previousState);
  };

  const toggleDarkMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDarkModeEnabled(previousState => !previousState);
  };

  const exportData = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const filename = 'snapdebt_data.json';
      const fileUri = FileSystem.documentDirectory + filename;
      const data = JSON.stringify(debts, null, 2);

      await FileSystem.writeAsStringAsync(fileUri, data, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Share SnapDebt Data',
          UTI: 'public.json',
        });
      } else {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Share SnapDebt Data',
        });
      }
    } catch (error) {
      console.error("Error exporting data:", error);
    }
  }, [debts]);

  const renderItem = ({ item }) => (
    <View style={styles.listItem}>
      <Text style={styles.listItemText}>{item.label}</Text>
      <Switch
        trackColor={{ false: "#767577", true: "#CCFF00" }}
        thumbColor={item.value ? "#f4f3f4" : "#f4f3f4"}
        ios_backgroundColor="#3e3e3e"
        onValueChange={item.onToggle}
        value={item.value}
        testID={item.testID}
        accessibilityLabel={item.label}
      />
    </View>
  );

  const settingsData = [
    {
      id: 'notifications',
      label: 'Enable Notifications',
      value: notificationsEnabled,
      onToggle: toggleNotifications,
      testID: 'notifications-switch',
    },
    {
      id: 'dark-mode',
      label: 'Dark Mode',
      value: darkModeEnabled,
      onToggle: toggleDarkMode,
      testID: 'dark-mode-switch',
    },
  ];

  const credibilityScore = useMemo(() => {
    if (!debts || debts.length === 0) return 100;

    const totalDebts = debts.length;
    const resolvedDebts = debts.filter(debt => debt.status === 'resolved').length;

    return Math.max(0, Math.min(100, Math.round((resolvedDebts / totalDebts) * 100)));
  }, [debts]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#000000', '#0A0A0A']}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.headerText}>Profile</Text>
          <Ionicons name="person-circle-outline" size={40} color="#39FF14" />
        </View>

        <FlatList
          data={settingsData}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          style={styles.list}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Statistics</Text>
          <View style={styles.statsCard}>
            <Text style={styles.statsText}>Credibility Score: <Text style={styles.score}>{credibilityScore}%</Text></Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={exportData}
          testID="export-data-button"
          accessibilityLabel="Archive My History"
        >
          <Ionicons name="download-outline" size={24} color="#FFFFFF" />
          <Text style={styles.exportButtonText}>Export Data</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SnapDebt v{Constants.expoConfig.version}</Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  list: {
    marginBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 15,
    marginBottom: 10,
    borderRadius: 16,
  },
  listItemText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  statsCard: {
    backgroundColor: '#1A1A1A',
    padding: 15,
    borderRadius: 16,
  },
  statsText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  score: {
    color: "#39FF14",
    fontWeight: "bold",
  },
  exportButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#39FF14',
    padding: 15,
    borderRadius: 16,
  },
  exportButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  footer: {
    alignItems: 'center',
    marginTop: 30,
  },
  footerText: {
    color: 'gray',
    fontSize: 12,
  },
});

export default Profile;

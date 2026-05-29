import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Platform, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AppContext } from '../../src/context/AppContext';

const SettingsScreen = () => {
  const { theme } = useContext(AppContext);
  const [isDarkMode, setIsDarkMode] = useState(theme.theme === 'dark');
  const [currency, setCurrency] = useState('USD'); // Example currency state
  const [accountName, setAccountName] = useState('John Doe');
  const insets = useSafeAreaInsets();

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
    // Implement theme switching logic here (e.g., update context)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleCurrencyChange = (newCurrency) => {
    setCurrency(newCurrency);
    // Implement currency setting logic here (e.g., update context)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAccountManagement = () => {
    // Implement account management navigation or logic here
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleAccountNameChange = (text) => {
    setAccountName(text);
    // Implement account name saving logic here
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor, paddingTop: insets.top }]}>
      <LinearGradient
        colors={[theme.accentColor, theme.secondaryAccent]}
        style={styles.gradientHeader}
        start={[0, 0]}
        end={[1, 1]}
      >
        <Text style={styles.headerText}>Settings</Text>
      </LinearGradient>

      <View style={styles.settingsList}>
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="ios-moon" size={24} color={theme.textColor} testID="theme-toggle-icon" accessibilityLabel="Theme Toggle Icon" />
            <Text style={[styles.settingText, { color: theme.textColor }]}>Dark Mode</Text>
          </View>
          <Switch
            trackColor={{ false: "#767577", true: theme.secondaryAccent }}
            thumbColor={isDarkMode ? theme.accentColor : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={handleThemeToggle}
            value={isDarkMode}
            testID="theme-toggle-switch"
            accessibilityLabel="Dark Mode Toggle"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <MaterialIcons name="attach-money" size={24} color={theme.textColor} testID="currency-settings-icon" accessibilityLabel="Currency Settings Icon" />
            <Text style={[styles.settingText, { color: theme.textColor }]}>Currency</Text>
          </View>
          <View style={styles.currencyOptions}>
            <TouchableOpacity
              style={[styles.currencyButton, currency === 'USD' && styles.currencyButtonActive]}
              onPress={() => handleCurrencyChange('USD')}
              testID="currency-usd-button"
              accessibilityLabel="Set currency to USD"
            >
              <Text style={[styles.currencyButtonText, { color: theme.textColor }]}>USD</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.currencyButton, currency === 'EUR' && styles.currencyButtonActive]}
              onPress={() => handleCurrencyChange('EUR')}
              testID="currency-eur-button"
              accessibilityLabel="Set currency to EUR"
            >
              <Text style={[styles.currencyButtonText, { color: theme.textColor }]}>EUR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.currencyButton, currency === 'GBP' && styles.currencyButtonActive]}
              onPress={() => handleCurrencyChange('GBP')}
              testID="currency-gbp-button"
              accessibilityLabel="Set currency to GBP"
            >
              <Text style={[styles.currencyButtonText, { color: theme.textColor }]}>GBP</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="person" size={24} color={theme.textColor} testID="account-management-icon" accessibilityLabel="Account Management Icon" />
            <Text style={[styles.settingText, { color: theme.textColor }]}>Account Name</Text>
          </View>
          <TextInput
            style={[styles.accountNameInput, { color: theme.textColor, backgroundColor: theme.cardColor, borderColor: theme.accentColor }]}
            onChangeText={handleAccountNameChange}
            value={accountName}
            placeholder="Enter your name"
            placeholderTextColor="gray"
            testID="account-name-input"
            accessibilityLabel="Account Name Input"
          />
        </View>

        <TouchableOpacity
          style={styles.accountButton}
          onPress={handleAccountManagement}
          testID="account-management-button"
          accessibilityLabel="Vault & Security"
        >
          <Text style={[styles.accountButtonText, { color: theme.textColor }]}>Manage Account</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientHeader: {
    padding: 20,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  settingsList: {
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 18,
    marginLeft: 10,
  },
  currencyOptions: {
    flexDirection: 'row',
  },
  currencyButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    marginHorizontal: 4,
  },
  currencyButtonActive: {
    borderColor: '#007AFF',
  },
  currencyButtonText: {
    fontSize: 16,
  },
  accountButton: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountButtonText: {
    fontSize: 18,
  },
  accountNameInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    fontSize: 16,
    width: '50%',
    textAlign: 'right',
  },
});

export default SettingsScreen;

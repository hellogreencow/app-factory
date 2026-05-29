import React, { useContext } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { AppProvider, AppContext } from './src/context/AppContext';
import ItemsScreen from './src/screens/ItemsScreen';
import AddItemScreen from './src/screens/AddItemScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const AppContent = () => {
  const { theme } = useContext(AppContext);

  return (
    <>
      <StatusBar style={theme.theme === 'dark' ? 'light' : 'dark'} backgroundColor={theme.backgroundColor} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Items') {
              iconName = 'pricetag-outline';
            } else if (route.name === 'Add Item') {
              iconName = 'add-circle-outline';
            } else if (route.name === 'Statistics') {
              iconName = 'stats-chart-outline';
            } else if (route.name === 'Settings') {
              iconName = 'settings-outline';
            }

            return <Ionicons testID={`${route.name}-tab-icon`} accessibilityLabel={`${route.name} Tab Icon`} name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: theme.accentColor,
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: {
            backgroundColor: theme.cardColor,
            borderTopColor: theme.cardColor,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen
          name="Items"
          component={ItemsScreen}
          options={{ tabBarButtonTestID: 'items-tab-button', accessibilityLabel: 'Items Tab' }}
        />
        <Tab.Screen
          name="Add Item"
          component={AddItemScreen}
          options={{ tabBarButtonTestID: 'add-item-tab-button', accessibilityLabel: 'Add Item Tab' }}
        />
        <Tab.Screen
          name="Statistics"
          component={StatisticsScreen}
          options={{ tabBarButtonTestID: 'statistics-tab-button', accessibilityLabel: 'Statistics Tab' }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarButtonTestID: 'settings-tab-button', accessibilityLabel: 'Settings Tab' }}
        />
      </Tab.Navigator>
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <AppContent />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

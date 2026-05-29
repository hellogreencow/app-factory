import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider, AppContext } from './src/context/AppContext';

import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

const AppContent = () => {
  const { theme } = useContext(AppContext);

  const isDarkTheme = theme?.theme === 'dark';

  return (
    <NavigationContainer>
      <StatusBar style={isDarkTheme ? 'light' : 'dark'} backgroundColor={theme?.backgroundColor} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Map') {
              iconName = focused ? 'map' : 'map-outline';
            } else if (route.name === 'Stats') {
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: theme?.accentColor,
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: {
            backgroundColor: theme?.cardColor,
            borderTopColor: theme?.cardColor,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarButtonTestID: 'home-tab-button' }}
        />
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{ tabBarButtonTestID: 'map-tab-button' }}
        />
        <Tab.Screen
          name="Stats"
          component={StatsScreen}
          options={{ tabBarButtonTestID: 'stats-tab-button' }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarButtonTestID: 'settings-tab-button' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppContent />
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

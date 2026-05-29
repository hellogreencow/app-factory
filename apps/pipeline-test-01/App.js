import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, AppContext } from './src/context/AppContext';

import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const AppContent = () => {
  const { theme } = useContext(AppContext);

  return (
    <NavigationContainer>
      <StatusBar style={theme.backgroundColor === '#121212' ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = 'home';
            } else if (route.name === 'Camera') {
              iconName = 'camera';
            } else if (route.name === 'History') {
              iconName = 'time';
            } else if (route.name === 'Settings') {
              iconName = 'settings';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: theme.accentColor,
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: {
            backgroundColor: theme.backgroundColor,
            borderTopColor: theme.cardColor,
            borderTopWidth: 1,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarButtonTestID: 'home-tab' }}
        />
        <Tab.Screen
          name="Camera"
          component={CameraScreen}
          options={{ tabBarButtonTestID: 'camera-tab' }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{ tabBarButtonTestID: 'history-tab' }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarButtonTestID: 'settings-tab' }}
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
  },
});

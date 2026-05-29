import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, AppContext } from './src/context/AppContext';

import Home from './src/screens/Home';
import History from './src/screens/History';
import Themes from './src/screens/Themes';
import Stats from './src/screens/Stats';
import Settings from './src/screens/Settings';

const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { theme } = useContext(AppContext);

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0a0a0a',
            borderTopColor: '#1a1a1a',
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#00d4ff',
          tabBarInactiveTintColor: '#666666',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={Home}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-home',
            tabBarAccessibilityLabel: 'Home tab',
          }}
        />
        <Tab.Screen
          name="History"
          component={History}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-history',
            tabBarAccessibilityLabel: 'History tab',
          }}
        />
        <Tab.Screen
          name="Themes"
          component={Themes}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="color-palette" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-themes',
            tabBarAccessibilityLabel: 'Themes tab',
          }}
        />
        <Tab.Screen
          name="Stats"
          component={Stats}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-stats',
            tabBarAccessibilityLabel: 'Stats tab',
          }}
        />
        <Tab.Screen
          name="Settings"
          component={Settings}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-settings',
            tabBarAccessibilityLabel: 'Settings tab',
          }}
        />
      </Tab.Navigator>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}

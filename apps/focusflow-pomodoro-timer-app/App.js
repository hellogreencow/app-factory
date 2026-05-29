import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { FocusFlowProvider, FocusFlowContext } from './src/context/FocusFlowContext';

import TimerScreen from './src/screens/TimerScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function TabNavigator() {
  const context = useContext(FocusFlowContext);
  const theme = context?.theme ?? {
    backgroundColor: '#0f0f1a',
    textColor: '#e0e0e8',
    accentColor: '#6366f1',
    cardColor: '#1a1a2e',
  };

  const isDark = theme.backgroundColor === '#0f0f1a';

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.cardColor,
            borderTopColor: theme.backgroundColor,
            borderTopWidth: 1,
            paddingBottom: 8,
            paddingTop: 8,
            height: 64,
          },
          tabBarActiveTintColor: theme.accentColor,
          tabBarInactiveTintColor: theme.textColor + '80',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="Timer"
          component={TimerScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="timer-outline" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-timer',
            tabBarAccessibilityLabel: 'Timer tab',
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-history',
            tabBarAccessibilityLabel: 'History tab',
          }}
        />
        <Tab.Screen
          name="Stats"
          component={StatsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart-outline" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-stats',
            tabBarAccessibilityLabel: 'Stats tab',
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
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
    <FocusFlowProvider>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </FocusFlowProvider>
  );
}

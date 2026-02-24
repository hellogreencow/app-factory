import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TrackerProvider } from './src/context/TrackerContext';
import CalendarScreen from './src/screens/CalendarScreen';
import DayEntryScreen from './src/screens/DayEntryScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const hdr = { headerStyle: { backgroundColor: '#0d1117' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } };

function TrackerStack() {
  return (
    <Stack.Navigator screenOptions={hdr}>
      <Stack.Screen name="CalendarHome" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="DayEntry" component={DayEntryScreen} options={{ title: 'Entry' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <TrackerProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: '#161b22', borderTopColor: '#30363d' }, tabBarActiveTintColor: '#58a6ff', tabBarInactiveTintColor: '#8b949e' }}>
          <Tab.Screen
            name="Home"
            component={TrackerStack}
            options={{ tabBarLabel: 'Calendar', tabBarButtonTestID: 'tab-calendar', tabBarAccessibilityLabel: 'Tab: Calendar' }}
          />
          <Tab.Screen
            name="Stats"
            component={StatsScreen}
            options={{ title: 'Stats', tabBarButtonTestID: 'tab-stats', tabBarAccessibilityLabel: 'Tab: Stats' }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings', tabBarButtonTestID: 'tab-settings', tabBarAccessibilityLabel: 'Tab: Settings' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </TrackerProvider>
  );
}

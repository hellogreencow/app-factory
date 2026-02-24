import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FeedProvider } from './src/context/FeedContext';
import FeedScreen from './src/screens/FeedScreen';
import ComposeScreen from './src/screens/ComposeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const hdr = { headerStyle: { backgroundColor: '#0d1117' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } };

function FeedStack() {
  return (
    <Stack.Navigator screenOptions={hdr}>
      <Stack.Screen name="FeedHome" component={FeedScreen} options={{ title: 'Feed' }} />
      <Stack.Screen name="Compose" component={ComposeScreen} options={{ title: 'Compose' }} />
    </Stack.Navigator>
  );
}

function TabNav() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: '#161b22', borderTopColor: '#30363d' }, tabBarActiveTintColor: '#58a6ff', tabBarInactiveTintColor: '#8b949e' }}>
      <Tab.Screen
        name="Home"
        component={FeedStack}
        options={{ tabBarLabel: 'Feed', tabBarButtonTestID: 'tab-feed', tabBarAccessibilityLabel: 'Tab: Feed' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile', tabBarButtonTestID: 'tab-profile', tabBarAccessibilityLabel: 'Tab: Profile' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', tabBarButtonTestID: 'tab-settings', tabBarAccessibilityLabel: 'Tab: Settings' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <FeedProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <TabNav />
      </NavigationContainer>
    </FeedProvider>
  );
}

import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { DreamDriftProvider, DreamDriftContext } from './src/context/DreamDriftContext';

import SoundsLibrary from './src/screens/SoundsLibrary';
import SoundMixer from './src/screens/SoundMixer';
import SleepTimer from './src/screens/SleepTimer';
import Favorites from './src/screens/Favorites';
import Settings from './src/screens/Settings';

const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { theme } = useContext(DreamDriftContext);

  return (
    <>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.cardColor,
            borderTopColor: theme.accentColor,
            borderTopWidth: 1,
            paddingBottom: 8,
            paddingTop: 8,
            height: 65,
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
          name="Sounds"
          component={SoundsLibrary}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="musical-notes" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-sounds',
            tabBarAccessibilityLabel: 'Sounds Library Tab',
          }}
        />
        <Tab.Screen
          name="Mix"
          component={SoundMixer}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="layers" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-mix',
            tabBarAccessibilityLabel: 'Sound Mixer Tab',
          }}
        />
        <Tab.Screen
          name="Timer"
          component={SleepTimer}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="timer" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-timer',
            tabBarAccessibilityLabel: 'Sleep Timer Tab',
          }}
        />
        <Tab.Screen
          name="Favorites"
          component={Favorites}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="heart" size={size} color={color} />
            ),
            tabBarButtonTestID: 'tab-favorites',
            tabBarAccessibilityLabel: 'Favorites Tab',
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
            tabBarAccessibilityLabel: 'Settings Tab',
          }}
        />
      </Tab.Navigator>
    </>
  );
}

export default function App() {
  return (
    <DreamDriftProvider>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </DreamDriftProvider>
  );
}

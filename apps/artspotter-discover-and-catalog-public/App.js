import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider, AppContext } from './src/context/AppContext';

import MapView from './src/screens/MapView';
import Discover from './src/screens/Discover';
import AddArt from './src/screens/AddArt';
import Gallery from './src/screens/Gallery';
import Profile from './src/screens/Profile';

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
            backgroundColor: '#1A1F2E',
            borderTopWidth: 1,
            borderTopColor: '#2A2F3E',
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#6C5CE7',
          tabBarInactiveTintColor: '#8B8FA3',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="Map"
          component={MapView}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'map' : 'map-outline'}
                size={size}
                color={color}
              />
            ),
            tabBarButtonTestID: 'tab-map',
            tabBarAccessibilityLabel: 'Map tab',
          }}
        />
        <Tab.Screen
          name="Discover"
          component={Discover}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'compass' : 'compass-outline'}
                size={size}
                color={color}
              />
            ),
            tabBarButtonTestID: 'tab-discover',
            tabBarAccessibilityLabel: 'Discover tab',
          }}
        />
        <Tab.Screen
          name="Add"
          component={AddArt}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'add-circle' : 'add-circle-outline'}
                size={size + 4}
                color={color}
              />
            ),
            tabBarButtonTestID: 'tab-add',
            tabBarAccessibilityLabel: 'Add art tab',
          }}
        />
        <Tab.Screen
          name="Gallery"
          component={Gallery}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={size}
                color={color}
              />
            ),
            tabBarButtonTestID: 'tab-gallery',
            tabBarAccessibilityLabel: 'Gallery tab',
          }}
        />
        <Tab.Screen
          name="Profile"
          component={Profile}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={size}
                color={color}
              />
            ),
            tabBarButtonTestID: 'tab-profile',
            tabBarAccessibilityLabel: 'Profile tab',
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

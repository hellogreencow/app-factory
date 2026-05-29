import React, { useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, AppContext } from './src/context/AppContext';
import MapScreen from './src/screens/MapScreen';
import FearListScreen from './src/screens/FearListScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

function MyTabs() {
  const { theme } = useContext(AppContext);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Fear List') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarInactiveTintColor: 'gray',
        tabBarActiveTintColor: theme.accentColor,
        tabBarStyle: {
          backgroundColor: theme.cardColor,
          borderTopColor: theme.cardColor,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ tabBarButtonTestID: 'map-tab-button' }}
      />
      <Tab.Screen
        name="Fear List"
        component={FearListScreen}
        options={{ tabBarButtonTestID: 'fear-list-tab-button' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarButtonTestID: 'profile-tab-button' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { theme } = useContext(AppContext);
  const isDarkTheme = theme.theme === 'dark';

  return (
    <View style={styles.container}>
      <StatusBar style={isDarkTheme ? 'light' : 'dark'} />
      <NavigationContainer>
        <MyTabs />
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
});

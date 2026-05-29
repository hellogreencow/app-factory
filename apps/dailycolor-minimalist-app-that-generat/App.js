import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, AppContext } from './src/context/AppContext';
import DailyScreen from './src/screens/DailyScreen';
import WallpaperScreen from './src/screens/WallpaperScreen';
import AboutScreen from './src/screens/AboutScreen';

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

            if (route.name === 'Daily') {
              iconName = 'ios-color-palette';
            } else if (route.name === 'Wallpaper') {
              iconName = 'ios-image';
            } else if (route.name === 'About') {
              iconName = 'ios-information-circle';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
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
          name="Daily"
          component={DailyScreen}
          options={{ tabBarButtonTestID: 'daily-tab-button', accessibilityLabel: 'Daily Tab' }}
        />
        <Tab.Screen
          name="Wallpaper"
          component={WallpaperScreen}
          options={{ tabBarButtonTestID: 'wallpaper-tab-button', accessibilityLabel: 'Wallpaper Tab' }}
        />
        <Tab.Screen
          name="About"
          component={AboutScreen}
          options={{ tabBarButtonTestID: 'about-tab-button', accessibilityLabel: 'About Tab' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </SafeAreaProvider>
  );
};


export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

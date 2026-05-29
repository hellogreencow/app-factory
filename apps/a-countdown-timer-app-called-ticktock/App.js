import React, { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider, AppContext } from './src/context/AppContext';
import TimersScreen from './src/screens/TimersScreen';
import CreateTimerScreen from './src/screens/CreateTimerScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

function AppContent() {
  const { theme } = useContext(AppContext);

  return (
    <NavigationContainer>
      <StatusBar style={theme.theme === 'dark' ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Timers') {
              iconName = 'timer-outline';
            } else if (route.name === 'Create') {
              iconName = 'add-circle-outline';
            } else if (route.name === 'Settings') {
              iconName = 'settings-outline';
            }

            return <Ionicons testID={`tab-icon-${route.name}`} accessibilityLabel={`tab-icon-${route.name}`} name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: theme.accentColor,
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: {
            backgroundColor: theme.backgroundColor,
            borderTopColor: theme.cardColor,
            borderTopWidth: 1,
          },
          tabBarButtonTestID: `tab-button-${route.name}`,
        })}
      >
        <Tab.Screen
          name="Timers"
          component={TimersScreen}
          options={{
            tabBarButtonTestID: 'tab-button-timers',
            headerShown: false,
          }}
        />
        <Tab.Screen
          name="Create"
          component={CreateTimerScreen}
          options={{
            tabBarButtonTestID: 'tab-button-create',
            headerShown: false,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarButtonTestID: 'tab-button-settings',
            headerShown: false,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

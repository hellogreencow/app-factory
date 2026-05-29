import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppProvider } from './src/context/AppContext';
import Dashboard from './src/screens/Dashboard';
import CreateDebt from './src/screens/CreateDebt';
import DebtMap from './src/screens/DebtMap';
import Profile from './src/screens/Profile';

const Tab = createBottomTabNavigator();

const App = () => {
  const theme = {
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    accentColor: '#39FF14',
    cardColor: '#1A1A1A',
  };

  const insets = useSafeAreaInsets();

  return (
    <AppProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Ledger') {
                iconName = focused ? 'receipt' : 'receipt-outline';
              } else if (route.name === 'Snap') {
                iconName = focused ? 'camera' : 'camera-outline';
              } else if (route.name === 'Map') {
                iconName = focused ? 'map' : 'map-outline';
              } else if (route.name === 'Profile') {
                iconName = focused ? 'person' : 'person-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: theme.accentColor,
            tabBarInactiveTintColor: 'gray',
            tabBarStyle: {
              backgroundColor: theme.cardColor,
              borderTopColor: theme.cardColor,
              paddingBottom: insets.bottom,
              height: 60 + insets.bottom,
            },
            headerShown: false,
          })}
        >
          <Tab.Screen
            name="Ledger"
            component={Dashboard}
            options={{ tabBarButtonTestID: 'ledger-tab' }}
          />
          <Tab.Screen
            name="Snap"
            component={CreateDebt}
            options={{ tabBarButtonTestID: 'snap-tab' }}
          />
          <Tab.Screen
            name="Map"
            component={DebtMap}
            options={{ tabBarButtonTestID: 'map-tab' }}
          />
          <Tab.Screen
            name="Profile"
            component={Profile}
            options={{ tabBarButtonTestID: 'profile-tab' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

export default App;

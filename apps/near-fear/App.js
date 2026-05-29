import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppProvider } from './src/context/AppContext';
import MapScreen from './src/screens/MapScreen';
import DaresScreen from './src/screens/DaresScreen';
import CreateDareScreen from './src/screens/CreateDareScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { StyleSheet } from 'react-native';

const Tab = createBottomTabNavigator();

const App = () => {
  return (
    <AppProvider>
      <NavigationContainer>
        <StatusBar style="light" backgroundColor="#121212" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Map') {
                iconName = focused ? 'map' : 'map-outline';
              } else if (route.name === 'Dares') {
                iconName = focused ? 'flame' : 'flame-outline';
              } else if (route.name === 'Create') {
                iconName = focused ? 'add-circle' : 'add-circle-outline';
              } else if (route.name === 'Activity') {
                iconName = focused ? 'notifications' : 'notifications-outline';
              } else if (route.name === 'Profile') {
                iconName = focused ? 'person' : 'person-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#64FFDA',
            tabBarInactiveTintColor: 'white',
            tabBarStyle: {
              backgroundColor: '#1E1E1E',
              borderTopColor: 'transparent',
            },
            headerShown: false,
          })}
        >
          <Tab.Screen
            name="Map"
            component={MapScreen}
            options={{ tabBarButtonTestID: 'map-tab-button', accessibilityLabel: 'Map Tab' }}
          />
          <Tab.Screen
            name="Dares"
            component={DaresScreen}
            options={{ tabBarButtonTestID: 'dares-tab-button', accessibilityLabel: 'Dares Tab' }}
          />
          <Tab.Screen
            name="Create"
            component={CreateDareScreen}
            options={{ tabBarButtonTestID: 'create-tab-button', accessibilityLabel: 'Create Tab' }}
          />
          <Tab.Screen
            name="Activity"
            component={ActivityScreen}
            options={{ tabBarButtonTestID: 'activity-tab-button', accessibilityLabel: 'Activity Tab' }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ tabBarButtonTestID: 'profile-tab-button', accessibilityLabel: 'Profile Tab' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
});

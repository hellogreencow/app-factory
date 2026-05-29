import React, { useContext } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, AppContext } from './src/context/AppContext';
import MapScreen from './src/screens/MapScreen';
import AddPlaceScreen from './src/screens/AddPlaceScreen';
import ChallengesScreen from './src/screens/ChallengesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PlaceDetailsScreen from './src/screens/PlaceDetailsScreen';

const Tab = createBottomTabNavigator();
const MapStack = createNativeStackNavigator();

function MapStackNavigator() {
  const { theme } = useContext(AppContext);
  return (
    <MapStack.Navigator screenOptions={{ headerShown: false }}>
      <MapStack.Screen name="MapMain" component={MapScreen} />
      <MapStack.Screen
        name="PlaceDetails"
        component={PlaceDetailsScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme?.cardColor ?? '#212121' },
          headerTintColor: theme?.textColor ?? '#fff',
          title: 'Place Details',
        }}
      />
    </MapStack.Navigator>
  );
}

function TabBarComponent() {
  const { theme } = useContext(AppContext);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Add Place') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Challenges') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme?.accentColor ?? '#FF4500',
        tabBarInactiveTintColor: theme?.textColor ?? 'white',
        tabBarStyle: {
          backgroundColor: theme?.cardColor ?? '#212121',
          borderTopColor: 'transparent',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Map"
        component={MapStackNavigator}
        options={{ tabBarButtonTestID: 'map-tab-button' }}
      />
      <Tab.Screen
        name="Add Place"
        component={AddPlaceScreen}
        options={{ tabBarButtonTestID: 'add-place-tab-button' }}
      />
      <Tab.Screen
        name="Challenges"
        component={ChallengesScreen}
        options={{ tabBarButtonTestID: 'challenges-tab-button' }}
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
  const isDarkTheme = theme?.theme === 'dark';

  return (
    <View style={styles.container}>
      <StatusBar style={isDarkTheme ? 'light' : 'dark'} />
      <NavigationContainer>
        <TabBarComponent />
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

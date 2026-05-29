import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ReferenceProvider } from './src/context/ReferenceContext';
import BrowseScreen from './src/screens/BrowseScreen';
import ItemDetailScreen from './src/screens/ItemDetailScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const hdr = { headerStyle: { backgroundColor: '#0d1117' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } };

function BrowseStack() {
  return (
    <Stack.Navigator screenOptions={hdr}>
      <Stack.Screen name="BrowseHome" component={BrowseScreen} options={{ title: 'Browse' }} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Detail' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <ReferenceProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: '#161b22', borderTopColor: '#30363d' }, tabBarActiveTintColor: '#58a6ff', tabBarInactiveTintColor: '#8b949e' }}>
          <Tab.Screen name="Home" component={BrowseStack} options={{ tabBarLabel: 'Browse' }} />
          <Tab.Screen name="Bookmarks" component={BookmarksScreen} options={{ title: 'Bookmarks' }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </ReferenceProvider>
  );
}

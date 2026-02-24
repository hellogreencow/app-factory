import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ItemsProvider } from './src/context/ItemsContext';
import ListScreen from './src/screens/ListScreen';
import AddItemScreen from './src/screens/AddItemScreen';
import DetailScreen from './src/screens/DetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0d1117' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } }}>
      <Stack.Screen name="List" component={ListScreen} options={{ title: 'Items' }} />
      <Stack.Screen name="AddItem" component={AddItemScreen} options={{ title: 'Add Item' }} />
      <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Detail' }} />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: '#161b22', borderTopColor: '#30363d' }, tabBarActiveTintColor: '#58a6ff', tabBarInactiveTintColor: '#8b949e' }}>
      <Tab.Screen
        name="Home"
        component={MainStack}
        options={{ title: 'Items', tabBarLabel: 'Items', tabBarButtonTestID: 'tab-items', tabBarAccessibilityLabel: 'Tab: Items' }}
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
    <ItemsProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <TabNavigator />
      </NavigationContainer>
    </ItemsProvider>
  );
}

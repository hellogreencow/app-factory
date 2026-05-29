import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MetricsProvider } from './src/context/MetricsContext';
import OverviewScreen from './src/screens/OverviewScreen';
import AddEntryScreen from './src/screens/AddEntryScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const hdr = { headerStyle: { backgroundColor: '#0d1117' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } };

function DashStack() {
  return (
    <Stack.Navigator screenOptions={hdr}>
      <Stack.Screen name="OverviewHome" component={OverviewScreen} options={{ title: 'Overview' }} />
      <Stack.Screen name="AddEntry" component={AddEntryScreen} options={{ title: 'Add Entry' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <MetricsProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: '#161b22', borderTopColor: '#30363d' }, tabBarActiveTintColor: '#58a6ff', tabBarInactiveTintColor: '#8b949e' }}>
          <Tab.Screen name="Home" component={DashStack} options={{ tabBarLabel: 'Overview' }} />
          <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </MetricsProvider>
  );
}

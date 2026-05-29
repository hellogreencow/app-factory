import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PortfolioProvider } from './src/context/PortfolioContext';
import PortfolioScreen from './src/screens/PortfolioScreen';
import AddAssetScreen from './src/screens/AddAssetScreen';
import PriceChartScreen from './src/screens/PriceChartScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function PortfolioStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0d1117' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="Portfolio" component={PortfolioScreen} options={{ title: 'Portfolio' }} />
      <Stack.Screen name="AddAsset" component={AddAssetScreen} options={{ title: 'Add Asset' }} />
      <Stack.Screen name="Chart" component={PriceChartScreen} options={{ title: 'Price Chart' }} />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#161b22', borderTopColor: '#30363d' },
        tabBarActiveTintColor: '#58a6ff',
        tabBarInactiveTintColor: '#8b949e',
      }}
    >
      <Tab.Screen name="Home" component={PortfolioStack} options={{ title: 'Portfolio', tabBarLabel: 'Portfolio' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <PortfolioProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <TabNavigator />
      </NavigationContainer>
    </PortfolioProvider>
  );
}

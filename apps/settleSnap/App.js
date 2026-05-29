import React, { useContext } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, AppContext } from './src/context/AppContext';
import GroupsScreen from './src/screens/GroupsScreen';
import ScanScreen from './src/screens/ScanScreen';
import BalancesScreen from './src/screens/BalancesScreen';
import ActivityScreen from './src/screens/ActivityScreen';

const Tab = createBottomTabNavigator();

function TabNavigator() {
  const { theme } = useContext(AppContext);

  return (
    <>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Groups') {
              iconName = 'people-outline';
            } else if (route.name === 'Scan') {
              iconName = 'scan-outline';
            } else if (route.name === 'Balances') {
              iconName = 'wallet-outline';
            } else if (route.name === 'Activity') {
              iconName = 'time-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#2D3748',
          tabBarInactiveTintColor: '#A0AEC0',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            paddingTop: 8,
            paddingBottom: 8,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: 4,
          },
          headerStyle: {
            backgroundColor: '#FFFFFF',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: '#E2E8F0',
          },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '700',
            color: '#1A1A1A',
          },
          headerTintColor: '#2D3748',
        })}
      >
        <Tab.Screen
          name="Groups"
          component={GroupsScreen}
          options={{
            tabBarButtonTestID: 'tab-groups',
            tabBarAccessibilityLabel: 'Groups tab',
            headerTitle: 'Groups',
          }}
        />
        <Tab.Screen
          name="Scan"
          component={ScanScreen}
          options={{
            tabBarButtonTestID: 'tab-scan',
            tabBarAccessibilityLabel: 'Scan tab',
            headerTitle: 'Scan Receipt',
          }}
        />
        <Tab.Screen
          name="Balances"
          component={BalancesScreen}
          options={{
            tabBarButtonTestID: 'tab-balances',
            tabBarAccessibilityLabel: 'Balances tab',
            headerTitle: 'Balances',
          }}
        />
        <Tab.Screen
          name="Activity"
          component={ActivityScreen}
          options={{
            tabBarButtonTestID: 'tab-activity',
            tabBarAccessibilityLabel: 'Activity tab',
            headerTitle: 'Activity',
          }}
        />
      </Tab.Navigator>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});

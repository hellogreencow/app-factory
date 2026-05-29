
// FireFight - Incident Tracking App
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { IncidentProvider } from './src/contexts/IncidentContext';
import { TeamProvider } from './src/contexts/TeamContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <ThemeProvider>
      <IncidentProvider>
        <TeamProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </TeamProvider>
      </IncidentProvider>
    </ThemeProvider>
  );
}

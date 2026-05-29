
import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const lightTheme = {
  background: '#F3F4F6',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  primary: '#EF4444',
  secondary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#E5E7EB',
  shadow: '#000000',
};

const darkTheme = {
  background: '#111827',
  card: '#1F2937',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  primary: '#EF4444',
  secondary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#374151',
  shadow: '#000000',
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(true); // Default to dark mode

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const colors = isDark ? darkTheme : lightTheme;

  const value = {
    isDark,
    toggleTheme,
    colors,
    theme: isDark ? 'dark' : 'light',
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
</wrap_file>

Now let me verify the App.js is properly set up:

<write_file path="App.js">
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { IncidentProvider } from './src/contexts/IncidentContext';
import { TeamProvider } from './src/contexts/TeamContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <IncidentProvider>
            <TeamProvider>
              <StatusBar style="light" />
              <AppNavigator />
            </TeamProvider>
          </IncidentProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

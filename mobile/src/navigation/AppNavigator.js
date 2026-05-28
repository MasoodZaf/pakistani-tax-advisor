import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TaxFormsScreen from '../screens/TaxFormsScreen';
import IncomeFormScreen from '../screens/IncomeFormScreen';
import DeductionsFormScreen from '../screens/DeductionsFormScreen';
import FinalTaxFormScreen from '../screens/FinalTaxFormScreen';
import ExpensesListScreen from '../screens/ExpensesListScreen';
import ExpenseCaptureScreen from '../screens/ExpenseCaptureScreen';
import ConflictResolutionScreen from '../screens/ConflictResolutionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoadingScreen from '../screens/LoadingScreen';
import WizardScreen from '../screens/WizardScreen';
import PriorYearUploadScreen from '../screens/PriorYearUploadScreen';

// Import icons (you can replace with your preferred icon library)
import { MaterialIcons } from '@expo/vector-icons';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Stack Navigator (Login/Register)
const AuthStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#4f46e5',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />
    </Stack.Navigator>
  );
};

// Tax Forms Stack Navigator
const TaxFormsStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#4f46e5',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="TaxFormsOverview" 
        component={TaxFormsScreen}
        options={{ title: 'Tax Forms' }}
      />
      <Stack.Screen 
        name="IncomeForm" 
        component={IncomeFormScreen}
        options={{ title: 'Income Information' }}
      />
      <Stack.Screen 
        name="DeductionsForm" 
        component={DeductionsFormScreen}
        options={{ title: 'Deductions' }}
      />
      <Stack.Screen 
        name="FinalTaxForm" 
        component={FinalTaxFormScreen}
        options={{ title: 'Final Tax Calculation' }}
      />
    </Stack.Navigator>
  );
};

// Expenses Stack — list of captured expenses + the capture/edit form.
const ExpensesStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: '#4f46e5' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
    }}
  >
    <Stack.Screen
      name="ExpensesList"
      component={ExpensesListScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="ExpenseCapture"
      component={ExpenseCaptureScreen}
      options={({ route }) => ({
        title: route?.params?.clientId ? 'Edit expense' : 'New expense',
      })}
    />
    <Stack.Screen
      name="ConflictResolution"
      component={ConflictResolutionScreen}
      options={{ title: 'Resolve conflict' }}
    />
  </Stack.Navigator>
);

// Main Tab Navigator (for authenticated users). The Admin tab is hidden on
// mobile until the admin screens are actually built — leaving it in routed
// admin users to a placeholder.
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = 'dashboard';
          else if (route.name === 'TaxForms') iconName = 'description';
          else if (route.name === 'Expenses') iconName = 'receipt-long';
          else if (route.name === 'Profile') iconName = 'person';
          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: 'gray',
        headerStyle: { backgroundColor: '#4f46e5' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesStackNavigator}
        options={{ title: 'Expenses', headerShown: false }}
      />
      <Tab.Screen
        name="TaxForms"
        component={TaxFormsStackNavigator}
        options={{ title: 'Tax Forms', headerShown: false }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// Root stack for authenticated users — wraps the tab navigator so we can
// push full-screen experiences (like the Wizard) on top of it without
// keeping the bottom tab bar visible.
const AuthenticatedRootStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: '#4f46e5' },
      headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
    }}
  >
    <Stack.Screen
      name="MainTabs"
      component={MainTabNavigator}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Wizard"
      component={WizardScreen}
      options={{ title: 'Quick-Start Wizard' }}
    />
    <Stack.Screen
      name="PriorYearUpload"
      component={PriorYearUploadScreen}
      options={{ title: 'Prior-Year Return' }}
    />
  </Stack.Navigator>
);

// Main App Navigator
const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <AuthenticatedRootStack />
      ) : (
        <AuthStackNavigator />
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;
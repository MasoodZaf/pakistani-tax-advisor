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
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoadingScreen from '../screens/LoadingScreen';

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

// Admin Stack Navigator
const AdminStackNavigator = () => {
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
        name="AdminDashboard" 
        component={AdminDashboardScreen}
        options={{ title: 'Admin Panel' }}
      />
    </Stack.Navigator>
  );
};

// Main Tab Navigator (for authenticated users)
const MainTabNavigator = () => {
  const { user } = useAuth();
  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = 'dashboard';
          } else if (route.name === 'TaxForms') {
            iconName = 'description';
          } else if (route.name === 'Admin') {
            iconName = 'admin-panel-settings';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#4f46e5',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="TaxForms" 
        component={TaxFormsStackNavigator}
        options={{ title: 'Tax Forms', headerShown: false }}
      />
      {isAdmin && (
        <Tab.Screen 
          name="Admin" 
          component={AdminStackNavigator}
          options={{ title: 'Admin', headerShown: false }}
        />
      )}
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// Main App Navigator
const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <MainTabNavigator />
      ) : (
        <AuthStackNavigator />
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { ReservationsScreen } from './src/screens/ReservationsScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { CastsScreen } from './src/screens/CastsScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

// 提供者アプリの BottomTab（SPEC §9-1）。型付きナビ（ルールINIT）。
export type RootTabParamList = {
  Reservations: undefined;
  Schedule: undefined;
  Casts: undefined;
  Analytics: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// タブアイコンは @expo/vector-icons MaterialCommunityIcons の固定名（絵文字禁止＝ルールTAB-ICON）
const TAB_ICONS: Record<
  keyof RootTabParamList,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  Reservations: 'calendar-check',
  Schedule: 'clock-edit',
  Casts: 'account-star',
  Analytics: 'chart-box',
  Settings: 'cog',
};

function Tabs() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      initialRouteName="Reservations"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.subtext,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={TAB_ICONS[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen
        name="Reservations"
        component={ReservationsScreen}
        options={{ tabBarLabel: t('tab.reservations') }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ tabBarLabel: t('tab.schedule') }}
      />
      <Tab.Screen
        name="Casts"
        component={CastsScreen}
        options={{ tabBarLabel: t('tab.casts') }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ tabBarLabel: t('tab.analytics') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: t('tab.settings') }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <NavigationContainer>
            <Tabs />
          </NavigationContainer>
          <StatusBar style="auto" />
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

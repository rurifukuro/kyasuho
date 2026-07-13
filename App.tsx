import React, { useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { TenantProvider } from './src/context/TenantContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { LoadingScreen } from './src/components/common/LoadingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { RoleSelectScreen } from './src/screens/RoleSelectScreen';
import { CastHomeScreen } from './src/screens/CastHomeScreen';
import { ReservationsScreen } from './src/screens/ReservationsScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { CastsScreen } from './src/screens/CastsScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CustomerHomeScreen } from './src/screens/CustomerHomeScreen';
import { CustomerSettingsScreen } from './src/screens/CustomerSettingsScreen';
import { CustomerShopScreen } from './src/screens/CustomerShopScreen';
import { supabase } from './src/config/supabase';

type DevRole = null | 'owner' | 'cast' | 'customer';
const DEV_CYCLE: DevRole[] = [null, 'owner', 'cast', 'customer'];
const DEV_LABELS: Record<string, string> = { auto: '自', owner: 'O', cast: 'C', customer: '客' };
const DEV_COLORS: Record<string, string> = {
  auto: 'rgba(100,100,100,0.85)',
  owner: 'rgba(37,99,235,0.85)',
  cast: 'rgba(217,70,239,0.85)',
  customer: 'rgba(34,197,94,0.85)',
};

export type RootTabParamList = {
  Reservations: undefined;
  Register: undefined;
  Schedule: undefined;
  Casts: undefined;
  Analytics: undefined;
  Settings: undefined;
};

export type CustomerTabParamList = {
  CustomerHome: undefined;
  CustomerSettings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const CustomerTab = createBottomTabNavigator<CustomerTabParamList>();

const TAB_ICONS: Record<
  keyof RootTabParamList,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  Reservations: 'calendar-check',
  Register: 'cash-register',
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
        name="Register"
        component={RegisterScreen}
        options={{ tabBarLabel: t('tab.register') }}
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

function CustomerTabs({ customerAccountId }: { customerAccountId: string }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [shopRoute, setShopRoute] = useState<{ tenantId: string; slug: string } | null>(null);

  if (shopRoute) {
    return (
      <CustomerShopScreen
        tenantId={shopRoute.tenantId}
        slug={shopRoute.slug}
        onBack={() => setShopRoute(null)}
      />
    );
  }

  return (
    <CustomerTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.subtext,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
      }}
    >
      <CustomerTab.Screen
        name="CustomerHome"
        options={{
          tabBarLabel: t('customer.tabHome'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="store" color={color} size={size} />
          ),
        }}
      >
        {() => (
          <CustomerHomeScreen
            customerAccountId={customerAccountId}
            onOpenShop={(tenantId, slug) => setShopRoute({ tenantId, slug })}
          />
        )}
      </CustomerTab.Screen>
      <CustomerTab.Screen
        name="CustomerSettings"
        component={CustomerSettingsScreen}
        options={{
          tabBarLabel: t('customer.tabSettings'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
        }}
      />
    </CustomerTab.Navigator>
  );
}

function RootGate() {
  const { isReady, session, role, roleLoading, roleResult } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [devRole, setDevRole] = useState<DevRole>(null);
  const [devSlug, setDevSlug] = useState('shop-kysmoke');

  const cycleDevRole = useCallback(() => {
    setDevRole(prev => {
      const idx = DEV_CYCLE.indexOf(prev);
      return DEV_CYCLE[(idx + 1) % DEV_CYCLE.length];
    });
  }, []);

  useEffect(() => {
    if (!__DEV__) return;
    const tid = roleResult && 'tenantId' in roleResult ? roleResult.tenantId : null;
    if (!tid) return;
    supabase.from('ky_tenants').select('slug').eq('id', tid).single()
      .then(({ data }) => { if (data) setDevSlug(data.slug as string); });
  }, [roleResult]);

  if (!isReady) return <LoadingScreen label={t('common.loading')} />;
  if (!session) return <AuthScreen />;
  if (roleLoading) return <LoadingScreen label={t('role.roleLoading')} />;

  const effectiveRole = (__DEV__ && devRole) || role;

  const customerAccountId =
    roleResult && 'customerAccountId' in roleResult ? roleResult.customerAccountId : null;

  let content: React.ReactNode;
  if (effectiveRole === 'customer') {
    content = (
      <NavigationContainer>
        <CustomerTabs customerAccountId={customerAccountId ?? ''} />
      </NavigationContainer>
    );
  } else if (effectiveRole === 'cast') {
    content = <CastHomeScreen />;
  } else if (effectiveRole === 'none') {
    content = <RoleSelectScreen />;
  } else {
    content = (
      <TenantProvider>
        <NotificationProvider>
          <NavigationContainer>
            <Tabs />
          </NavigationContainer>
        </NotificationProvider>
      </TenantProvider>
    );
  }

  if (__DEV__) {
    const key = devRole ?? 'auto';
    return (
      <View style={{ flex: 1 }}>
        {content}
        <TouchableOpacity
          style={[
            devFab.btn,
            { backgroundColor: DEV_COLORS[key], bottom: insets.bottom + 70 },
          ]}
          onPress={cycleDevRole}
          activeOpacity={0.7}
        >
          <Text style={devFab.label}>{DEV_LABELS[key]}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{content}</>;
}

const devFab = StyleSheet.create({
  btn: {
    position: 'absolute',
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <RootGate />
            <StatusBar style="auto" />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

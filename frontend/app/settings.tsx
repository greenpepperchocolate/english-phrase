import { useEffect, useState } from 'react';
import { Alert, Button, Pressable, SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { useUserSettings } from '../src/hooks/useUserSettings';
import { useAuth } from '../src/providers/AuthProvider';

export default function SettingsScreen() {
  const { settingsQuery, updateSettings } = useUserSettings();
  const { signOut, tokens } = useAuth();
  const [showJapanese, setShowJapanese] = useState(true);
  const [repeatCount, setRepeatCount] = useState(1);

  useEffect(() => {
    if (settingsQuery.data) {
      console.log('Settings data:', JSON.stringify(settingsQuery.data));
      setShowJapanese(settingsQuery.data.show_japanese ?? true);
      setRepeatCount(settingsQuery.data.repeat_count ?? 1);
    }
  }, [settingsQuery.data]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        show_japanese: showJapanese,
        repeat_count: repeatCount,
      });
      Alert.alert('Settings saved');
    } catch (error) {
      Alert.alert('Failed to save settings');
    }
  };

  if (settingsQuery.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (settingsQuery.isError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Error loading settings</Text>
          <Button title="Retry" onPress={() => settingsQuery.refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Show Japanese text</Text>
          <Switch value={showJapanese} onValueChange={setShowJapanese} />
        </View>
        <Text style={styles.label}>Repeat count (times per video)</Text>
        <View style={styles.repeatCountContainer}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
            <Pressable
              key={count}
              style={[styles.repeatButton, repeatCount === count && styles.repeatButtonActive]}
              onPress={() => setRepeatCount(count)}
            >
              <Text style={[styles.repeatButtonText, repeatCount === count && styles.repeatButtonTextActive]}>
                {count}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>
          {repeatCount === 1 ? '1 time = auto-swipe after 1 play' : `${repeatCount} times = auto-swipe after ${repeatCount} plays`}
        </Text>
        <Button title="Save" onPress={handleSave} disabled={updateSettings.isPending} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.info}>{tokens?.anonymous ? 'Guest account' : 'Signed in'}</Text>
        <Button title="Sign out" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
    rowGap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    rowGap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  label: {
    fontWeight: '600',
    color: '#1b263b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 10,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  repeatCountContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  repeatButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ced4da',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatButtonActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#1d4ed8',
  },
  repeatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1b263b',
  },
  repeatButtonTextActive: {
    color: '#ffffff',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 'auto',
    rowGap: 12,
  },
  info: {
    textAlign: 'center',
    color: '#475569',
  },
});

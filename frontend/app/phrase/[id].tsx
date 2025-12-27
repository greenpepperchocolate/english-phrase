import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { usePhraseDetail } from '../../src/hooks/usePhraseDetail';
import { useUserSettings } from '../../src/hooks/useUserSettings';

export default function PhraseDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = useMemo(() => Number(params.id), [params.id]);
  const phraseQuery = usePhraseDetail(Number.isNaN(id) ? undefined : id);
  const { settingsQuery } = useUserSettings();
  const showJapanese = settingsQuery.data?.show_japanese ?? true;

  if (phraseQuery.isLoading || !phraseQuery.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const phrase = phraseQuery.data;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {phrase.video_url ? (
        <Video source={{ uri: phrase.video_url }} style={styles.video} useNativeControls resizeMode={ResizeMode.COVER} />
      ) : null}
      <Text style={styles.topic}>{phrase.topic}</Text>
      <Text style={styles.title}>{phrase.text}</Text>
      {showJapanese && <Text style={styles.meaning}>{phrase.meaning}</Text>}
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{phrase.difficulty}</Text>
        <Text style={styles.meta}>{phrase.duration_sec}s</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Expressions</Text>
        {phrase.expressions.map((item) => (
          <View key={item.expression.id} style={styles.expressionRow}>
            <Text style={styles.expressionText}>{item.expression.text}</Text>
            {showJapanese && <Text style={styles.expressionMeaning}>{item.expression.meaning}</Text>}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    rowGap: 16,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
  },
  topic: {
    color: '#1d4ed8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  meaning: {
    fontSize: 16,
    color: '#475569',
  },
  metaRow: {
    flexDirection: 'row',
    columnGap: 12,
  },
  meta: {
    fontSize: 12,
    color: '#475569',
  },
  section: {
    rowGap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  expressionRow: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    rowGap: 4,
  },
  expressionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  expressionMeaning: {
    fontSize: 14,
    color: '#64748b',
  },
});

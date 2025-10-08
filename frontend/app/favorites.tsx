import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFavorites } from '../src/hooks/useFavorites';

export default function FavoritesScreen() {
  const favorites = useFavorites();

  if (favorites.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const data = favorites.data ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.phrase?.text ?? item.expression?.text}</Text>
            <Text style={styles.subtitle}>{item.phrase?.meaning ?? item.expression?.meaning}</Text>
            <Text style={styles.meta}>Plays: {item.replay_count}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No favorites yet.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  list: {
    padding: 16,
    rowGap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    rowGap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: '#64748b',
  },
  meta: {
    fontSize: 12,
    color: '#475569',
  },
  empty: {
    textAlign: 'center',
    marginTop: 32,
    color: '#64748b',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

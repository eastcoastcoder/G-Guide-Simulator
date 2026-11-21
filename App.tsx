import {StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import GuideScreen from './src/GuideScreen';

const initialMetrics = {
  frame: {x: 0, y: 0, width: 1920, height: 1080},
  insets: {top: 0, left: 0, right: 0, bottom: 0},
};

function App() {
  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <GuideScreen />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;

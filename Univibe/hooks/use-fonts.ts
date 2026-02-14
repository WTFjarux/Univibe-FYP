import { useFonts } from 'expo-font';

export function useCustomFonts() {
  const [fontsLoaded] = useFonts({
    'Sofia-Regular': require('../assets/fonts/Sofia-Regular.ttf'),
    'SofiaSans-Regular': require('../assets/fonts/SofiaSans-Regular.ttf'),
    'SofiaSans-Bold': require('../assets/fonts/SofiaSans-Bold.ttf'),
    
  });

  return fontsLoaded;
}
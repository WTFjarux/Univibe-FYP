import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  scrollContent: {  // ADD THIS
    paddingBottom: 20,
  },
  content: { 
    padding: 20,
    paddingTop: 10, 
    gap: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 16,
  },
  noProfileContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  noProfileTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 24,
    marginBottom: 32,
    textAlign: 'center',
  },
  noProfileDescription: {
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  setupButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function ProfileStyles() {
  return null;
}
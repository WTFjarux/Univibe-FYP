import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';

const MIN_RECORDING_SECONDS = 1;

export const useAudioRecorder = (onAudioReady: (uri: string, duration: number) => Promise<void>) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStoppingRef = useRef(false);

  const startRecording = useCallback(async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync().catch(() => {});
        setRecording(null);
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone permission');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      Alert.alert('Error', 'Failed to start recording');
      setIsRecording(false);
      setRecording(null);
    }
  }, [recording]);

  const stopRecording = useCallback(async (shouldSend = true) => {
    if (!recording || isStoppingRef.current) {
      setIsRecording(false);
      return;
    }

    isStoppingRef.current = true;
    const currentRecording = recording;
    const currentDuration = recordingDuration;

    setRecording(null);
    setIsRecording(false);

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingDuration(0);

    try {
      await currentRecording.stopAndUnloadAsync();

      if (shouldSend && currentDuration >= MIN_RECORDING_SECONDS) {
        const uri = currentRecording.getURI();
        if (uri) await onAudioReady(uri, currentDuration);
      } else if (currentDuration < MIN_RECORDING_SECONDS && shouldSend) {
        Alert.alert('Info', 'Recording too short. Please record at least 1 second.');
      }
    } catch {
      if (shouldSend) Alert.alert('Error', 'Failed to save recording');
    } finally {
      isStoppingRef.current = false;
    }
  }, [recording, recordingDuration, onAudioReady]);

  const cancelRecording = useCallback(async () => {
    await stopRecording(false);
  }, [stopRecording]);

  const cleanup = useCallback(() => {
    if (recording) {
      recording.stopAndUnloadAsync().catch(() => {});
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  }, [recording]);

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    cleanup,
  };
};
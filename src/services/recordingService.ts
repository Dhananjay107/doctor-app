/**
 * Recording service for handling audio recording in consultations
 * Supports both online (auto-record) and offline (manual record) modes
 */

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingState: RecordingState = {
    isRecording: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
  };
  private durationInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;

  /**
   * Check if recording is supported
   */
  isSupported(): boolean {
    return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm");
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const options: MediaRecorderOptions = {
        mimeType: this.isSupported() ? "audio/webm" : "audio/mp4",
      };

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        this.recordingState.audioBlob = audioBlob;
        this.recordingState.audioUrl = audioUrl;
        
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      this.mediaRecorder.start();
      this.recordingState.isRecording = true;
      this.startTime = Date.now();

      // Update duration every second
      this.durationInterval = setInterval(() => {
        this.recordingState.duration = Math.floor((Date.now() - this.startTime) / 1000);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      throw new Error("Failed to start recording. Please check microphone permissions.");
    }
  }

  /**
   * Stop recording
   */
  stopRecording(): Blob | null {
    if (!this.mediaRecorder || !this.recordingState.isRecording) {
      return null;
    }

    this.mediaRecorder.stop();
    this.recordingState.isRecording = false;

    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    return this.recordingState.audioBlob;
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return { ...this.recordingState };
  }

  /**
   * Reset recording state
   */
  reset(): void {
    if (this.recordingState.isRecording) {
      this.stopRecording();
    }

    if (this.recordingState.audioUrl) {
      URL.revokeObjectURL(this.recordingState.audioUrl);
    }

    if (this.durationInterval) {
      clearInterval(this.durationInterval);
    }

    this.recordingState = {
      isRecording: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
    };
    this.audioChunks = [];
    this.mediaRecorder = null;
  }

  /**
   * Format duration in MM:SS format
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
}

export const recordingService = new RecordingService();


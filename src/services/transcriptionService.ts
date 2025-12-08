const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:4000";

export interface TranscriptionResult {
  transcript: string;
  suggestions?: {
    diagnosis?: string[];
    medicines?: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
    }>;
    notes?: string;
  };
}

/**
 * Transcribe audio to text using AI transcription engine
 */
export async function transcribeAudio(
  audioBlob: Blob | string,
  token: string
): Promise<TranscriptionResult> {
  try {
    const formData = new FormData();
    
    if (typeof audioBlob === "string") {
      // If it's a URL or base64, handle accordingly
      formData.append("audio", audioBlob);
    } else {
      formData.append("audio", audioBlob, "recording.wav");
    }

    const response = await fetch(`${API_BASE}/api/transcription/transcribe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Transcription failed");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Transcription error:", error);
    throw new Error(error.message || "Failed to transcribe audio");
  }
}

/**
 * Get AI suggestions based on conversation transcript
 */
export async function getAISuggestions(
  transcript: string,
  token: string
): Promise<TranscriptionResult["suggestions"]> {
  try {
    const response = await fetch(`${API_BASE}/api/transcription/suggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get suggestions");
    }

    const data = await response.json();
    return data.suggestions;
  } catch (error: any) {
    console.error("AI suggestions error:", error);
    throw new Error(error.message || "Failed to get AI suggestions");
  }
}


import { PitchRecord, PitchWithAnalysis, AnalysisRecord, SystemCapabilities } from '../types/index.js';

const envApiUrl = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL = (envApiUrl && envApiUrl.trim() ? envApiUrl : '/api').replace(/\/$/, '');

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMessage = `HTTP error ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) errMessage = data.error;
    } catch {
      const text = await res.text();
      if (text) errMessage = text.slice(0, 300);
    }
    throw new Error(errMessage);
  }
  return (await res.json()) as T;
}

export const api = {
  async fetchPitches(): Promise<PitchRecord[]> {
    const res = await fetch(`${API_BASE_URL}/pitches`);
    const data = await handleResponse<{ pitches: PitchRecord[] }>(res);
    return data.pitches;
  },

  async getPitch(id: string): Promise<PitchRecord> {
    const res = await fetch(`${API_BASE_URL}/pitches/${id}`);
    const data = await handleResponse<{ pitch: PitchRecord }>(res);
    return data.pitch;
  },

  async uploadPitch(formData: FormData): Promise<PitchRecord> {
    const res = await fetch(`${API_BASE_URL}/pitches`, {
      method: 'POST',
      body: formData
    });
    const data = await handleResponse<{ pitch: PitchRecord }>(res);
    return data.pitch;
  },

  async createManualPitch(payload: {
    startup_name?: string;
    target_geography?: string;
    industry?: string;
    manual_transcript: string;
  }): Promise<PitchRecord> {
    const res = await fetch(`${API_BASE_URL}/pitches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await handleResponse<{ pitch: PitchRecord }>(res);
    return data.pitch;
  },

  async updateTranscript(id: string, transcript: string): Promise<PitchRecord> {
    const res = await fetch(`${API_BASE_URL}/pitches/${id}/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript })
    });
    const data = await handleResponse<{ pitch: PitchRecord }>(res);
    return data.pitch;
  },

  async analyzePitch(id: string, provider_override?: string): Promise<AnalysisRecord> {
    const res = await fetch(`${API_BASE_URL}/pitches/${id}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_override })
    });
    const data = await handleResponse<{ analysis: AnalysisRecord }>(res);
    return data.analysis;
  },

  async getReport(id: string): Promise<PitchWithAnalysis> {
    const res = await fetch(`${API_BASE_URL}/pitches/${id}/report`);
    return await handleResponse<PitchWithAnalysis>(res);
  },

  async deletePitch(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/pitches/${id}`, {
      method: 'DELETE'
    });
    return await handleResponse<{ success: boolean; message: string }>(res);
  },

  async seedDemoPitch(): Promise<PitchWithAnalysis> {
    const res = await fetch(`${API_BASE_URL}/pitches/demo`, {
      method: 'POST'
    });
    return await handleResponse<PitchWithAnalysis>(res);
  },

  async getHealth(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/health`);
    return await handleResponse<any>(res);
  },

  async getCapabilities(): Promise<SystemCapabilities> {
    const res = await fetch(`${API_BASE_URL}/health/capabilities`);
    return await handleResponse<SystemCapabilities>(res);
  }
};

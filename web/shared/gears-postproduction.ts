/** KB owns speech instructions and receipts; actual media execution remains in GEARS. */
export interface GearsSpeechContract {
  schema_version: 'gears-speech-contract/v1';
  story_id: string;
  script_units: { unit_id: string; speech_text: string }[];
  provider_call_count: 0;
}

export interface GearsPostproductionReceipt {
  schema_version: 'gears-postproduction-receipt/v1';
  id: string;
  project_id: string;
  source: { project_id: string; story_id: string; version_id: string } | null;
  timeline_id: string;
  timeline_sha256: string;
  video: { media_url: string; sha256: string };
  subtitles: { media_url: string; sha256: string };
  fps: 24;
  total_frames: number;
  duration_sec: number;
  source_resolutions: [number, number][];
  output_resolution: [number, number];
  audio_id: string;
  audio_sha256: string;
  voice_audio_time_stretched: false;
  human_review_complete: false;
  real_credit_granted: false;
  provider_call_count: 0;
  technical_decode_passed: true;
}

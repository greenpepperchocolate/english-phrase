export type Expression = {
  id: number;
  type: string;
  text: string;
  meaning: string;
  phonetic: string;
  image_key: string;
  audio_key: string;
  video_url: string | null;
  scene_image_url: string | null;
  order: number;
};

export type PhraseExpression = {
  order: number;
  expression: Expression;
};

export type PhraseSummary = {
  id: number;
  text: string;
  meaning: string;
  topic: string;
  duration_sec: number;
  difficulty: string;
  video_url: string | null;
  audio_url: string | null;
  scene_image_url: string | null;
  is_favorite: boolean;
  is_mastered: boolean;
  expressions: PhraseExpression[];
};

export type PhraseDetail = PhraseSummary & {
  tags: string[];
  scene_image_url: string | null;
  expressions: PhraseExpression[];
};

export type CursorPaginatedResponse<T> = {
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Favorite = {
  id: number;
  phrase: PhraseSummary | null;
  expression: Expression | null;
  completed: boolean;
  replay_count: number;
  last_reviewed: string | null;
  is_favorite: boolean;
};

export type UserSettings = {
  playback_speed: number;
  volume: number;
  show_japanese: boolean;
  repeat_count: number;
};

export type PlaybackLogPayload = {
  phrase_id: number;
  play_ms: number;
  completed: boolean;
  source?: string;
  device_type?: string;
  network_type?: string;
};

export type MasteryRate = {
  mastered_count: number;
  total_count: number;
  mastery_rate: number;
};
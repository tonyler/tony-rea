// Assistant types
export interface AssistantResponse {
  reply: string;
  confidence: 'high' | 'medium' | 'low';
  used_sources?: string[];
  assumptions?: string[];
  follow_up_question?: string;
}

export interface EducationResponse {
  summary: string;
  key_concepts: string[];
  recommended_answer_structure: string;
  what_to_verify: string[];
  common_pitfalls: string[];
  open_questions?: string[];
}

export interface GrammarResponse {
  corrected_text: string;
  changes_made?: string[];
}

export type AssistantMode = 'mod' | 'education' | 'grammar';

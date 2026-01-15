// Feed types
export interface FeedIngestResult {
  title: string;
  date_detected?: string;
  extracted_facts: string[];
  entities?: string[];
  tags?: string[];
  sources?: string[];
  verification_note?: string;
  suggested_kb_sections?: string[];
}

export interface Entry {
  id: string;
  created_at: string;
  data: FeedIngestResult;
  deprecated?: boolean;
  superseded_by?: string;
}

export interface KBPatchPlan {
  action: 'supersede' | 'deprecate' | 'hard_delete' | 'update';
  rationale: string;
  target_entry_ids: string[];
  new_entry?: {
    title: string;
    extracted_facts: string[];
    sources?: string[];
    tags?: string[];
  };
  kb_compilation_notes?: string;
}

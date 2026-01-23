// Feed types - matches backend schema
export interface FeedIngestResult {
  title: string;
  full_content: string;
  date_detected?: string;
  tags?: string[];
  sources?: string[];
  verification_note?: string;
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
    full_content: string;
    sources?: string[];
    tags?: string[];
  };
  kb_compilation_notes?: string;
}

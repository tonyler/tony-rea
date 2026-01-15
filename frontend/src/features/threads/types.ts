// Thread types
export interface ThreadResult {
  posts: string[];
  title?: string;
  sources?: string[];
  compliance: {
    all_under_280: boolean;
    violations?: Array<{
      post_index: number;
      char_count: number;
    }>;
  };
}

export interface SavedThread {
  id: string;
  title: string;
  posts: string[];
  metadata?: any;
  created_at: string;
}

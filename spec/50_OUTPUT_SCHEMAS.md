All LLM outputs must be valid JSON.

AssistantResponse:
- reply
- confidence
- used_sources
- assumptions
- follow_up_question

EducationResponse:
- summary
- key_concepts
- recommended_answer_structure
- what_to_verify
- common_pitfalls
- open_questions

FeedIngestResult:
- title
- date_detected
- extracted_facts
- entities
- tags
- sources
- verification_note
- suggested_kb_sections

KBPatchPlan:
- action
- rationale
- target_entry_ids
- new_entry
- kb_compilation_notes

ThreadResult:
- posts
- title
- sources
- compliance

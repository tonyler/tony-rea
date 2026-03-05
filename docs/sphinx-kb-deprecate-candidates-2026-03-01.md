# Sphinx KB Deprecate Candidates (2026-03-01)

Status: review-only. No deletion/deprecation has been executed.

## Candidate Entry IDs

1. `entry-1769077693578-m8z7cnbb3`
   reason: Discord mention artifact, no source, no project knowledge value.
2. `entry-1769077868601-kecya8ih9`
   reason: Discord mention syntax only, no meaningful reusable fact.
3. `entry-1769077952922-ymun2070i`
   reason: GIF-only/media artifact, no project knowledge value.
4. `procedure-simplicity`
   reason: generic low-signal sentence.
5. `simple-procedure-description`
   reason: duplicate of `procedure-simplicity` with same content.
6. `support-us-invitation`
   reason: generic promotional CTA, not durable factual knowledge.
7. `greek-philosophers-and-athletes`
   reason: off-topic/non-project content.
8. `sphinx-discord-support-link`
   reason: low-information promo/link blast, not durable KB fact.

## Suggested API Payload (if approved)

```json
{
  "projectId": "sphinx-protocol",
  "entryIds": [
    "entry-1769077693578-m8z7cnbb3",
    "entry-1769077868601-kecya8ih9",
    "entry-1769077952922-ymun2070i",
    "procedure-simplicity",
    "simple-procedure-description",
    "support-us-invitation",
    "greek-philosophers-and-athletes",
    "sphinx-discord-support-link"
  ],
  "hard": false
}
```


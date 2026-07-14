# RAG and knowledge

Owns Google Drive document intake, normalization, deduplication, chunking, indexing, retrieval, citations, and knowledge refresh behavior.

Google Drive is the only external RAG source. OAuth credentials stay in platform connections or secret stores. New ingestion code must preserve provenance, file hashes, source metadata, and failure reporting.

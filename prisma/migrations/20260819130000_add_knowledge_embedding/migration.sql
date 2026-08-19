-- RAG: pgvector no próprio Postgres (doc §13)
CREATE EXTENSION IF NOT EXISTS vector;

-- Coluna de embedding na base de conhecimento (text-embedding-3-small = 1536 dims)
ALTER TABLE "Knowledge" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- ponytail: sem índice ANN por ora — a base é pequena (dezenas de itens) e o
-- seq scan com <=> é instantâneo. Se crescer p/ milhares, adicionar:
--   CREATE INDEX ON "Knowledge" USING hnsw ("embedding" vector_cosine_ops);

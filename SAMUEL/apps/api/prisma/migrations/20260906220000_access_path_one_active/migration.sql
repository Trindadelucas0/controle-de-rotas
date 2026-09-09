-- Um CustomerAccessPath ACTIVE por (empresa, cliente).

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY company_id, customer_id
           ORDER BY created_at DESC
         ) AS rn
  FROM customer_access_paths
  WHERE status = 'ACTIVE'
)
UPDATE customer_access_paths AS p
SET status = 'SUPERSEDED'
FROM ranked
WHERE p.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS customer_access_paths_one_active_idx
  ON customer_access_paths (company_id, customer_id)
  WHERE status = 'ACTIVE';

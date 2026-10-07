CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  organization_id BIGINT NOT NULL,
  software_id BIGINT NOT NULL,
  recipient_user_id BIGINT NOT NULL,
  actor_user_id BIGINT NULL,
  event_key VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'IN_APP',
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  related_entity_type VARCHAR(80),
  related_entity_id BIGINT,
  action_url TEXT,
  metadata JSONB,
  idempotency_key VARCHAR(150) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_idempotency
ON notifications(tenant_id, organization_id, software_id, idempotency_key)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_inbox
ON notifications(tenant_id, organization_id, recipient_user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_unread
ON notifications(tenant_id, organization_id, recipient_user_id, is_read)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_event
ON notifications(tenant_id, organization_id, software_id, event_key);

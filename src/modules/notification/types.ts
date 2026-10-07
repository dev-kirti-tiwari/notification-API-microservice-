export type NotificationChannel = 'IN_APP' | 'PUSH' | 'EMAIL' | 'WHATSAPP';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface NotificationRecord {
  id: string;
  tenant_id: string;
  organization_id: string;
  software_id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  event_key: string;
  title: string;
  message: string;
  channel: string;
  priority: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  action_url: string | null;
  metadata: Record<string, any> | null;
  idempotency_key: string;
  is_read: boolean;
  read_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateNotificationDTO {
  recipient_user_id: string;
  actor_user_id?: string | null;
  event_key: string;
  title: string;
  message: string;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  action_url?: string | null;
  metadata?: Record<string, any> | null;
}

export interface ListNotificationsQuery {
  is_read?: boolean;
  event_key?: string;
  channel?: string;
  priority?: string;
  page?: number;
  limit?: number;
}

import {
  createNotificationSchema,
  listQuerySchema,
  idParamSchema,
} from '../../src/modules/notification/validation';

describe('Notification Validation Unit Tests', () => {
  describe('createNotificationSchema', () => {
    it('should validate a complete valid payload', () => {
      const payload = {
        recipient_user_id: '501233',
        actor_user_id: '501099',
        event_key: 'LEAD_ASSIGNED',
        title: 'New Lead Assigned',
        message: 'Rahul Sharma has been assigned to you.',
        channel: 'IN_APP',
        priority: 'NORMAL',
        related_entity_type: 'LEAD',
        related_entity_id: '88912',
        action_url: '/crm/leads/88912',
        metadata: { source: 'META_ADS' },
      };

      const result = createNotificationSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should fail if recipient_user_id is not positive numeric', () => {
      const payload = {
        recipient_user_id: '-123',
        event_key: 'LEAD_ASSIGNED',
        title: 'Title',
        message: 'Message',
      };

      const result = createNotificationSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should fail if mandatory fields are missing', () => {
      const payload = {
        recipient_user_id: '501233',
      };

      const result = createNotificationSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('listQuerySchema', () => {
    it('should parse query parameters properly', () => {
      const query = {
        is_read: 'true',
        page: '2',
        limit: '15',
        priority: 'HIGH',
      };

      const result = listQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_read).toBe(true);
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(15);
        expect(result.data.priority).toBe('HIGH');
      }
    });

    it('should reject invalid limit over 100', () => {
      const query = { limit: '250' };
      const result = listQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });

  describe('idParamSchema', () => {
    it('should accept valid positive BIGINT numeric strings', () => {
      expect(idParamSchema.safeParse({ id: '90000000124' }).success).toBe(true);
    });

    it('should reject non-numeric string IDs', () => {
      expect(idParamSchema.safeParse({ id: 'abc-123' }).success).toBe(false);
    });
  });
});

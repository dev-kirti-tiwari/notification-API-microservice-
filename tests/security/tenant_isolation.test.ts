import request from 'supertest';
import { app } from '../../src/app';
import { config } from '../../src/config/env';
import { notificationRepository } from '../../src/modules/notification/repository';

jest.mock('../../src/modules/notification/repository');

describe('Security - Tenant & Isolation Tests', () => {
  const validToken = config.brrToken;
  const mockedRepo = notificationRepository as jest.Mocked<typeof notificationRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should enforce tenant_id and organization_id scope on GET /:id', async () => {
    // Repository returns null when tenant or organization does not match
    mockedRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/notifications/90000000124')
      .set('Authorization', `Bearer ${validToken}`)
      .set('X-Tenant-Id', '1001')
      .set('X-Organization-Id', '5001')
      .set('X-Software-Id', '10')
      .set('X-User-Id', '501233');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    expect(mockedRepo.findById).toHaveBeenCalledWith('1001', '5001', '90000000124', '501233');
  });

  it('should enforce user scope on PATCH /:id/read', async () => {
    mockedRepo.markAsRead.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/v1/notifications/90000000124/read')
      .set('Authorization', `Bearer ${validToken}`)
      .set('X-Tenant-Id', '1001')
      .set('X-Organization-Id', '5001')
      .set('X-Software-Id', '10')
      .set('X-User-Id', '501233');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    expect(mockedRepo.markAsRead).toHaveBeenCalledWith('1001', '5001', '90000000124', '501233');
  });

  it('should enforce user scope on DELETE /:id', async () => {
    mockedRepo.softDelete.mockResolvedValue(false);

    const res = await request(app)
      .delete('/api/v1/notifications/90000000124')
      .set('Authorization', `Bearer ${validToken}`)
      .set('X-Tenant-Id', '1001')
      .set('X-Organization-Id', '5001')
      .set('X-Software-Id', '10')
      .set('X-User-Id', '501233');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    expect(mockedRepo.softDelete).toHaveBeenCalledWith('1001', '5001', '90000000124', '501233');
  });

  describe('11.1 Required Security Test Pattern (Specification Matrix)', () => {
    it('Tenant 1001 / Org 5001 / User 7001 cannot access record owned by Tenant 2002, Org 6002, or User 8002', async () => {
      // Repository strictly returns null when tenant, org or user does not match the scoped query
      mockedRepo.findById.mockImplementation(async (tenantId, orgId, id, userId) => {
        // If query parameters don't match the record's actual owner (tenant 2002, org 6002, user 8002), return null
        if (tenantId !== '2002' || orgId !== '6002' || userId !== '8002') {
          return null;
        }
        return {
          id,
          tenant_id: '2002',
          organization_id: '6002',
          software_id: '10',
          recipient_user_id: '8002',
          actor_user_id: null,
          event_key: 'CROSS_TENANT_TEST',
          title: 'Unauthorized Access',
          message: 'Sensitive notification',
          channel: 'IN_APP',
          priority: 'NORMAL',
          related_entity_type: null,
          related_entity_id: null,
          action_url: null,
          metadata: null,
          idempotency_key: 'cross-tenant-key',
          is_read: false,
          read_at: null,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        };
      });

      // Request made with Tenant 1001, Org 5001, User 7001
      const res = await request(app)
        .get('/api/v1/notifications/90000000124')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Tenant-Id', '1001')
        .set('X-Organization-Id', '5001')
        .set('X-Software-Id', '10')
        .set('X-User-Id', '7001');

      // Must result in 404 NOTIFICATION_NOT_FOUND
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
      expect(mockedRepo.findById).toHaveBeenCalledWith('1001', '5001', '90000000124', '7001');
    });
  });
});

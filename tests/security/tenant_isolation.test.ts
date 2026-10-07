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
});

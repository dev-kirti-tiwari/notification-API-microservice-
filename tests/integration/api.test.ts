import request from 'supertest';
import { app } from '../../src/app';
import { config } from '../../src/config/env';
import { notificationRepository } from '../../src/modules/notification/repository';

describe('Notification API Integration Tests', () => {
  const validToken = config.brrToken;
  const headers = {
    Authorization: `Bearer ${validToken}`,
    'X-Tenant-Id': '1001',
    'X-Organization-Id': '5001',
    'X-Software-Id': '10',
    'X-User-Id': '501233',
  };

  beforeAll(() => {
    // Use memory store for deterministic integration test run
    notificationRepository.enableMemoryStore();
  });

  it('GET /health returns 200 OK without authentication', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('triostack-notification-service');
  });

  it('GET /ready returns 200 OK', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('POST /api/v1/notifications rejects without token', async () => {
    const res = await request(app)
      .post('/api/v1/notifications')
      .send({});
    expect(res.status).toBe(401);
  });

  let createdId: string;

  it('POST /api/v1/notifications creates a new notification', async () => {
    const res = await request(app)
      .post('/api/v1/notifications')
      .set(headers)
      .set('Idempotency-Key', 'lead-88912-assigned-501233')
      .send({
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
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.event_key).toBe('LEAD_ASSIGNED');
    expect(res.body.data.is_read).toBe(false);

    createdId = res.body.data.id;
  });

  it('POST /api/v1/notifications returns existing record when using same idempotency key', async () => {
    const res = await request(app)
      .post('/api/v1/notifications')
      .set(headers)
      .set('Idempotency-Key', 'lead-88912-assigned-501233')
      .send({
        recipient_user_id: '501233',
        event_key: 'LEAD_ASSIGNED',
        title: 'New Lead Assigned',
        message: 'Rahul Sharma has been assigned to you.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdId);
  });

  it('GET /api/v1/notifications lists notifications for current user', async () => {
    const res = await request(app)
      .get('/api/v1/notifications?page=1&limit=10')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/notifications/unread-count returns unread count', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unread_count).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/notifications/:id retrieves single notification', async () => {
    const res = await request(app)
      .get(`/api/v1/notifications/${createdId}`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdId);
  });

  it('PATCH /api/v1/notifications/:id/read marks notification as read', async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/${createdId}/read`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_read).toBe(true);
    expect(res.body.data.read_at).toBeDefined();
  });

  it('PATCH /api/v1/notifications/read-all marks all notifications as read', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updated_count).toBeDefined();
  });

  it('DELETE /api/v1/notifications/:id soft deletes notification', async () => {
    const res = await request(app)
      .delete(`/api/v1/notifications/${createdId}`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // After soft delete, fetching by id should return 404
    const getRes = await request(app)
      .get(`/api/v1/notifications/${createdId}`)
      .set(headers);
    expect(getRes.status).toBe(404);
  });
});

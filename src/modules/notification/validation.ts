import { z } from 'zod';

export const BIGINT_STRING_REGEX = /^[1-9]\d*$/;

export const createNotificationSchema = z.object({
  recipient_user_id: z
    .string({ required_error: 'recipient_user_id is required' })
    .trim()
    .regex(BIGINT_STRING_REGEX, 'recipient_user_id must be a valid positive numeric BIGINT string'),
  actor_user_id: z
    .string()
    .trim()
    .regex(BIGINT_STRING_REGEX, 'actor_user_id must be a valid positive numeric BIGINT string')
    .optional()
    .nullable(),
  event_key: z
    .string({ required_error: 'event_key is required' })
    .trim()
    .min(1, 'event_key must not be empty')
    .max(100, 'event_key must be at most 100 characters'),
  title: z
    .string({ required_error: 'title is required' })
    .trim()
    .min(1, 'title must not be empty')
    .max(200, 'title must be at most 200 characters'),
  message: z
    .string({ required_error: 'message is required' })
    .trim()
    .min(1, 'message must not be empty'),
  channel: z
    .enum(['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP'], {
      invalid_type_error: 'channel must be one of: IN_APP, PUSH, EMAIL, WHATSAPP',
    })
    .default('IN_APP')
    .optional(),
  priority: z
    .enum(['LOW', 'NORMAL', 'HIGH'], {
      invalid_type_error: 'priority must be one of: LOW, NORMAL, HIGH',
    })
    .default('NORMAL')
    .optional(),
  related_entity_type: z
    .string()
    .trim()
    .max(80, 'related_entity_type must be at most 80 characters')
    .optional()
    .nullable(),
  related_entity_id: z
    .string()
    .trim()
    .regex(BIGINT_STRING_REGEX, 'related_entity_id must be a valid positive numeric BIGINT string')
    .optional()
    .nullable(),
  action_url: z
    .string()
    .trim()
    .optional()
    .nullable(),
  metadata: z
    .record(z.any())
    .optional()
    .nullable(),
});

export const listQuerySchema = z.object({
  is_read: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  event_key: z.string().trim().optional(),
  channel: z.string().trim().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val >= 1, { message: 'page must be an integer >= 1' }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, { message: 'limit must be between 1 and 100' }),
});

export const idParamSchema = z.object({
  id: z
    .string({ required_error: 'id is required' })
    .trim()
    .regex(BIGINT_STRING_REGEX, 'id must be a valid positive numeric BIGINT string'),
});

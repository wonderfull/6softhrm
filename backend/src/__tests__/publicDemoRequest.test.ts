import request from './helpers/http';
import app from '../app';
import { sendEmail } from '../lib/emailService';

jest.mock('../lib/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const mockSend = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe('POST /api/public/demo-request', () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it('accepts a valid request and emails the demo inbox', async () => {
    const res = await request(app)
      .post('/api/public/demo-request')
      .send({ email: 'ops@northgate-care.co.uk', headcount: 42 });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const sent = mockSend.mock.calls[0][0];
    expect(sent.to).toBe('hello@onsidehr.co.uk');
    expect(sent.subject).toContain('ops@northgate-care.co.uk');
    expect(sent.subject).toContain('42');
  });

  it('still answers 202 when the mail fails, so the visitor is not shown an error', async () => {
    mockSend.mockResolvedValueOnce(false);
    const res = await request(app)
      .post('/api/public/demo-request')
      .send({ email: 'ops@northgate-care.co.uk', headcount: 42 });
    expect(res.status).toBe(202);
  });

  it('rejects a malformed email', async () => {
    for (const email of ['not-an-email', '', 'a@b', `${'x'.repeat(250)}@example.com`]) {
      const res = await request(app)
        .post('/api/public/demo-request')
        .send({ email, headcount: 10 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    }
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects a headcount that is not a whole number between 1 and 100000', async () => {
    for (const headcount of [0, -3, 4.5, 100001, 'ten']) {
      const res = await request(app)
        .post('/api/public/demo-request')
        .send({ email: 'ops@northgate-care.co.uk', headcount });
      expect(res.status).toBe(400);
    }
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('swallows a filled honeypot without sending anything', async () => {
    const res = await request(app)
      .post('/api/public/demo-request')
      .send({ email: 'bot@spam.example', headcount: 5, website: 'http://spam.example' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not require authentication', async () => {
    const res = await request(app)
      .post('/api/public/demo-request')
      .send({ email: 'ops@northgate-care.co.uk', headcount: 7 });
    expect(res.status).not.toBe(401);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatClinicRowForFacebook,
  formatFacebookSchedulePost,
  publishToFacebookPageGraphApi,
  resolveDayMetaById,
} from './facebookPostLogic.js';
import type { CenterSettings, ScheduleRow } from '../types/schedule.js';
import { DEFAULT_POST_TEMPLATE } from './scheduleLogic.js';

const MOCK_SETTINGS: CenterSettings = {
  complexName: 'مجمع ميت عزون الطبي',
  associationName: 'جمعية تنمية المجتمع المحلي',
  registrationNumber: 'مشهرة برقم 2406',
  rightLogoUrl: '/logos/complex-logo.svg',
  leftLogoUrl: '/logos/association-logo.svg',
  address: 'ميت عزون - بجوار المسجد الكبير',
  whatsappPhone: '01202027567',
  landlinePhone: '0502053187',
  dentalPhone: '01515674347',
  dentalLabel: 'عيادة الأسنان',
  bgStartColor: '#f3effb',
  bgEndColor: '#e8dff5',
  clinicHeaderColor: '#f59e0b',
  doctorHeaderColor: '#0d9456',
  fromHeaderColor: '#f59e0b',
  toHeaderColor: '#0088cc',
  footerBgColor: '#1e295b',
  postTemplate: DEFAULT_POST_TEMPLATE,
};

const SAMPLE_ROWS: ScheduleRow[] = [
  {
    id: 'row-1',
    clinicName: 'الباطنة',
    doctorName: 'أحمد سليمان',
    startTime: '4:00 م',
    endTime: '6:00 م',
    icon: 'internal',
    iconColor: '#0284c7',
    sortOrder: 0,
  },
  {
    id: 'row-2',
    clinicName: 'عيادة الأطفال',
    doctorName: 'د/ سارة محمود',
    startTime: '5:00 م',
    endTime: '8:00 م',
    icon: 'baby',
    iconColor: '#ec4899',
    sortOrder: 1,
  },
];

test('formatClinicRowForFacebook formats specialty, doctor prefix, and times cleanly', () => {
  const line1 = formatClinicRowForFacebook(SAMPLE_ROWS[0]);
  assert.equal(line1, '🔹 عيادة الباطنة — د/ أحمد سليمان (من 4:00 م إلى 6:00 م)');

  const line2 = formatClinicRowForFacebook(SAMPLE_ROWS[1]);
  assert.equal(line2, '🔹 عيادة الأطفال — د/ سارة محمود (من 5:00 م إلى 8:00 م)');
});

test('formatFacebookSchedulePost includes dayLabel, formatted clinic rows, and contact info even when {العيادات} is omitted from postTemplate', () => {
  const text = formatFacebookSchedulePost({
    dayLabel: 'الأحد',
    rows: SAMPLE_ROWS,
    settings: MOCK_SETTINGS,
  });

  assert.ok(text.includes('جدول عيادات يوم الأحد'));
  assert.ok(text.includes('🔹 عيادة الباطنة — د/ أحمد سليمان (من 4:00 م إلى 6:00 م)'));
  assert.ok(text.includes('🔹 عيادة الأطفال — د/ سارة محمود (من 5:00 م إلى 8:00 م)'));
  assert.ok(text.includes('01202027567'));
  assert.ok(text.includes('0502053187'));
});

test('formatFacebookSchedulePost replaces {العيادات} placeholder when present in postTemplate', () => {
  const customSettings: CenterSettings = {
    ...MOCK_SETTINGS,
    postTemplate: 'عيادات يوم {اليوم} في {المجمع}:\n{العيادات}\nللتواصل: {الواتساب}',
  };

  const text = formatFacebookSchedulePost({
    dayLabel: 'الإثنين',
    rows: SAMPLE_ROWS,
    settings: customSettings,
  });

  assert.ok(text.startsWith('عيادات يوم الإثنين في مجمع ميت عزون الطبي:'));
  assert.ok(text.includes('🔹 عيادة الباطنة — د/ أحمد سليمان'));
  assert.ok(text.endsWith('للتواصل: 01202027567'));
});

test('publishToFacebookPageGraphApi validates credentials and returns post_id on Graph API v21.0 success', async () => {
  const missingCreds = await publishToFacebookPageGraphApi({
    pageId: '',
    pageAccessToken: '',
    message: 'اختبار',
  });
  assert.equal(missingCreds.ok, false);
  assert.equal(missingCreds.statusCode, 500);

  let capturedUrl = '';
  let capturedBody: Record<string, unknown> = {};

  const fakeFetch: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedBody = JSON.parse(String(init?.body || '{}'));
    return new Response(JSON.stringify({ id: '123456_987654321' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const successRes = await publishToFacebookPageGraphApi({
    pageId: '123456',
    pageAccessToken: 'EAA_TEST_TOKEN',
    message: 'جدول عيادات يوم الأحد',
    fetchImpl: fakeFetch,
  });

  assert.equal(
    capturedUrl,
    'https://graph.facebook.com/v21.0/123456/feed'
  );
  assert.equal(capturedBody.message, 'جدول عيادات يوم الأحد');
  assert.equal(capturedBody.access_token, 'EAA_TEST_TOKEN');
  assert.equal(successRes.ok, true);
  assert.equal(successRes.success, true);
  assert.equal(successRes.post_id, '123456_987654321');
});

test('publishToFacebookPageGraphApi handles Meta Graph API error responses cleanly', async () => {
  const errorFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Invalid OAuth access token.',
          type: 'OAuthException',
          code: 190,
        },
      }),
      { status: 400 }
    );
  };

  const errRes = await publishToFacebookPageGraphApi({
    pageId: '123456',
    pageAccessToken: 'BAD_TOKEN',
    message: 'منشور تجريبي',
    fetchImpl: errorFetch,
  });

  assert.equal(errRes.ok, false);
  assert.equal(errRes.statusCode, 400);
  assert.ok(errRes.error?.includes('190'));
  assert.ok(errRes.error?.includes('Invalid OAuth access token'));
});

test('resolveDayMetaById resolves valid DayId or falls back to saturday', () => {
  assert.deepEqual(resolveDayMetaById('tuesday'), {
    dayId: 'tuesday',
    dayLabel: 'الثلاثاء',
  });
  assert.deepEqual(resolveDayMetaById('unknown'), {
    dayId: 'saturday',
    dayLabel: 'السبت',
  });
});

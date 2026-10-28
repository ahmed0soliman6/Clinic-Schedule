import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { CenterSettings, FacebookPostMode } from '../types/schedule.js';
import {
  MAX_PHOTO_BYTES,
  buildShortFacebookCaption,
  decideFacebookPublishPlan,
  inspectStoredPosterImageStatus,
  validateJpegBuffer,
} from './facebookPostLogic.js';

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
};

// Minimal valid JPEG header (FF D8 FF E0 00 10 4A 46 49 46 00 01 ...)
function createDummyJpegBuffer(byteLength = 128): Buffer {
  const buf = Buffer.alloc(byteLength);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  return buf;
}

describe('Facebook Post Pure Logic Tests', () => {
  test('buildShortFacebookCaption includes contact info and links without repeating clinics', () => {
    const caption = buildShortFacebookCaption({
      dayLabel: 'السبت',
      settings: MOCK_SETTINGS,
    });

    assert.ok(caption.includes('جدول عيادات يوم السبت'), 'Should contain day label');
    assert.ok(caption.includes('مجمع ميت عزون الطبي'), 'Should contain complex name');
    assert.ok(caption.includes('01202027567'), 'Should contain whatsapp phone');
    assert.ok(caption.includes('https://wa.me/201202027567'), 'Should contain whatsapp link');
    assert.ok(caption.includes('0502053187'), 'Should contain landline phone');
    assert.ok(caption.includes('01515674347'), 'Should contain dental clinic phone');
    assert.ok(caption.includes('https://is.gd/cDsyaR'), 'Should contain whatsapp channel url');
    assert.ok(caption.includes('https://www.instagram.com/mit.azzoun.medical'), 'Should contain instagram url');

    // Should NOT repeat the clinics list as text because the poster image contains it all
    assert.ok(!caption.includes('الجراحة العامة'), 'Must not contain specific clinic row text');
    assert.ok(!caption.includes('الباطنة'), 'Must not contain specific clinic row text');
  });

  test('validateJpegBuffer correctly verifies JPEG magic bytes (FF D8 FF)', () => {
    const validJpeg = createDummyJpegBuffer(256);
    const validResult = validateJpegBuffer(validJpeg);
    assert.equal(validResult.valid, true);
    assert.equal(validResult.sizeBytes, 256);

    // PNG magic bytes (89 50 4E 47)
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const pngResult = validateJpegBuffer(pngBuffer);
    assert.equal(pngResult.valid, false);
    assert.ok(pngResult.error?.includes('Magic Bytes'));

    // Empty buffer
    const emptyResult = validateJpegBuffer(Buffer.alloc(0));
    assert.equal(emptyResult.valid, false);

    // Oversized buffer (> 3MB)
    const oversized = Buffer.alloc(MAX_PHOTO_BYTES + 10);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;
    const oversizedResult = validateJpegBuffer(oversized);
    assert.equal(oversizedResult.valid, false);
    assert.ok(oversizedResult.error?.includes('3MB'));
  });

  test('decideFacebookPublishPlan returns reject_error on manual trigger when image is missing or version mismatch', () => {
    // Missing image
    const planMissing = decideFacebookPublishPlan({
      mode: 'photo_with_caption',
      scheduleVersion: 5,
      storedPosterImage: null,
      dayLabel: 'السبت',
      settings: MOCK_SETTINGS,
      isManualTrigger: true,
    });
    assert.equal(planMissing.action, 'reject_error');
    if (planMissing.action === 'reject_error') {
      assert.ok(
        planMissing.errorMessage.includes('صورة الجدول غير محدّثة'),
        'Must return user-friendly Arabic error'
      );
    }

    // Version mismatch (schedule is version 6, poster is version 5)
    const dummyJpeg = createDummyJpegBuffer(200);
    const planMismatch = decideFacebookPublishPlan({
      mode: 'photo_with_caption',
      scheduleVersion: 6,
      storedPosterImage: {
        dayId: 'saturday',
        version: 5,
        imageBase64: dummyJpeg.toString('base64'),
        mime: 'image/jpeg',
      },
      dayLabel: 'السبت',
      settings: MOCK_SETTINGS,
      isManualTrigger: true,
    });
    assert.equal(planMismatch.action, 'reject_error');
    if (planMismatch.action === 'reject_error') {
      assert.ok(planMismatch.errorMessage.includes('صورة الجدول غير محدّثة'));
    }
  });

  test('decideFacebookPublishPlan falls back to text on automatic cron when image version mismatches', () => {
    const dummyJpeg = createDummyJpegBuffer(200);
    const planCron = decideFacebookPublishPlan({
      mode: 'photo_with_caption',
      scheduleVersion: 6,
      storedPosterImage: {
        dayId: 'saturday',
        version: 5,
        imageBase64: dummyJpeg.toString('base64'),
        mime: 'image/jpeg',
      },
      dayLabel: 'السبت',
      settings: MOCK_SETTINGS,
      isManualTrigger: false, // Cron trigger!
    });

    assert.equal(planCron.action, 'post_text_only');
    if (planCron.action === 'post_text_only') {
      assert.ok(planCron.warning, 'Must record warning for cron log/appConfig');
    }
  });

  test('decideFacebookPublishPlan produces post_photo with caption when mode is photo_with_caption and versions match', () => {
    const dummyJpeg = createDummyJpegBuffer(300);
    const plan = decideFacebookPublishPlan({
      mode: 'photo_with_caption',
      scheduleVersion: 4,
      storedPosterImage: {
        dayId: 'saturday',
        version: 4,
        imageBase64: dummyJpeg.toString('base64'),
        mime: 'image/jpeg',
      },
      dayLabel: 'السبت',
      settings: MOCK_SETTINGS,
      isManualTrigger: true,
    });

    assert.equal(plan.action, 'post_photo');
    if (plan.action === 'post_photo') {
      assert.ok(plan.jpegBuffer instanceof Buffer);
      assert.ok(plan.caption && plan.caption.includes('جدول عيادات يوم السبت'));
    }
  });

  test('decideFacebookPublishPlan produces post_photo without caption when mode is photo_only', () => {
    const dummyJpeg = createDummyJpegBuffer(300);
    const plan = decideFacebookPublishPlan({
      mode: 'photo_only',
      scheduleVersion: 4,
      storedPosterImage: {
        dayId: 'saturday',
        version: 4,
        imageBase64: dummyJpeg.toString('base64'),
        mime: 'image/jpeg',
      },
      dayLabel: 'السبت',
      settings: MOCK_SETTINGS,
      isManualTrigger: true,
    });

    assert.equal(plan.action, 'post_photo');
    if (plan.action === 'post_photo') {
      assert.equal(plan.caption, undefined);
    }
  });

  test('decideFacebookPublishPlan respects text_only mode', () => {
    const dummyJpeg = createDummyJpegBuffer(300);
    const plan = decideFacebookPublishPlan({
      mode: 'text_only',
      scheduleVersion: 4,
      storedPosterImage: {
        dayId: 'saturday',
        version: 4,
        imageBase64: dummyJpeg.toString('base64'),
        mime: 'image/jpeg',
      },
      dayLabel: 'السبت',
      settings: MOCK_SETTINGS,
      isManualTrigger: true,
    });

    assert.equal(plan.action, 'post_text_only');
  });

  test('server relies exclusively on server-side Firestore posterImages, ignoring unverified client payload', () => {
    // If storedPosterImage in Firestore is null, even if client sends an arbitrary base64 image,
    // the server logic rejects it and refuses to publish unverified client bytes
    const plan = decideFacebookPublishPlan({
      mode: 'photo_with_caption',
      scheduleVersion: 3,
      storedPosterImage: null, // Firestore has no verified record
      dayLabel: 'السبت',
      settings: MOCK_SETTINGS,
      isManualTrigger: true,
    });

    assert.equal(plan.action, 'reject_error');
    if (plan.action === 'reject_error') {
      assert.ok(plan.errorMessage.includes('صورة الجدول غير محدّثة'));
    }
  });

  test('decideFacebookPublishPlan returns skip_retry on automatic cron when fallbackMode is skip and image is outdated or missing', () => {
    const dummyJpeg = createDummyJpegBuffer(200);
    const planOutdatedSkip = decideFacebookPublishPlan({
      mode: 'photo_with_caption',
      fallbackMode: 'skip',
      scheduleVersion: 8,
      storedPosterImage: {
        dayId: 'sunday',
        version: 7,
        imageBase64: dummyJpeg.toString('base64'),
        mime: 'image/jpeg',
      },
      dayLabel: 'الأحد',
      settings: MOCK_SETTINGS,
      isManualTrigger: false,
    });
    assert.equal(planOutdatedSkip.action, 'skip_retry');
    if (planOutdatedSkip.action === 'skip_retry') {
      assert.ok(planOutdatedSkip.reason.includes('إصدار الصورة'));
      assert.ok(planOutdatedSkip.errorMessage.includes('لحين تحديث الصورة'));
    }

    const planMissingSkip = decideFacebookPublishPlan({
      mode: 'photo_only',
      fallbackMode: 'skip',
      scheduleVersion: 3,
      storedPosterImage: null,
      dayLabel: 'الإثنين',
      settings: MOCK_SETTINGS,
      isManualTrigger: false,
    });
    assert.equal(planMissingSkip.action, 'skip_retry');
  });

  test('inspectStoredPosterImageStatus accurately classifies up_to_date, outdated, missing, and invalid images', () => {
    const dummyJpeg = createDummyJpegBuffer(256);

    assert.deepEqual(inspectStoredPosterImageStatus(4, null), {
      status: 'missing',
      posterVersion: null,
    });

    assert.deepEqual(
      inspectStoredPosterImageStatus(4, {
        dayId: 'saturday',
        version: 4,
        imageBase64: dummyJpeg.toString('base64'),
        mime: 'image/jpeg',
      }),
      {
        status: 'up_to_date',
        posterVersion: 4,
      }
    );

    assert.deepEqual(
      inspectStoredPosterImageStatus(5, {
        dayId: 'saturday',
        version: 4,
        imageBase64: dummyJpeg.toString('base64'),
        mime: 'image/jpeg',
      }),
      {
        status: 'outdated',
        posterVersion: 4,
      }
    );

    assert.deepEqual(
      inspectStoredPosterImageStatus(4, {
        dayId: 'saturday',
        version: 4,
        imageBase64: Buffer.from([1, 2, 3]).toString('base64'),
        mime: 'image/jpeg',
      }),
      {
        status: 'invalid',
        posterVersion: 4,
      }
    );
  });
});


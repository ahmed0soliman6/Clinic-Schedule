import { toPng } from 'html-to-image';
import { CenterSettings, ClinicIconId, ScheduleRow } from '../types/schedule';
import {
  POSTER_EXPORT_HEIGHT,
  POSTER_EXPORT_WIDTH,
  normalizeRightLogoUrl,
  normalizeSortOrders,
} from './scheduleLogic';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | { tl: number; tr: number; br: number; bl: number }
) {
  const radii =
    typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : r;
  ctx.beginPath();
  ctx.moveTo(x + radii.tl, y);
  ctx.lineTo(x + w - radii.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radii.tr);
  ctx.lineTo(x + w, y + h - radii.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radii.br, y + h);
  ctx.lineTo(x + radii.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radii.bl);
  ctx.lineTo(x, y + radii.tl);
  ctx.quadraticCurveTo(x, y, x + radii.tl, y);
  ctx.closePath();
}

function drawCanvasClinicIcon(
  ctx: CanvasRenderingContext2D,
  icon: ClinicIconId,
  color: string,
  cx: number,
  cy: number,
  size: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const r = size / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = `${color}18`;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.fillStyle = color;
  switch (icon) {
    case 'eye':
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.65, r * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'internal':
      // Stomach / Digestive shape on canvas
      ctx.beginPath();
      ctx.arc(cx + r * 0.08, cy + r * 0.06, r * 0.42, 0.2, Math.PI * 1.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.1, cy - r * 0.48);
      ctx.lineTo(cx - r * 0.1, cy - r * 0.15);
      ctx.moveTo(cx - r * 0.2, cy + r * 0.25);
      ctx.lineTo(cx - r * 0.32, cy + r * 0.52);
      ctx.stroke();
      break;
    case 'heart':
      ctx.beginPath();
      ctx.arc(cx - r * 0.22, cy - r * 0.1, r * 0.25, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.22, cy - r * 0.1, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy);
      ctx.lineTo(cx, cy + r * 0.48);
      ctx.lineTo(cx + r * 0.45, cy);
      ctx.fill();
      break;
    case 'gynecology':
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.18, r * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.14);
      ctx.lineTo(cx, cy + r * 0.58);
      ctx.moveTo(cx - r * 0.24, cy + r * 0.38);
      ctx.lineTo(cx + r * 0.24, cy + r * 0.38);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.42);
      ctx.lineTo(cx, cy + r * 0.42);
      ctx.moveTo(cx - r * 0.42, cy);
      ctx.lineTo(cx + r * 0.42, cy);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/**
 * Guarantees that any captured poster image is always normalized onto an exact
 * 4:5 High-Resolution Canvas (1440 x 1800 pixels) whether the schedule has 2 rows or 9+ rows.
 */
async function fitImageOntoFixed4x5Canvas(
  rawDataUrl: string,
  settings: CenterSettings
): Promise<string | null> {
  const img = await loadImage(rawDataUrl);
  if (!img) return null;

  const canvas = document.createElement('canvas');
  canvas.width = POSTER_EXPORT_WIDTH; // 1440
  canvas.height = POSTER_EXPORT_HEIGHT; // 1800 (4:5 aspect ratio)
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fill background with matching lavender radial gradient
  const bgGrad = ctx.createRadialGradient(
    POSTER_EXPORT_WIDTH / 2,
    POSTER_EXPORT_HEIGHT * 0.25,
    60,
    POSTER_EXPORT_WIDTH / 2,
    POSTER_EXPORT_HEIGHT * 0.5,
    POSTER_EXPORT_HEIGHT * 0.8
  );
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.48, settings.bgStartColor);
  bgGrad.addColorStop(1, settings.bgEndColor);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, POSTER_EXPORT_WIDTH, POSTER_EXPORT_HEIGHT);

  const scale = Math.min(
    POSTER_EXPORT_WIDTH / img.width,
    POSTER_EXPORT_HEIGHT / img.height
  );
  const drawW = Math.round(img.width * scale);
  const drawH = Math.round(img.height * scale);
  const offsetX = Math.round((POSTER_EXPORT_WIDTH - drawW) / 2);
  const offsetY = Math.round((POSTER_EXPORT_HEIGHT - drawH) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

  return canvas.toDataURL('image/png', 1.0);
}

export async function renderHighResPosterDataUrl(
  dayLabel: string,
  rows: ScheduleRow[],
  settings: CenterSettings,
  domNode?: HTMLElement | null
): Promise<string> {
  // 1. Capture the dedicated 780x975 (4:5) export poster DOM node at high pixelRatio
  // and composite onto a strict 1440x1800 (4:5) PNG canvas.
  if (domNode) {
    try {
      await document.fonts?.ready;
      const rawDataUrl = await toPng(domNode, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: true,
        backgroundColor: settings.bgStartColor,
        filter: (node) => {
          if (node instanceof HTMLElement && node.dataset?.exportIgnore === 'true') {
            return false;
          }
          return true;
        },
      });
      if (
        rawDataUrl &&
        rawDataUrl.startsWith('data:image/png;base64,') &&
        rawDataUrl.length > 2000
      ) {
        const fitted4x5 = await fitImageOntoFixed4x5Canvas(rawDataUrl, settings);
        if (fitted4x5) return fitted4x5;
        return rawDataUrl;
      }
    } catch {
      // Fall through to native high-DPI 4:5 Canvas 2D renderer
    }
  }

  // 2. Fallback High-DPI Native Canvas 2D Renderer — ALWAYS exact 1440x1800 (4:5 aspect ratio)
  const orderedRows = normalizeSortOrders(rows);
  const width = POSTER_EXPORT_WIDTH; // 1440
  const height = POSTER_EXPORT_HEIGHT; // 1800 (exact 4:5)

  const headerHeight = 320;
  const tableHeaderHeight = 86;
  const footerHeight = 190;
  const verticalPadding = 74;
  const availableBodyHeight =
    height - headerHeight - tableHeaderHeight - footerHeight - verticalPadding;
  const rowCount = Math.max(1, orderedRows.length);
  const rowHeight = Math.floor(availableBodyHeight / rowCount);
  const tableBodyHeight = rowCount * rowHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.direction = 'rtl';

  const bgGrad = ctx.createRadialGradient(
    width / 2,
    height * 0.25,
    60,
    width / 2,
    height * 0.5,
    height * 0.8
  );
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.5, settings.bgStartColor);
  bgGrad.addColorStop(1, settings.bgEndColor);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const [rightLogo, leftLogo] = await Promise.all([
    loadImage(normalizeRightLogoUrl(settings.rightLogoUrl)),
    loadImage(settings.leftLogoUrl),
  ]);

  if (rightLogo) {
    ctx.drawImage(rightLogo, width - 290, 38, 235, 235);
  }
  if (leftLogo) {
    ctx.drawImage(leftLogo, 55, 38, 225, 225);
  }

  const pillW = 420;
  const pillH = 126;
  const pillX = (width - pillW) / 2;
  const pillY = 118;

  const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
  pillGrad.addColorStop(0, '#6d28d9');
  pillGrad.addColorStop(0.5, '#4c1d95');
  pillGrad.addColorStop(1, '#1e1b4b');
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 63);
  ctx.fillStyle = pillGrad;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = "900 62px 'Cairo', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(dayLabel, width / 2, pillY + pillH / 2 + 4);

  const tableX = 46;
  const tableY = headerHeight;
  const tableW = width - 92;
  const totalTableH = tableHeaderHeight + tableBodyHeight + 28;

  drawRoundedRect(ctx, tableX, tableY, tableW, totalTableH, 34);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const innerX = tableX + 14;
  const innerY = tableY + 14;
  const innerW = tableW - 28;

  const colClinicW = Math.floor(innerW * 0.34);
  const colDoctorW = Math.floor(innerW * 0.32);
  const colFromW = Math.floor(innerW * 0.17);
  const colToW = innerW - colClinicW - colDoctorW - colFromW;

  const xClinic = innerX + innerW - colClinicW;
  const xDoctor = xClinic - colDoctorW;
  const xFrom = xDoctor - colFromW;
  const xTo = innerX;

  drawRoundedRect(ctx, xClinic + 2, innerY, colClinicW - 2, tableHeaderHeight, {
    tl: 0,
    tr: 24,
    br: 0,
    bl: 0,
  });
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  ctx.fillStyle = '#0d9456';
  ctx.fillRect(xDoctor + 2, innerY, colDoctorW - 4, tableHeaderHeight);

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(xFrom + 2, innerY, colFromW - 4, tableHeaderHeight);

  drawRoundedRect(ctx, xTo, innerY, colToW - 2, tableHeaderHeight, {
    tl: 24,
    tr: 0,
    br: 0,
    bl: 0,
  });
  ctx.fillStyle = '#0088cc';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = "800 36px 'Cairo', sans-serif";
  ctx.fillText('العيادة', xClinic + colClinicW / 2, innerY + tableHeaderHeight / 2);
  ctx.fillText('الطبيب', xDoctor + colDoctorW / 2, innerY + tableHeaderHeight / 2);
  ctx.fillText('من', xFrom + colFromW / 2, innerY + tableHeaderHeight / 2);
  ctx.fillText('إلى', xTo + colToW / 2, innerY + tableHeaderHeight / 2);

  const fontSize =
    rowCount <= 4
      ? 50
      : rowCount <= 6
      ? 45
      : rowCount <= 8
      ? 40
      : rowCount <= 10
      ? 35
      : rowCount <= 14
      ? 29
      : rowCount <= 18
      ? 24
      : rowCount <= 22
      ? 20
      : 18;

  const canvasIconSize =
    rowCount <= 4
      ? 44
      : rowCount <= 7
      ? 40
      : rowCount <= 10
      ? 34
      : rowCount <= 14
      ? 28
      : rowCount <= 20
      ? 22
      : 18;

  orderedRows.forEach((row, idx) => {
    const ry = innerY + tableHeaderHeight + 3 + idx * rowHeight;
    const rh = Math.max(16, rowHeight - 3);

    ctx.fillStyle = '#fdf8f3';
    ctx.fillRect(xClinic + 2, ry, colClinicW - 2, rh);

    ctx.fillStyle = '#f1f5f2';
    ctx.fillRect(xDoctor + 2, ry, colDoctorW - 4, rh);

    ctx.fillStyle = '#fdf9f2';
    ctx.fillRect(xFrom + 2, ry, colFromW - 4, rh);

    ctx.fillStyle = '#eef6fc';
    ctx.fillRect(xTo, ry, colToW - 2, rh);

    drawCanvasClinicIcon(
      ctx,
      row.icon,
      row.iconColor,
      xClinic + colClinicW - (canvasIconSize + 4),
      ry + rh / 2,
      canvasIconSize
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = `900 ${fontSize}px 'Cairo', sans-serif`;
    ctx.fillText(row.clinicName, xClinic + (colClinicW - (canvasIconSize + 16)) / 2, ry + rh / 2);
    ctx.fillText(row.doctorName, xDoctor + colDoctorW / 2, ry + rh / 2);
    ctx.font = `900 ${Math.min(fontSize, 36)}px 'Cairo', sans-serif`;
    ctx.fillText(row.startTime, xFrom + colFromW / 2, ry + rh / 2);
    ctx.fillText(row.endTime, xTo + colToW / 2, ry + rh / 2);
  });

  // Footer Bar matching Attachment #2 (3 horizontal columns)
  const footerY = height - footerHeight - 24;
  drawRoundedRect(ctx, tableX, footerY, tableW, footerHeight, 32);
  ctx.fillStyle = settings.footerBgColor;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = "700 32px 'Cairo', sans-serif";
  ctx.fillText(settings.address, width / 2, footerY + 54);

  ctx.font = "800 32px 'Cairo', sans-serif";
  ctx.fillText(settings.whatsappPhone, width * 0.22, footerY + 130);
  ctx.fillText(settings.landlinePhone, width * 0.5, footerY + 130);
  ctx.fillText(settings.dentalPhone, width * 0.78, footerY + 115);
  ctx.font = "700 22px 'Cairo', sans-serif";
  ctx.fillText(settings.dentalLabel, width * 0.78, footerY + 152);

  return canvas.toDataURL('image/png', 1.0);
}

export async function dataUrlToPngFile(
  dataUrl: string,
  dayLabel: string
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const fileName = `جدول-عيادات-مجمع-ميت-عزون-${dayLabel}.png`;
  return new File([blob], fileName, { type: 'image/png' });
}

export async function preparePosterExportAssets(
  dayLabel: string,
  rows: ScheduleRow[],
  settings: CenterSettings,
  domNode?: HTMLElement | null
): Promise<{ dataUrl: string; file: File }> {
  const dataUrl = await renderHighResPosterDataUrl(dayLabel, rows, settings, domNode);
  const file = await dataUrlToPngFile(dataUrl, dayLabel);
  return { dataUrl, file };
}

export function triggerInstantPngDownload(dataUrl: string, dayLabel: string): void {
  const link = document.createElement('a');
  link.download = `جدول-عيادات-مجمع-ميت-عزون-${dayLabel}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportPosterAsPng(
  dayLabel: string,
  rows: ScheduleRow[],
  settings: CenterSettings,
  domNode?: HTMLElement | null
): Promise<{ dataUrl: string; file: File }> {
  const { dataUrl, file } = await preparePosterExportAssets(
    dayLabel,
    rows,
    settings,
    domNode
  );
  triggerInstantPngDownload(dataUrl, dayLabel);
  return { dataUrl, file };
}


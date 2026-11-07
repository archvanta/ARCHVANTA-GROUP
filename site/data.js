export const departments = [
  { id: 'arc', code: 'ARC', name: 'معماری، BIM و دیتاسنتر', manager: 'مدیر معماری و زیرساخت', specialists: ['طراح دیتاسنتر', 'مدل‌ساز BIM', 'بازبین فنی'], mission: 'برنامه‌ریزی فضا، مدل‌سازی و بازبینی مستندات فنی.', icon: 'building', tone: 'mint' },
  { id: 'dsg', code: 'DSG', name: 'طراحی، برندینگ و سه‌بعدی', manager: 'مدیر طراحی و برند', specialists: ['طراح هویت بصری', 'مدل‌ساز سه‌بعدی'], mission: 'طراحی هویت برند و تولید خروجی‌های بصری قابل تحویل.', icon: 'pen', tone: 'purple' },
  { id: 'eng', code: 'ENG', name: 'وب، نرم‌افزار و AI', manager: 'مدیر مهندسی', specialists: ['توسعه‌دهنده وب', 'مهندس عامل‌های AI', 'بازبین کد'], mission: 'توسعه، آزمون و نگهداری ابزارها و محصول‌های دیجیتال.', icon: 'code', tone: 'blue' },
  { id: 'int', code: 'INT', name: 'محیط‌های تعاملی', manager: 'مدیر تجربه تعاملی', specialists: ['طراح تجربه فضایی', 'توسعه‌دهنده سه‌بعدی'], mission: 'ساخت تجربه‌های فضایی و نمایش سه‌بعدی وضعیت عملیات.', icon: 'cube', tone: 'cyan' },
  { id: 'res', code: 'RES', name: 'رسانه و تحقیق', manager: 'مدیر رسانه و تحقیق', specialists: ['پژوهشگر', 'ویراستار'], mission: 'گردآوری و راستی‌آزمایی منابع و آماده‌سازی خروجی تحریریه.', icon: 'book', tone: 'amber' },
  { id: 'ops', code: 'OPS', name: 'عملیات و رشد', manager: 'مدیر عملیات و رشد', specialists: ['تحلیلگر عملیات', 'تحلیلگر رشد'], mission: 'پایش فرایندها، اندازه‌گیری عملکرد و پیشنهاد مسیر رشد.', icon: 'trend', tone: 'rose' },
];

export const tasks = [
  { id: 'ARC-014', departmentId: 'arc', title: 'بازبینی طرح اولیه دیتاسنتر', assignee: 'طراح دیتاسنتر', status: 'awaiting_approval', risk: 'high', version: 1 },
  { id: 'DSG-008', departmentId: 'dsg', title: 'تأیید مسیر هویت بصری شرکت', assignee: 'طراح هویت بصری', status: 'awaiting_approval', risk: 'medium', version: 1 },
  { id: 'ENG-021', departmentId: 'eng', title: 'انتشار نسخهٔ نمایشی داشبورد', assignee: 'توسعه‌دهنده وب', status: 'awaiting_approval', risk: 'medium', version: 1 },
  { id: 'ARC-015', departmentId: 'arc', title: 'تهیهٔ چک‌لیست کنترل مدل BIM', assignee: 'مدل‌ساز BIM', status: 'in_progress', risk: 'low', version: 1 },
  { id: 'ENG-022', departmentId: 'eng', title: 'آزمون رابط فارسی در موبایل', assignee: 'توسعه‌دهنده وب', status: 'in_progress', risk: 'low', version: 1 },
  { id: 'INT-004', departmentId: 'int', title: 'طرح اولیهٔ نمایش وضعیت دفتر', assignee: 'طراح تجربه فضایی', status: 'review', risk: 'low', version: 1 },
  { id: 'RES-009', departmentId: 'res', title: 'گردآوری منابع تحقیق دیتاسنتر', assignee: 'پژوهشگر', status: 'in_progress', risk: 'low', version: 1 },
  { id: 'OPS-006', departmentId: 'ops', title: 'تعریف شاخص‌های عملیات شرکت', assignee: 'تحلیلگر عملیات', status: 'in_progress', risk: 'low', version: 1 },
  { id: 'RES-007', departmentId: 'res', title: 'محدودهٔ گزارش پژوهشی داخلی', assignee: 'ویراستار', status: 'ready', risk: 'medium', version: 1 },
  { id: 'OPS-005', departmentId: 'ops', title: 'تهیهٔ قالب گزارش هفتگی', assignee: 'تحلیلگر عملیات', status: 'done', risk: 'low', version: 1 },
];

export const approvals = [
  { id: 'APR-001', taskId: 'ARC-014', taskVersion: 1, submittedAt: '2026-11-07T07:30:00Z', summary: 'انتخاب گزینهٔ مفهومی برای ورود به مطالعهٔ فنی.', recommendation: 'مدیر معماری گزینهٔ B را برای مطالعهٔ فنی پیشنهاد کرده است. بازبینی اولیه مسیرهای دسترسی و امکان توسعه را پوشش داده است.', scope: 'صرفاً ادامهٔ مطالعهٔ مفهومی گزینهٔ B، مشروط به بررسی ظرفیت برق و مسیرهای نگهداری.', impact: 'انتخاب گزینه مسیر بررسی زیرساخت و برآورد ظرفیت را تعیین می‌کند. تعهد خرید یا اجرای ساخت در محدودهٔ این درخواست نیست.' },
  { id: 'APR-002', taskId: 'DSG-008', taskVersion: 1, submittedAt: '2026-11-07T06:45:00Z', summary: 'انتخاب جهت بصری برای توسعهٔ راهنمای برند.', recommendation: 'مدیر طراحی جهت بصری شمارهٔ ۲ را به دلیل خوانایی فارسی و کاربرد در رابط و ارائه پیشنهاد کرده است.', scope: 'توسعهٔ راهنمای داخلی رنگ، تایپوگرافی و کاربرد نشان بر اساس جهت ۲.', impact: 'این انتخاب روی ظاهر خروجی‌های عمومی آینده اثر می‌گذارد. استفادهٔ عمومی به بازبینی جداگانه نیاز دارد.' },
  { id: 'APR-003', taskId: 'ENG-021', taskVersion: 1, submittedAt: '2026-11-06T14:25:00Z', summary: 'بازبینی دامنهٔ انتشار دمو با داده‌های نمونه.', recommendation: 'مدیر مهندسی پس از بررسی فایل‌های خروجی و مسیرهای نسبی، انتشار دموی استاتیک را پیشنهاد کرده است.', scope: 'انتشار عمومی فایل‌های رابط با داده‌های ساختگی روی GitHub Pages.', impact: 'هر فایل خروجی در دسترس عموم است. انتشار دادهٔ داخلی یا کلید دسترسی خارج از این درخواست است.' },
  { id: 'APR-004', taskId: 'RES-007', taskVersion: 1, submittedAt: '2026-11-05T09:00:00Z', summary: 'تعیین محدودهٔ اولین گزارش داخلی.', recommendation: 'مدیر تحقیق تمرکز گزارش بر منابع اولیه و نتایج قابل راستی‌آزمایی را پیشنهاد کرده است.', scope: 'آماده‌سازی پیش‌نویس داخلی با منابع عمومی.', impact: 'موضوع گزارش و ظرفیت هفتهٔ اول تیم تحقیق مشخص می‌شود.' },
];

export const sampleDecision = { approvalId: 'APR-004', taskVersion: 1, decision: 'approved', note: 'منابع اولیه و تاریخ دسترسی هر منبع درج شود.', decidedAt: '2026-11-06T11:12:00Z' };

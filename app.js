/* =========================================================
   دبیرستان شهید حسین اشرفی — app.js
   ثبت‌نام دانش‌آموز (کپچا + OTP)، پنل مدیر و معاون، اولیا،
   غایبین با جستجو، سیستم استادها (ثبت‌نام + OTP + کلاس/درس)،
   نمره‌گذاری، ورود/خروج استادها، انضباط، اطلاعیه و کارنامه
   داده‌ها در localStorage همین دستگاه ذخیره می‌شود (نسخهٔ دمو)
   ========================================================= */
'use strict';

/* ---------- تنظیمات ---------- */
const DEFAULT_ADMIN_PASS = 'Hosain ashrafi0022';   // رمز پیش‌فرض مدیر/معاون (قابل تغییر از تنظیمات)
const CLASSES = ['7a', '7b', '8a', '8b', '9a', '9b'];
const CLASS_LABEL = {
    '7a': 'هفتم A', '7b': 'هفتم B',
    '8a': 'هشتم A', '8b': 'هشتم B',
    '9a': 'نهم A',  '9b': 'نهم B'
};
/* درس‌های مدرسه — نام درس‌ها در همهٔ پایه‌ها یکسان است، فقط استادِ هر درس در هر کلاس فرق دارد */
const SUBJECTS_BY_GRADE = {
    '7': ['ریاضی', 'علوم', 'فارسی', 'عربی', 'انگلیسی', 'هنر', 'ورزش', 'کار و فناوری', 'مطالعات اجتماعی', 'املا و نگارش', 'تفکر و سبک زندگی', 'قرآن', 'از من تا خدا'],
    '8': ['ریاضی', 'علوم', 'فارسی', 'عربی', 'انگلیسی', 'هنر', 'ورزش', 'کار و فناوری', 'مطالعات اجتماعی', 'املا و نگارش', 'تفکر و سبک زندگی', 'قرآن', 'از من تا خدا'],
    '9': ['ریاضی', 'علوم', 'فارسی', 'عربی', 'انگلیسی', 'هنر', 'ورزش', 'کار و فناوری', 'مطالعات اجتماعی', 'املا و نگارش', 'آمادگی دفاعی', 'قرآن', 'از من تا خدا']
};
const subjectsOf = (c) => SUBJECTS_BY_GRADE[c[0]] || [];
const DEFAULT_SCHOOL_PHONES = [
    { id: 'ph_admin', role: 'مدیر مدرسه',  name: 'آقای حسین جعفری',           phone: '09395226791', icon: 'fa-user-tie' },
    { id: 'ph_vice',  role: 'معاون مدرسه', name: 'آقای محجر خیری',             phone: '09112920890', icon: 'fa-user-shield' },
    { id: 'ph_off',   role: 'دفتر مدرسه',  name: 'دبیرستان شهید حسین اشرفی',  phone: '01155216333', icon: 'fa-school' }
];

let schoolPhones = [];    // شماره‌های مدرسه — قابل ویرایش از پنل مدیریت
let meritLog = [];        // {id, studentId, from, to, dateFa, at, by, msg} — هر تغییر نمره انضباط + پیام به اولیا

/* ---------- دسترسی معاون (مجوزها را مدیر تعیین می‌کند) ---------- */
const VP_LABEL = {
    parents:    'اولیا (افزودن/ویرایش/حذف شماره) و پیام گروهی',
    absents:    'غایبین (ثبت/حاضر شد/حذف)',
    students:   'دانش‌آموزان (نمره انضباط، موارد انضباطی، ویرایش)',
    teachers:   'استادها (رمز جدید، حذف)',
    addStudent: 'عضو کردن دانش‌آموز جدید',
    addTeacher: 'عضو کردن استاد جدید',
    notices:    'اطلاعیه‌ها (انتشار/حذف)',
    phones:     'شماره‌های مدرسه (افزودن/ویرایش/حذف)',
    adminPass:  'تغییر رمز بخش مدیریت'
};
function vicePerms() { return ls.get('hs_vice_perms', {}); }
function setVicePerm(k, v) {
    const p = vicePerms(); p[k] = !!v;
    ls.set('hs_vice_perms', p);
}
/* آیا کاربرِ فعلی (مدیر یا معاون) دسترسی X را دارد؟ */
function can(k) {
    if (!session.admin) return false;
    if (session.admin === 'مدیر') return true;
    return !!vicePerms()[k];
}

/* واژهٔ «استاد» با خط نستعلیق (خارج از بخش مدیریت) */
const STAD = '<span class="nastaliq">استاد</span>';
const STAD_PLAIN = 'استاد';

/* ---------- ابزارها ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const fa = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const toEn = (s) => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const normPhone = (s) => toEn(String(s || '')).replace(/[\s\-()]/g, '');
const validPhone = (p) => /^09\d{9}$/.test(normPhone(p));
const toIntl = (p) => '+98' + p.slice(1);

/* ---------- ذخیرهٔ محلی (دمو) ---------- */
const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

function dateKey(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function faDate(d = new Date()) {
    return d.toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function faDay(d = new Date()) {
    return d.toLocaleDateString('fa-IR', { weekday: 'long' });
}
function faTime(d = new Date()) {
    return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}
function toast(msg) {
    const t = $('#toast');
    t.innerHTML = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 3500);
}
function openModal(html) {
    $('#modalBox').innerHTML = html;
    $('#overlay').hidden = false;
    document.body.style.overflow = 'hidden';
}
function closeModal() {
    $('#overlay').hidden = true;
    document.body.style.overflow = '';
}
/* دکمهٔ حذف دو مرحله‌ای: کلیک اول «تأیید» می‌شود، کلیک دوم حذف می‌کند */
function confirmBtn(btn, msg) {
    if (btn.dataset.armed) return true;
    btn.dataset.armed = '1';
    btn.classList.add('armed');
    btn.dataset.old = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + (msg || 'تأیید حذف؟');
    setTimeout(() => {
        if (btn.isConnected) { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.innerHTML = btn.dataset.old; }
    }, 3500);
    return false;
}
function showErr(sel, msg) { const e = $(sel); if (!e) return; e.textContent = msg; e.hidden = false; }
function hideErr(sel) { const e = $(sel); if (e) e.hidden = true; }
/* دکمهٔ چشم: نمایش/مخفی رمز (مثل مای مدیو) */
function togglePass(id, btn) {
    const inp = document.getElementById(id);
    if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    const ic = btn && btn.querySelector('i');
    if (ic) ic.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
    if (btn) btn.title = show ? 'مخفی کردن رمز' : 'نمایش رمز';
}

/* ---------- داده‌ها ---------- */
let students = [];        // {id, name, cls, mobile, parentName, parentPhone, merit, at}
let parentsExtra = [];    // {id, studentName, parentName, phone} — شماره‌های دستی/اولیه
let attendance = [];      // {id, studentId, dkey, day, dateFa, status, cameAt, leftAt, reason, note, by}
let discipline = [];      // {id, studentId, dateFa, day, note, at, by}
let teachers = [];        // {id, name, phone, pass, cls:{'7a':['ریاضی','علوم'],...}, at}
let tlog = [];            // ورود/خروج استادها {id, tid, dkey, day, dateFa, cameAt, leftAt, by}
let grades = [];          // نمره‌ها {id, studentId, subject, dkey, dateFa, score, note, by}
let notices = [];         // اطلاعیه‌ها {id, title, text, dateFa, at, big}
let leaves = [];          // درخواست‌های مرخصی
let teacherNotices = [];  // اطلاعیه‌های کلاسی معلم‌ها
let groupMsgs = [];       // پیام‌های گروهی به اولیا {id, text, classes:['7a','8b'], dateFa, at, by, count}

function loadData() {
    students = ls.get('hs_students', []);
    parentsExtra = ls.get('hs_parents_extra', []);
    attendance = ls.get('hs_attendance', []);
    discipline = ls.get('hs_discipline', []);
    teachers = ls.get('hs_teachers', []);
    tlog = ls.get('hs_tlog', []);
    grades = ls.get('hs_grades', []);
    notices = ls.get('hs_notices', []);
    leaves = ls.get('hs_leaves', []);
    teacherNotices = ls.get('hs_teacher_notices', []);
    schoolPhones = ls.get('hs_school_phones', DEFAULT_SCHOOL_PHONES);   // نسخه‌های قبلی بدون id دارند → تکمیل می‌شود
    schoolPhones.forEach(p => { if (!p.id) p.id = uid(); });
    meritLog = ls.get('hs_merit_log', []);
    groupMsgs = ls.get('hs_group_msgs', []);
    // پاک‌سازی خودکار: حاضر/غایب و ورود/خروج استادها بعد از ۲ روز پاک می‌شوند
    const r1 = purgeOldAttendance();
    const r2 = purgeOldTLog();
    const r3 = purgeOldLeaves();
    if (r1 + r2 > 0) toast('<i class="fas fa-broom"></i> ' + fa(r1 + r2) + ' رکورد قدیمی‌تر از ۲ روز خودکار پاک شد.');
    // دادهٔ اولیه: اولیای امیرعلی محمدنیازی (یک‌بار)
    if (!ls.get('hs_seeded', false)) {
        parentsExtra.push({
            id: 'seed_amirali',
            studentName: 'امیرعلی محمدنیازی',
            parentName: 'اولیای امیرعلی محمدنیازی',
            phone: '09359506427'
        });
        ls.set('hs_parents_extra', parentsExtra);
        ls.set('hs_seeded', true);
    }
}
function saveStudents()   { ls.set('hs_students', students); }
function saveExtra()      { ls.set('hs_parents_extra', parentsExtra); }
function saveAttendance() { ls.set('hs_attendance', attendance); }
function saveDiscipline() { ls.set('hs_discipline', discipline); }
function saveTeachers()   { ls.set('hs_teachers', teachers); }
function saveTLog()       { ls.set('hs_tlog', tlog); }
function saveGrades()     { ls.set('hs_grades', grades); }
function saveNotices()    { ls.set('hs_notices', notices); }
function saveLeaves()  { ls.set('hs_leaves', leaves); }
function saveTeacherNotices() { ls.set('hs_teacher_notices', teacherNotices); }
function savePhones()     { ls.set('hs_school_phones', schoolPhones); }
function saveMeritLog()   { ls.set('hs_merit_log', meritLog); }
function saveGroupMsgs()  { ls.set('hs_group_msgs', groupMsgs); }

/* مهاجرت: نسخه‌های قدیمی درس هر کلاس را به‌صورت رشته ذخیره می‌کردند؛ نسخهٔ جدید آرایه است */
function migrateTeacherCls() {
    let changed = false;
    teachers.forEach(t => {
        Object.entries(t.cls || {}).forEach(([c, v]) => {
            if (typeof v === 'string') { t.cls[c] = [v]; changed = true; }
        });
    });
    if (changed) saveTeachers();
    return changed;
}

/* حضور و غیاب فقط ۲ روز نگه‌داری می‌شود — موارد انضباطی و نمره‌ها ماندگارند */
function purgeOldAttendance() {
    const cutoff = dateKey(new Date(Date.now() - 2 * 864e5));
    const before = attendance.length;
    attendance = attendance.filter(a => (a.dkey || '') >= cutoff);
    if (attendance.length !== before) saveAttendance();
    return before - attendance.length;
}
/* ورود/خروج استادها هم بعد از ۲ روز پاک می‌شود */
function purgeOldTLog() {
    const cutoff = dateKey(new Date(Date.now() - 2 * 864e5));
    const before = tlog.length;
    tlog = tlog.filter(t => (t.dkey || '') >= cutoff);
    if (tlog.length !== before) saveTLog();
    return before - tlog.length;
}
/* حذف خودکار درخواست‌های مرخصی بعد از ۱ هفته (۷ روز) */
function purgeOldLeaves() {
    if (!leaves.length) return 0;
    
    // محاسبه تاریخ ۷ روز پیش
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000); 
    const before = leaves.length;
    
    // فقط درخواست‌هایی می‌مونن که تاریخشون جدیدتر از ۷ روز پیش باشه
    leaves = leaves.filter(l => l.at > sevenDaysAgo);
    
    // اگر قرار بوده چیزی پاک بشه، توی حافظه ذخیره کن
    if (leaves.length !== before) saveLeaves();
    return before - leaves.length;
}

const studentById = (id) => students.find(s => s.id === id);
const teacherById = (id) => teachers.find(t => t.id === id);
const adminPass = () => String(ls.get('hs_admin_pass', DEFAULT_ADMIN_PASS));
/* لیست اولیا = خودکار از ثبت‌نام دانش‌آموزها + موارد دستی */
function allParents() {
    const auto = students.map(s => ({ src: 'student', id: s.id, studentId: s.id, studentName: s.name, parentName: s.parentName, phone: s.parentPhone, cls: s.cls }));
    const manual = parentsExtra.map(p => ({ src: 'extra', id: p.id, studentId: null, studentName: p.studentName, parentName: p.parentName, phone: p.phone, cls: null }));
    return [...auto, ...manual];
}

/* ---------- نشست‌ها ---------- */
let session = { admin: null, teacherId: null, studentId: null };
function sessionLabel() {
    if (session.admin) return session.admin;
    if (session.teacherId) {
        const t = teacherById(session.teacherId);
        return t ? STAD_PLAIN + ' ' + t.name : STAD_PLAIN;
    }
    return 'سامانه';
}
function checkAdminPass(p) {
    return p.trim().replace(/\s+/g, ' ').toLowerCase() === adminPass().trim().replace(/\s+/g, ' ').toLowerCase();
}

/* ---------- نمایش ویوها ---------- */
let currentView = 'home';
function show(view) {
    currentView = view;
    $$('.view').forEach(v => v.hidden = true);
    const el = $('#view-' + view);
    if (el) el.hidden = false;
    $$('#mainNav button').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
    window.scrollTo({ top: 0 });
    updateHeader();
    if (view === 'home') renderHome();
    if (view === 'admin' && session.admin) renderAdminTab();
    if (view === 'teacher' && session.teacherId) renderTeacher();
    if (view === 'student' && session.studentId) renderStudentPanel();
}
function updateHeader() {
    const chip = $('#userChip'), txt = $('#userChipText'), ic = $('#userChip .uc-ic i');
    if (session.admin) { chip.hidden = false; txt.textContent = session.admin + ' مدرسه'; ic.className = 'fas fa-user-shield'; }
    else if (session.teacherId) {
        const t = teacherById(session.teacherId);
        chip.hidden = false; txt.textContent = STAD_PLAIN + ' ' + (t ? t.name : ''); ic.className = 'fas fa-chalkboard-user';
    }
    else if (session.studentId) {
        const s = studentById(session.studentId);
        chip.hidden = false; txt.textContent = s ? s.name : 'دانش‌آموز'; ic.className = 'fas fa-user-graduate';
    } else chip.hidden = true;
    $$('#mainNav button').forEach(b => {
        if (b.dataset.nav === 'admin' && session.admin) b.textContent = 'پنل مدیریت';
        if (b.dataset.nav === 'teacher' && session.teacherId) b.innerHTML = 'پنل ' + STAD + 'ها';
    });
}
function logoutAll() {
    session = { admin: null, teacherId: null, studentId: null };
    ls.del('hs_admin'); ls.del('hs_teacher'); ls.del('hs_student');
    updateHeader();
    show('home');
    toast('از حساب خود خارج شدید.');
}

/* ---------- خانه ---------- */
/* اطلاعیهٔ بزرگ وسط صفحه — تا ۴۸ ساعت بعد از انتشار، بار اول نمایش داده می‌شود */
function bigNotice() {
    const n = [...notices].filter(x => x.big).sort((a, b) => b.at - a.at)[0];
    if (!n) return;
    if (!(Date.now() - n.at < 48 * 3600e3)) return;          // قدیمی — نمایش نمی‌دهیم
    const seen = ls.get('hs_big_seen_' + n.id, false);
    if (seen) return;
    const b = document.createElement('div');
    b.className = 'bn-overlay';
    b.innerHTML = `
        <div class="bn-box">
            <div class="bn-flare"></div>
            <div class="bn-head"><span class="bn-icon"><i class="fas fa-bullhorn"></i></span><span class="bn-tag">اطلاعیهٔ مهم مدرسه</span></div>
            <h2 class="bn-title">${esc(n.title)}</h2>
            <p class="bn-text">${esc(n.text)}</p>
            <div class="bn-date"><i class="fas fa-calendar-day"></i> ${n.dateFa}</div>
            <button class="btn btn-gold btn-lg bn-ok"><i class="fas fa-circle-check"></i> خواندم و متوجه شدم</button>
        </div>`;
    b.querySelector('.bn-ok').onclick = () => { ls.set('hs_big_seen_' + n.id, true); b.remove(); };
    document.body.appendChild(b);
}
function renderHome() {
    $('#contactGrid').innerHTML = (schoolPhones.length ? schoolPhones : DEFAULT_SCHOOL_PHONES).map(p => `
        <div class="contact-card">
            <span class="contact-role"><i class="fas ${p.icon || 'fa-phone'}"></i> ${esc(p.role)}</span>
            <div class="contact-name">${esc(p.name)}</div>
            <div class="contact-phone">${fa(p.phone)}</div>
            <div class="contact-btns">
                <a class="btn btn-call btn-sm" href="tel:${toIntl(p.phone)}"><i class="fas fa-phone"></i> تلفن</a>
                <a class="btn btn-blue btn-sm" href="sms:${toIntl(p.phone)}"><i class="fas fa-comment-sms"></i> پیامک</a>
            </div>
        </div>`).join('');
    // اطلاعیه‌های مدرسه
    const list = [...notices].sort((a, b) => b.at - a.at).slice(0, 5);
    const sec = $('#noticesSection');
    if (sec) sec.hidden = list.length === 0;
    const grid = $('#noticeGrid');
    if (grid) grid.innerHTML = list.map(n => `
        <div class="notice-card${n.big ? ' notice-big' : ''}">
            <div class="notice-title"><i class="fas ${n.big ? 'fa-bullhorn' : 'fa-scroll'}"></i> ${esc(n.title)}${n.big ? ' <span class="badge badge-warn">مهم</span>' : ''}</div>
            <div class="notice-text">${esc(n.text)}</div>
            <div class="notice-date"><i class="fas fa-calendar-day"></i> ${n.dateFa}</div>
        </div>`).join('');
}

/* ---------- ورود / ثبت‌نام دانش‌آموز ---------- */
let authTab = 'login';
let captchaCode = '';
let pendingOTP = null;   // {code, exp, data}

function openAuth(tab) {
    session.studentId ? show('student') : show('auth');
    setAuthTab(tab || 'login');
}
function setAuthTab(tab) {
    authTab = tab;
    $('#tabLoginBtn').classList.toggle('active', tab === 'login');
    $('#tabRegisterBtn').classList.toggle('active', tab === 'register');
    $('#loginForm').hidden = tab !== 'login';
    $('#regForm').hidden = tab !== 'register';
    $('#otpStep').hidden = true;
    $('#regSuccess').hidden = true;
    hideErr('#loginError'); hideErr('#regError'); hideErr('#otpError');
    if (tab === 'register') newCaptcha();
}
function newCaptcha() {
    captchaCode = String(Math.floor(10000 + Math.random() * 90000));
    $('#captchaCode').textContent = captchaCode;
    const inp = $('#captchaInput');
    if (inp) inp.value = '';
}

function submitRegister(e) {
    e.preventDefault();
    hideErr('#regError');
    const name = $('#regName').value.trim();
    const cls = $('#regClass').value;
    const mobile = normPhone($('#regMobile').value);
    const pass = $('#regPass').value;
    const parentName = $('#regParentName').value.trim();
    const parentPhone = normPhone($('#regParentPhone').value);
    const cap = toEn($('#captchaInput').value).replace(/\s/g, '');

    if (name.length < 3) return showErr('#regError', 'نام و نام خانوادگی را کامل وارد کنید.');
    if (!validPhone(mobile)) return showErr('#regError', 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
    if (pass.length < 4) return showErr('#regError', 'رمز عبور حداقل ۴ کاراکتر باشد — رمز ساده و قابل حدس انتخاب نکنید.');
    if (pass === mobile) return showErr('#regError', 'رمز عبور نباید همان شمارهٔ موبایل باشد — یک رمز دیگر انتخاب کنید.');
    if (students.some(s => s.mobile === mobile)) return showErr('#regError', 'این شماره موبایل قبلاً ثبت شده است. وارد شوید یا شمارهٔ دیگری بزنید.');
    if (!parentName) return showErr('#regError', 'نام اولیا را وارد کنید.');
    if (!validPhone(parentPhone)) return showErr('#regError', 'شماره موبایل اولیا باید ۱۱ رقم و با ۰۹ شروع شود.');
    if (cap !== captchaCode) { newCaptcha(); return showErr('#regError', 'کد امنیتی درست نیست — کد جدید داده شد، دوباره تایپ کنید.'); }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    pendingOTP = { code, exp: Date.now() + 5 * 60 * 1000, data: { name, cls, mobile, pass, parentName, parentPhone } };
    $('#otpPhoneText').textContent = fa(parentPhone);
    $('#demoOtpCode').textContent = fa(code);
    $('#otpInput').value = '';
    $('#regForm').hidden = true;
    $('#otpStep').hidden = false;
    toast('<i class="fas fa-comment-sms"></i> پیامک یک‌بارمصرف به اولیا ارسال شد.');
    setTimeout(() => $('#otpInput').focus(), 150);
}
function verifyOTP(e) {
    e.preventDefault();
    hideErr('#otpError');
    if (!pendingOTP) return showErr('#otpError', 'درخواستی یافت نشد — دوباره ثبت‌نام کنید.');
    if (Date.now() > pendingOTP.exp) return showErr('#otpError', 'کد منقضی شده است. دکمهٔ «ارسال دوباره» را بزنید.');
    if (toEn($('#otpInput').value).replace(/\s/g, '') !== pendingOTP.code)
        return showErr('#otpError', 'کد وارد شده درست نیست.');

    const st = { id: uid(), ...pendingOTP.data, merit: 20, at: Date.now() };
    students.push(st);
    saveStudents();
    const clsName = CLASS_LABEL[st.cls];
    pendingOTP = null;
    session.studentId = st.id;
    ls.set('hs_student', st.id);
    $('#otpStep').hidden = true;
    $('#successName').textContent = st.name;
    $('#successClass').textContent = clsName;
    $('#regSuccess').hidden = false;
    updateHeader();
}
function autoFillOTP() {
    if (pendingOTP) { const i = $('#otpInput'); if (i) i.value = pendingOTP.code; }
    if (pendingTOTP) { const i = $('#totpInput'); if (i) i.value = pendingTOTP.code; }
}
function resendOTP() {
    if (pendingOTP) {
        pendingOTP.code = String(Math.floor(100000 + Math.random() * 900000));
        pendingOTP.exp = Date.now() + 5 * 60 * 1000;
        $('#demoOtpCode').textContent = fa(pendingOTP.code);
        hideErr('#otpError');
    }
    if (pendingTOTP) {
        pendingTOTP.code = String(Math.floor(100000 + Math.random() * 900000));
        pendingTOTP.exp = Date.now() + 5 * 60 * 1000;
        const d = $('#demoTOtpCode'); if (d) d.textContent = fa(pendingTOTP.code);
        hideErr('#totpError');
    }
    toast('<i class="fas fa-comment-sms"></i> پیامک دوباره ارسال شد.');
}

function submitStudentLogin(e) {
    e.preventDefault();
    hideErr('#loginError');
    const u = $('#loginUser').value.trim();
    const p = $('#loginPass').value;
    const st = students.find(s => s.name === u || s.mobile === normPhone(u));
    if (!st) return showErr('#loginError', 'چنین دانش‌آموزی پیدا نشد. اول ثبت‌نام کنید.');
    if (!st.pass) return showErr('#loginError', 'برای حساب شما هنوز رمز شخصی ساخته نشده — از مدیر بخواهید در بخش «دانش‌آموزان» رمز برایتان بگذارد.');
    if (st.pass !== p) return showErr('#loginError', 'رمز عبور درست نیست.');
    session.studentId = st.id;
    ls.set('hs_student', st.id);
    updateHeader();
    show('student');
    toast('خوش آمدی ' + esc(st.name) + ' 👋');
}
function finishRegister() { show('student'); }
function logoutStudent() {
    session.studentId = null; ls.del('hs_student'); updateHeader(); show('home');
}

/* ---------- پنل دانش‌آموز ---------- */
function renderStudentPanel() {
    purgeOldAttendance();
    const s = studentById(session.studentId);
    if (!s) { logoutStudent(); return; }
    $('#studentPanelSub').textContent = CLASS_LABEL[s.cls] + ' — دبیرستان شهید حسین اشرفی';
    const myAtt = attendance.filter(a => a.studentId === s.id).sort((a, b) => b.dkey.localeCompare(a.dkey));
    const myDis = discipline.filter(d => d.studentId === s.id);
    const myGr = grades.filter(g => g.studentId === s.id).sort((a, b) => b.at - a.at);
    const avg = myGr.length ? (myGr.reduce((x, g) => x + g.score, 0) / myGr.length) : null;
    const merit = s.merit ?? 20;
    const notices3 = [...notices].sort((a, b) => b.at - a.at).slice(0, 3);
    $('#studentBody').innerHTML = `
        <div class="stat-grid">
            <div class="stat-card"><div class="stat-ic" style="background:linear-gradient(135deg,#3b82f6,#2563eb)"><i class="fas fa-door-open"></i></div><div><b>${fa(myAtt.filter(a => a.status === 'present').length)}</b><span>روز حاضر</span></div></div>
            <div class="stat-card"><div class="stat-ic" style="background:linear-gradient(135deg,#ef4444,#dc2626)"><i class="fas fa-user-clock"></i></div><div><b>${fa(myAtt.filter(a => a.status === 'absent').length)}</b><span>روز غایب</span></div></div>
            <div class="stat-card"><div class="stat-ic" style="background:linear-gradient(135deg,#059669,#047857)"><i class="fas fa-star"></i></div><div><b>${avg !== null ? fa(avg.toFixed(1)) : '—'}</b><span>میانگین نمرات</span></div></div>
            <div class="stat-card"><div class="stat-ic" style="background:linear-gradient(135deg,${merit >= 15 ? '#16a34a,#15803d' : merit >= 10 ? '#f59e0b,#b45309' : '#ef4444,#dc2626'})"><i class="fas fa-shield-halved"></i></div><div><b>${fa(merit)}</b><span>نمرهٔ انضباط (از ۲۰)</span></div></div>
        </div>
        <div class="row-card" style="margin-bottom:16px">
            <div class="row-main">
                <div class="row-title">${esc(s.name)} <span class="badge badge-info">${CLASS_LABEL[s.cls]}</span></div>
                <div class="row-meta">موبایل: <b dir="ltr">${fa(s.mobile)}</b> — اولیا: ${esc(s.parentName)} (<span dir="ltr">${fa(s.parentPhone)}</span>)${s.pass ? ' — رمز شخصی: <span style="color:var(--ok)">✓</span>' : ' — <span style="color:var(--danger);font-weight:700">رمز شخصی ندارید! از «ویرایش اطلاعات من» بسازید</span>'}</div>
            </div>
            <div class="row-actions">
                <button class="btn btn-outline-dark btn-sm" onclick="openStudentEdit('${s.id}')"><i class="fas fa-pen"></i> ویرایش اطلاعات من</button>
                <button class="btn btn-gold btn-sm" onclick="printReport('${s.id}')"><i class="fas fa-print"></i> چاپ کارنامه</button>
                <button class="btn btn-blue btn-sm" onclick="exportReport('${s.id}','xls')"><i class="fas fa-file-excel"></i> اکسل</button>
                <button class="btn btn-ghost btn-sm" onclick="exportReport('${s.id}','csv')"><i class="fas fa-file-csv"></i> CSV</button>
            </div>
        </div>
        ${notices3.length ? `<h4 style="margin:0 0 10px"><i class="fas fa-bullhorn"></i> اطلاعیه‌های مدرسه</h4>
        <div class="rows" style="margin-bottom:16px">${notices3.map(n => `
            <div class="row-card"><div class="row-main"><div class="row-title">${esc(n.title)}</div><div class="row-meta">${esc(n.text)}</div></div></div>`).join('')}</div>` : ''}
        <h4 style="margin:18px 0 10px"><i class="fas fa-star"></i> کارنامه — نمرات من</h4>
        <div class="history">${myGr.length ? myGr.map(g => `
            <div class="h-item">
                <span class="h-date">${esc(g.subject)}</span>
                <span class="badge ${g.score >= 17 ? 'badge-ok' : g.score >= 10 ? 'badge-info' : 'badge-danger'}">نمره: ${fa(g.score)}</span>
                ${g.note ? `<span class="h-times">${esc(g.note)}</span>` : ''}
                <span class="h-times">${g.dateFa} — ثبت: ${esc(g.by || '')}</span>
            </div>`).join('') : '<div class="empty-state"><i class="fas fa-inbox"></i><p>هنوز نمره‌ای ثبت نشده است.</p></div>'}
        </div>
        <h4 style="margin:18px 0 10px"><i class="fas fa-clock-rotate-left"></i> حضور و غیاب من <span style="font-size:.72rem;color:var(--muted);font-weight:400">(سابقهٔ ۲ روز اخیر — قدیمی‌ترها خودکار پاک می‌شود)</span></h4>
        <div class="history">${myAtt.length ? myAtt.map(a => `
            <div class="h-item">
                <span class="h-date">${a.dateFa}</span>
                <span class="badge ${a.status === 'present' ? 'badge-ok' : 'badge-danger'}">${a.status === 'present' ? 'حاضر' : 'غایب'}</span>
                ${a.status === 'present' ? `<span class="h-times">ورود: ${a.cameAt ? fa(a.cameAt) : '—'} — خروج: ${a.leftAt ? fa(a.leftAt) : '—'}</span>` : ''}
                ${a.reason ? `<span class="h-reason">علت غیبت: ${esc(a.reason)}</span>` : ''}
            </div>`).join('') : '<div class="empty-state"><i class="fas fa-inbox"></i><p>هنوز سابقه‌ای ثبت نشده است.</p></div>'}
        </div>
        <h4 style="margin:18px 0 10px"><i class="fas fa-triangle-exclamation"></i> موارد انضباطی من</h4>
        <div class="history">${myDis.length ? myDis.map(d => `
            <div class="h-item"><span class="h-date">${d.dateFa}</span><span>${esc(d.note)}</span></div>`).join('') : '<div class="empty-state"><i class="fas fa-inbox"></i><p>موردی ثبت نشده است. آفرین! 👏</p></div>'}
        </div>`;
}

/* ---------- ورود مدیر/معاون ---------- */
function openAdminLogin() {
    if (session.admin) { show('admin'); renderAdminTab(); return; }
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-user-shield"></i> ورود مدیر و معاون</h3>
        <p style="font-size:.85rem;color:var(--muted)">این بخش فقط برای مدیر و معاون مدرسه است — ورود با رمز عبور.</p>
        <form onsubmit="submitAdminLogin(event)">
            <label class="form-label">سمت شما
                <select class="form-select" id="admRole">
                    <option value="مدیر">مدیر مدرسه</option>
                    <option value="معاون">معاون مدرسه</option>
                </select>
            </label>
            <label class="form-label">رمز عبور
                <span class="pass-wrap">
                    <input class="form-input" id="admPass" type="password" required placeholder="رمز بخش مدیر و معاون">
                    <button type="button" class="eye-btn" onclick="togglePass('admPass',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                </span>
            </label>
            <div class="form-error" id="admError" hidden></div>
            <button class="btn btn-gold btn-block btn-lg" style="margin-top:20px" type="submit"><i class="fas fa-right-to-bracket"></i> ورود به پنل مدیریت</button>
        </form>
        <p style="font-size:.75rem;color:var(--muted);margin-top:14px"><i class="fas fa-circle-info"></i> معاون با همان رمز وارد می‌شود، اما فقط بخش‌هایی را می‌بیند که مدیر اجازه داده — اجازه‌ها در تب «دسترسی معاون» تنظیم می‌شود.</p>`);
}
function submitAdminLogin(e) {
    e.preventDefault();
    if (!checkAdminPass($('#admPass').value)) return showErr('#admError', 'رمز عبور درست نیست.');
    session.admin = $('#admRole').value;
    ls.set('hs_admin', session.admin);
    closeModal();
    updateHeader();
    show('admin');
    toast('خوش آمدید، ' + session.admin + ' گرامی.');
}
function logoutAdmin() {
    session.admin = null; ls.del('hs_admin'); updateHeader(); show('home');
    toast('از پنل مدیریت خارج شدید.');
}

/* ---------- ورود / ثبت‌نام استادها ---------- */
let pendingTOTP = null;   // {code, exp, data}

function openTeacherLogin() {
    if (session.teacherId) { show('teacher'); renderTeacher(); return; }
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-chalkboard-user"></i> ورود ${STAD}ها</h3>
        <p style="font-size:.85rem;color:var(--muted)">ورود با نام و رمز عبور شخصی. بار اول ${STAD} جدید ثبت‌نام کنید.</p>
        <form onsubmit="submitTeacherLogin(event)">
            <label class="form-label">نام و نام خانوادگی (یا شماره موبایل)
                <input class="form-input" id="teaUser" required placeholder="مثلاً: استاد غفوری">
            </label>
            <label class="form-label">رمز عبور شخصی
                <span class="pass-wrap">
                    <input class="form-input" id="teaPass" type="password" required placeholder="رمزی که هنگام ثبت‌نام انتخاب کردید">
                    <button type="button" class="eye-btn" onclick="togglePass('teaPass',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                </span>
            </label>
            <div class="form-error" id="teaError" hidden></div>
            <button class="btn btn-green btn-block btn-lg" style="margin-top:20px" type="submit"><i class="fas fa-right-to-bracket"></i> ورود به پنل</button>
        </form>
        <div class="divider"></div>
        <button class="btn btn-outline-dark btn-block" onclick="openTeacherReg()"><i class="fas fa-user-plus"></i> ${STAD} جدید هستید؟ ثبت‌نام کنید</button>`);
}
function submitTeacherLogin(e) {
    e.preventDefault();
    hideErr('#teaError');
    const u = $('#teaUser').value.trim();
    const p = $('#teaPass').value;
    const t = teachers.find(x => x.name === u || x.phone === normPhone(u));
    if (!t) return showErr('#teaError', 'چنین ' + STAD_PLAIN + '‌ای ثبت نشده است — اول ثبت‌نام کنید.');
    if (t.pass !== p) return showErr('#teaError', 'رمز عبور شخصی درست نیست.');
    session.teacherId = t.id;
    ls.set('hs_teacher', t.id);
    closeModal();
    updateHeader();
    show('teacher');
    toast('خوش آمدید ' + STAD_PLAIN + ' ' + esc(t.name) + '.');
}
function logoutTeacher() {
    session.teacherId = null; ls.del('hs_teacher'); updateHeader(); show('home');
}

/* --- ثبت‌نام استاد: مشخصات + کلاس‌ها/درس‌ها + OTP + رمز شخصی --- */
function openTeacherReg() {
    const clsRows = CLASSES.map(c => `
        <div class="check-line">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" id="tc_${c}" onchange="toggleTCls('${c}',this.checked)">
                <b>${CLASS_LABEL[c]}</b>
            </label>
            <select class="form-select" id="tsub_${c}" hidden style="margin-top:8px">
                ${subjectsOf(c).map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
        </div>`).join('');
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-user-plus"></i> ثبت‌نام ${STAD} جدید</h3>
        <p style="font-size:.85rem;color:var(--muted)">نام و شمارهٔ موبایل خود را وارد کنید، کلاس‌ها و درسی که در هر کلاس می‌دهید را تیک بزنید، یک رمز شخصی انتخاب کنید و کد پیامکی را تأیید کنید.</p>
        <form onsubmit="submitTeacherReg(event)">
            <label class="form-label">نام و نام خانوادگی<input class="form-input" id="trName" required placeholder="مثلاً: استاد غفوری"></label>
            <div class="form-row">
                <label class="form-label">شماره موبایل شما<input class="form-input" id="trPhone" required dir="ltr" placeholder="09xxxxxxxxx"></label>
                <label class="form-label">رمز عبور شخصی (برای ورودهای بعدی)
                <span class="pass-wrap">
                    <input class="form-input" id="trPass" required type="password" placeholder="حداقل ۴ کاراکتر">
                    <button type="button" class="eye-btn" onclick="togglePass('trPass',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                </span>
            </label>
            </div>
            <div class="form-label" style="margin-top:16px">برای چه کلاس‌هایی درس می‌دهید؟ (برای هر کلاس، درسش را انتخاب کنید)</div>
            <div class="check-grid">${clsRows}</div>
            <div class="form-error" id="trError" hidden></div>
            <button class="btn btn-green btn-block btn-lg" style="margin-top:18px" type="submit"><i class="fas fa-paper-plane"></i> ارسال رمز یک‌بارمصرف به موبایل من</button>
        </form>`);
}
function toggleTCls(c, on) { const sel = $('#tsub_' + c); if (sel) sel.hidden = !on; }
function submitTeacherReg(e) {
    e.preventDefault();
    hideErr('#trError');
    const name = $('#trName').value.trim();
    const phone = normPhone($('#trPhone').value);
    const pass = $('#trPass').value;
    const cls = {};
    CLASSES.forEach(c => {
        if ($('#tc_' + c) && $('#tc_' + c).checked) cls[c] = $('#tsub_' + c).value;
    });
    if (name.length < 3) return showErr('#trError', 'نام را کامل وارد کنید.');
    if (!validPhone(phone)) return showErr('#trError', 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
    if (teachers.some(t => t.phone === phone)) return showErr('#trError', 'این شماره قبلاً ثبت شده است — وارد شوید.');
    if (pass.length < 4) return showErr('#trError', 'رمز عبور شخصی حداقل ۴ کاراکتر باشد.');
    if (!Object.keys(cls).length) return showErr('#trError', 'حداقل یک کلاس را تیک بزنید.');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pendingTOTP = { code, exp: Date.now() + 5 * 60 * 1000, data: { name, phone, pass, cls } };
    $('#otpPhoneText').textContent = fa(phone);
    $('#demoTOtpCode') && ($('#demoTOtpCode').textContent = fa(code));
    $('#totpInput') && ($('#totpInput').value = '');
    $('#modalBox').innerHTML = `
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-comment-sms"></i> رمز یک‌بارمصرف</h3>
        <p style="font-size:.88rem;color:var(--muted)">کد تأیید به موبایل شما <b dir="ltr">${fa(phone)}</b> ارسال شد.</p>
        <div class="sms-sim">
            <span class="sms-sim-tag">حالت دمو — پیامک شبیه‌سازی شده</span>
            <div class="sms-sim-head"><i class="fas fa-comment-sms"></i> پیامک ورودی از 50004262</div>
            <div class="sms-bubble">دبیرستان شهید حسین اشرفی | کد تأیید ثبت‌نام شما: <b id="demoTOtpCode" dir="ltr">${fa(code)}</b><br>این کد را در اختیار دیگران قرار ندهید.</div>
        </div>
        <form onsubmit="verifyTeacherOTP(event)">
            <label class="form-label">کد تأیید ۶ رقمی
                <input class="form-input" id="totpInput" required dir="ltr" maxlength="6" placeholder="- - - - - -" style="text-align:center;font-size:1.4rem;letter-spacing:10px;font-weight:800">
            </label>
            <div class="form-error" id="totpError" hidden></div>
            <button class="btn btn-green btn-block btn-lg" type="submit"><i class="fas fa-circle-check"></i> تأیید و اتمام ثبت‌نام</button>
        </form>
        <div class="modal-actions" style="margin-top:14px">
            <button type="button" class="btn btn-ghost btn-sm" onclick="autoFillOTP()"><i class="fas fa-wand-magic-sparkles"></i> پر کردن خودکار کد (دمو)</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="resendOTP()"><i class="fas fa-rotate-right"></i> ارسال دوبارهٔ پیامک</button>
        </div>`;
}
function verifyTeacherOTP(e) {
    e.preventDefault();
    hideErr('#totpError');
    if (!pendingTOTP) return showErr('#totpError', 'درخواستی یافت نشد — دوباره ثبت‌نام کنید.');
    if (Date.now() > pendingTOTP.exp) return showErr('#totpError', 'کد منقضی شده — «ارسال دوباره» را بزنید.');
    if (toEn($('#totpInput').value).replace(/\s/g, '') !== pendingTOTP.code)
        return showErr('#totpError', 'کد وارد شده درست نیست.');
    const t = { id: uid(), ...pendingTOTP.data, at: Date.now() };
    teachers.push(t);
    saveTeachers();
    pendingTOTP = null;
    session.teacherId = t.id;
    ls.set('hs_teacher', t.id);
    closeModal();
    updateHeader();
    show('teacher');
    toast('ثبت‌نام کامل شد — خوش آمدید ' + STAD_PLAIN + ' ' + esc(t.name) + ' 🎉');
}

/* ---------- پنل مدیر: تب‌ها ---------- */
let adminTab = 'dash';
let adminClsFilter = 'all';
let adminAbsQ = '';
let adminStuQ = '';
let parentsQ = '';

function setAdminTab(tab) {
    adminTab = tab;
    $$('#adminTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    ['dash','parents','absents','students','teachers','perms','settings'].forEach(t => {
        const el = $('#adminTab-' + t); if (el) el.hidden = t !== tab;
    });
    renderAdminTab();
}
function renderAdminTab() {
    if (!session.admin) return;
    if (adminTab === 'dash') renderAdminDash();
    if (adminTab === 'parents') renderParents();
    if (adminTab === 'absents') renderAbsents();
    if (adminTab === 'students') renderAdminStudents();
    if (adminTab === 'teachers') renderAdminTeachers();
    if (adminTab === 'perms') renderVicePerms();
    if (adminTab === 'settings') renderAdminSettings();
}

/* --- داشبورد --- */
function studentAvg(sid) {
    const g = grades.filter(x => x.studentId === sid);
    return g.length ? g.reduce((s, x) => s + x.score, 0) / g.length : null;
}
function renderAdminDash() {
    purgeOldAttendance();
    const today = dateKey();
    const absentToday = attendance.filter(a => a.dkey === today && a.status === 'absent').length;
    const presentToday = attendance.filter(a => a.dkey === today && a.status === 'present').length;
    // برترین‌ها بر اساس میانگین نمرات
    const ranked = students.map(s => ({ s, avg: studentAvg(s.id) }))
        .filter(x => x.avg !== null).sort((a, b) => b.avg - a.avg).slice(0, 5);
    $('#adminTab-dash').innerHTML = `
        <div class="stat-grid">
            <div class="stat-card"><div class="stat-ic" style="background:linear-gradient(135deg,#3b82f6,#2563eb)"><i class="fas fa-users"></i></div><div><b>${fa(students.length)}</b><span>دانش‌آموز ثبت‌نام‌شده</span></div></div>
            <div class="stat-card"><div class="stat-ic" style="background:linear-gradient(135deg,#0d9488,#0f766e)"><i class="fas fa-address-book"></i></div><div><b>${fa(allParents().length)}</b><span>شمارهٔ اولیا</span></div></div>
            <div class="stat-card"><div class="stat-ic" style="background:linear-gradient(135deg,#ef4444,#dc2626)"><i class="fas fa-user-clock"></i></div><div><b>${fa(absentToday)}</b><span>غایب امروز</span></div></div>
            <div class="stat-card"><div class="stat-ic" style="background:linear-gradient(135deg,#7c3aed,#6d28d9)"><i class="fas fa-chalkboard-user"></i></div><div><b>${fa(teachers.length)}</b><span>${STAD_PLAIN} ثبت‌نام‌شده</span></div></div>
        </div>
        <div class="row-card" style="margin-bottom:14px">
            <div class="row-main">
                <div class="row-title"><i class="fas fa-calendar-day" style="color:var(--g600)"></i> ${faDate()}</div>
                <div class="row-meta">امروز ${fa(presentToday)} دانش‌آموز حاضر و ${fa(absentToday)} نفر غایب ثبت شده است.</div>
            </div>
            <div class="row-actions">
                <button class="btn btn-outline-dark btn-sm" onclick="setAdminTab('absents')"><i class="fas fa-user-clock"></i> ثبت غیبت</button>
                <button class="btn btn-outline-dark btn-sm" onclick="setAdminTab('students')"><i class="fas fa-users"></i> حضور و غیاب</button>
            </div>
        </div>
        ${ranked.length ? `
        <h4 style="margin:20px 0 10px"><i class="fas fa-trophy" style="color:var(--gold)"></i> برترین‌ها (میانگین نمرات)</h4>
        <div class="rows">${ranked.map((x, i) => `
            <div class="row-card">
                <div class="row-main">
                    <div class="row-title"><span class="badge badge-gold">${['🥇', '🥈', '🥉', '۴', '۵'][i]}</span> ${esc(x.s.name)}
                        <span class="badge badge-info">${CLASS_LABEL[x.s.cls]}</span>
                    </div>
                </div>
                <div class="row-actions"><span class="badge badge-ok">میانگین: ${fa(x.avg.toFixed(1))}</span></div>
            </div>`).join('')}</div>` : ''}`;
}

/* --- تب اولیا (با جستجو و حذف) --- */
function renderParents() {
    const canEdit = can('parents');
    $('#adminTab-parents').innerHTML = `
        <p class="tab-sub">شمارهٔ اولیا با ثبت‌نام هر دانش‌آموز به‌صورت خودکار اینجا ثبت می‌شود. می‌توانید جستجو کنید، ویرایش کنید یا حذف کنید. کنار هر شماره دکمهٔ <b>پیامک</b> و <b>تلفن</b> هست.</p>
        <div class="toolbar">
            <div class="search-box"><i class="fas fa-magnifying-glass"></i>
                <input id="parSearch" placeholder="جستجو: اسم دانش‌آموز، اولیا یا شماره…" value="${esc(parentsQ)}" oninput="parentsQ=this.value; renderParentsList()">
            </div>
            ${canEdit ? `<button class="btn btn-gold btn-sm" onclick="openParentAdd()"><i class="fas fa-plus"></i> افزودن شمارهٔ اولیا</button>` : ''}
        </div>
        <div id="parList"></div>`;
    renderParentsList();
    if ($('#gmChips')) renderGroupMsgHistory();
}
function renderParentsList() {
    const q = parentsQ.trim();
    const list = allParents()
        .filter(p => !q || (p.studentName || '').includes(q) || (p.parentName || '').includes(q) || p.phone.includes(normPhone(q)))
        .sort((a, b) => (a.studentName || '').localeCompare(b.studentName || '', 'fa'));
    const el = $('#parList');
    if (!el) return;
    el.innerHTML = list.length ? `<div class="rows">${list.map(p => `
        <div class="row-card">
            <div class="row-main">
                <div class="row-title">${esc(p.studentName)}
                    <span class="badge badge-gold">ولی: ${esc(p.parentName)}</span>
                    ${p.cls ? `<span class="badge badge-info">${CLASS_LABEL[p.cls]}</span>` : ''}
                    <span class="badge ${p.src === 'student' ? 'badge-ok' : 'badge-warn'}">${p.src === 'student' ? 'ثبت خودکار' : 'ثبت دستی'}</span>
                </div>
                <div class="row-meta"><span dir="ltr" style="font-weight:800;font-size:.95rem">${fa(p.phone)}</span></div>
            </div>
            <div class="row-actions">
                <a class="btn btn-blue btn-sm" href="sms:${toIntl(p.phone)}"><i class="fas fa-comment-sms"></i> پیامک</a>
                <a class="btn btn-call btn-sm" href="tel:${toIntl(p.phone)}"><i class="fas fa-phone"></i> تلفن</a>
                ${can('parents') ? `<button class="btn btn-ghost btn-sm" onclick="openParentEdit('${p.src}','${p.id}')"><i class="fas fa-pen"></i> ویرایش</button>
                <button class="btn btn-del btn-sm" onclick="deleteParent('${p.src}','${p.id}',this)"><i class="fas fa-trash"></i> حذف</button>` : ''}
            </div>
        </div>`).join('')}</div>` : '<div class="empty-state"><i class="fas fa-address-book"></i><p>چیزی پیدا نشد.</p></div>';
}
function deleteParent(src, id, btn) {
    if (!can('parents')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید — مدیر اجازهٔ حذف اولیا را نداده است.');
    if (!confirmBtn(btn, src === 'student' ? 'حذف دانش‌آموز؟' : 'حذف شود؟')) return;
    if (src === 'student') { deleteStudentById(id); renderParentsList(); }
    else {
        parentsExtra = parentsExtra.filter(p => p.id !== id);
        saveExtra();
        renderParentsList();
        toast('<i class="fas fa-trash"></i> شمارهٔ اولیا حذف شد.');
    }
}
function openParentAdd() {
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-plus"></i> افزودن شمارهٔ اولیا</h3>
        <form onsubmit="submitParentAdd(event)">
            <label class="form-label">نام دانش‌آموز<input class="form-input" id="paStudent" required placeholder="مثلاً: امیرعلی محمدنیازی"></label>
            <label class="form-label">نام اولیا<input class="form-input" id="paName" required placeholder="مثلاً: رضا محمدنیازی"></label>
            <label class="form-label">شماره موبایل اولیا<input class="form-input" id="paPhone" required dir="ltr" placeholder="09xxxxxxxxx"></label>
            <div class="form-error" id="paError" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:18px" type="submit"><i class="fas fa-floppy-disk"></i> ذخیره</button>
        </form>`);
}
function submitParentAdd(e) {
    e.preventDefault();
    const phone = normPhone($('#paPhone').value);
    if (!validPhone(phone)) return showErr('#paError', 'شماره باید ۱۱ رقم و با ۰۹ شروع شود.');
    parentsExtra.push({ id: uid(), studentName: $('#paStudent').value.trim(), parentName: $('#paName').value.trim(), phone });
    saveExtra();
    closeModal();
    renderParentsList();
    toast('<i class="fas fa-circle-check"></i> شمارهٔ اولیا اضافه شد.');
}
function openParentEdit(src, id) {
    if (src === 'extra') {
        const p = parentsExtra.find(x => x.id === id);
        if (!p) return;
        openModal(`
            <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
            <h3 class="modal-title"><i class="fas fa-pen"></i> ویرایش اولیا</h3>
            <form onsubmit="submitParentEdit(event,'${id}')">
                <label class="form-label">نام دانش‌آموز<input class="form-input" id="peStudent" required value="${esc(p.studentName)}"></label>
                <label class="form-label">نام اولیا<input class="form-input" id="peName" required value="${esc(p.parentName)}"></label>
                <label class="form-label">شماره موبایل اولیا<input class="form-input" id="pePhone" required dir="ltr" value="${p.phone}"></label>
                <div class="form-error" id="peError" hidden></div>
                <button class="btn btn-gold btn-block" style="margin-top:18px" type="submit"><i class="fas fa-floppy-disk"></i> ذخیرهٔ تغییرات</button>
            </form>`);
    } else {
        openStudentEdit(id);
    }
}
function submitParentEdit(e, id) {
    e.preventDefault();
    const p = parentsExtra.find(x => x.id === id);
    if (!p) return;
    const phone = normPhone($('#pePhone').value);
    if (!validPhone(phone)) return showErr('#peError', 'شماره باید ۱۱ رقم و با ۰۹ شروع شود.');
    p.studentName = $('#peStudent').value.trim();
    p.parentName = $('#peName').value.trim();
    p.phone = phone;
    saveExtra();
    closeModal();
    renderParentsList();
    toast('<i class="fas fa-circle-check"></i> ویرایش شد.');
}

/* --- تب غایبین (با جستجو) --- */
function renderAbsents() {
    $('#adminTab-absents').innerHTML = `
        <p class="tab-sub">اسم غایبین را وارد کنید و کنار هر اسم برای اولیایش جای نوشتن هست. رکوردهای حاضر و غایب بعد از ۲ روز خودکار پاک می‌شوند؛ موارد انضباطی می‌مانند.</p>
        <div class="toolbar">
            <div class="search-box"><i class="fas fa-magnifying-glass"></i>
                <input id="absSearch" placeholder="جستجوی اسم دانش‌آموز…" value="${esc(adminAbsQ)}" oninput="adminAbsQ=this.value; renderAbsentsList()">
            </div>
            <button class="btn btn-gold btn-sm" onclick="openAbsentAdd()"><i class="fas fa-plus"></i> ثبت غیبت جدید</button>
        </div>
        <div id="absList"></div>`;
    renderAbsentsList();
}
function renderAbsentsList() {
    purgeOldAttendance();
    const list = attendance
        .filter(a => a.status === 'absent')
        .filter(a => !adminAbsQ || (studentById(a.studentId)?.name || '').includes(adminAbsQ))
        .sort((a, b) => b.dkey.localeCompare(a.dkey) || (b.at || 0) - (a.at || 0));
    const el = $('#absList');
    if (!el) return;
    el.innerHTML = list.length ? `<div class="rows">${list.map(a => {
        const s = studentById(a.studentId);
        const body = encodeURIComponent(`دبیرستان شهید حسین اشرفی: فرزند شما ${s ? s.name : ''} در تاریخ ${a.dateFa} در مدرسه غایب بوده است. لطفاً تماس بگیرید. ${a.note || ''}`);
        return `
        <div class="row-card">
            <div class="row-main">
                <div class="row-title">${esc(s ? s.name : 'دانش‌آموز')}
                    ${s ? `<span class="badge badge-info">${CLASS_LABEL[s.cls]}</span>` : ''}
                    <span class="badge badge-danger"><i class="fas fa-user-clock"></i> غایب</span>
                    <span class="badge badge-gold">${a.dateFa}</span>
                </div>
                <div class="row-meta">${a.reason ? 'علت غیبت: ' + esc(a.reason) + ' — ' : ''}${s ? 'ولی: ' + esc(s.parentName) + ' — <span dir="ltr">' + fa(s.parentPhone) + '</span>' : ''}</div>
                <textarea class="note-input note-box" rows="2" placeholder="یادداشت برای اولیا (دربارهٔ غیبت فرزندشان بنویسید)…" onchange="saveAbsentNote('${a.id}', this.value)">${esc(a.note || '')}</textarea>
            </div>
            <div class="row-actions">
                ${s ? `<a class="btn btn-blue btn-sm" href="sms:${toIntl(s.parentPhone)}?body=${body}"><i class="fas fa-comment-sms"></i> پیامک</a>
                <a class="btn btn-call btn-sm" href="tel:${toIntl(s.parentPhone)}"><i class="fas fa-phone"></i> تلفن</a>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="resolveAbsent('${a.id}')"><i class="fas fa-user-check"></i> حاضر شد</button>
                <button class="btn btn-del btn-sm" onclick="deleteAttendance('${a.id}',this)"><i class="fas fa-trash"></i> حذف</button>
            </div>
        </div>`;
    }).join('')}</div>` : '<div class="empty-state"><i class="fas fa-user-clock"></i><p>غایبی ثبت نشده است — یا اسمی که سرچ کردید پیدا نشد.</p></div>';
}
function saveAbsentNote(id, val) {
    const a = attendance.find(x => x.id === id);
    if (!a) return;
    a.note = val.trim();
    saveAttendance();
    toast('<i class="fas fa-floppy-disk"></i> یادداشت ذخیره شد.');
}
function resolveAbsent(id) {
    const a = attendance.find(x => x.id === id);
    if (!a) return;
    a.status = 'present';
    a.cameAt = faTime();
    a.reason = '';
    saveAttendance();
    renderAbsentsList();
    renderAdminDash();
    toast('<i class="fas fa-user-check"></i> ورود دانش‌آموز ثبت شد (ساعت ' + a.cameAt + ').');
}
function openAbsentAdd() {
    const opts = CLASSES.map(c => {
        const kids = students.filter(s => s.cls === c);
        if (!kids.length) return '';
        return `<optgroup label="${CLASS_LABEL[c]}">` + kids.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') + '</optgroup>';
    }).join('');
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-user-clock"></i> ثبت غیبت جدید</h3>
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:14px">تاریخ ثبت: <b>${faDate()}</b></p>
        <form onsubmit="submitAbsentAdd(event)">
            <label class="form-label">دانش‌آموز
                <select class="form-select" id="aaStudent" required>${opts || '<option value="">اول دانش‌آموز ثبت‌نام کنید</option>'}</select>
            </label>
            <label class="form-label">علت غیبت<input class="form-input" id="aaReason" placeholder="مثلاً: مریض، مسافرت، بدون اطلاع…"></label>
            <div class="form-error" id="aaError" hidden></div>
            <button class="btn btn-danger btn-block" style="margin-top:18px" type="submit"><i class="fas fa-user-clock"></i> ثبت غیبت</button>
        </form>`);
}
function submitAbsentAdd(e) {
    e.preventDefault();
    const sid = $('#aaStudent').value;
    if (!studentById(sid)) return showErr('#aaError', 'اول دانش‌آموز را ثبت‌نام کنید.');
    attendance.push({
        id: uid(), studentId: sid, dkey: dateKey(), day: faDay(), dateFa: faDate(),
        status: 'absent', cameAt: null, leftAt: null,
        reason: $('#aaReason').value.trim(), note: '', by: sessionLabel(), at: Date.now()
    });
    saveAttendance();
    closeModal();
    renderAbsentsList();
    renderAdminDash();
    toast('<i class="fas fa-user-clock"></i> غیبت ثبت شد.');
}

/* --- تب دانش‌آموزان (با جستجو) --- */
function renderAdminStudents() {
    $('#adminTab-students').innerHTML = `
        <p class="tab-sub">روی هر دانش‌آموز بزنید: همهٔ اطلاعات، نمرات، نمرهٔ انضباط، حضور و غیاب، موارد انضباطی، ویرایش و حذف.</p>
        <div class="toolbar">
            <div class="search-box"><i class="fas fa-magnifying-glass"></i>
                <input id="stuSearch" placeholder="جستجوی اسم یا شماره موبایل…" value="${esc(adminStuQ)}" oninput="adminStuQ=this.value; renderAdminStudentsList()">
            </div>
${can('addStudent') ? `
    <button class="btn btn-gold btn-sm" onclick="openStudentAdd()"><i class="fas fa-user-plus"></i> افزودن دانش‌آموز جدید</button>
    <button class="btn btn-blue btn-sm" onclick="openExcelUpload()"><i class="fas fa-file-excel"></i> آپلود اکسل دانش‌آموزان</button>
` : ''}
        </div>
        <div class="toolbar"><div class="chip-row" id="stuChips"></div></div>
        <div class="students-grid" id="stuGrid"></div>`;
    renderAdminStudentsList();
}
/* --- افزودن دانش‌آموز توسط مدیر/معاون (بدون کپچا و OTP — فقط مدیر و معاون) --- */
function openStudentAdd() {
    if (!can('addStudent')) return toast('<i class="fas fa-lock"></i> مدیر اجازهٔ عضوکردن دانش‌آموز را نداده است.');
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-user-plus"></i> عضو کردن دانش‌آموز جدید</h3>
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:4px">ثبت‌نام دستی ${session.admin} — بدون کپچا و تأیید پیامکی.</p>
        <form onsubmit="submitStudentAdd(event)">
            <label class="form-label">نام و نام خانوادگی<input class="form-input" id="saName" required placeholder="مثلاً: امیرعلی محمدنیازی"></label>
            <div class="form-row">
                <label class="form-label">کلاس
                    <select class="form-select" id="saCls">${CLASSES.map(c => `<option value="${c}">${CLASS_LABEL[c]}</option>`).join('')}</select>
                </label>
                <label class="form-label">رمز عبور شخصی (حداقل ۴ کاراکتر)
                    <span class="pass-wrap">
                        <input class="form-input" id="saPass" required type="password" placeholder="حداقل ۴ کاراکتر">
                        <button type="button" class="eye-btn" onclick="togglePass('saPass',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                    </span>
                </label>
            </div>
            <div class="form-row">
                <label class="form-label">شماره موبایل دانش‌آموز<input class="form-input" id="saMobile" required dir="ltr" placeholder="09xxxxxxxxx"></label>
                <label class="form-label">موبایل اولیا (اختیاری)<input class="form-input" id="saParentPhone" dir="ltr" placeholder="09xxxxxxxxx"></label>
            </div>
            <label class="form-label">نام اولیا<input class="form-input" id="saParentName" required placeholder="مثلاً: رضا محمدنیازی"></label>
            <div class="form-error" id="saError" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:16px" type="submit"><i class="fas fa-user-plus"></i> ثبت و عضوکردن</button>
        </form>`);
}
function submitStudentAdd(e) {
    e.preventDefault();
    if (!can('addStudent')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید.');
    const name = $('#saName').value.trim();
    const cls = $('#saCls').value;
    const mobile = normPhone($('#saMobile').value);
    const pass = $('#saPass').value;
    const parentName = $('#saParentName').value.trim();
    const parentPhone = normPhone($('#saParentPhone').value);
    if (name.length < 3) return showErr('#saError', 'نام را کامل وارد کنید.');
    if (students.some(s => s.mobile === mobile)) return showErr('#saError', 'این شماره موبایل قبلاً ثبت شده است.');
    if (!validPhone(mobile)) return showErr('#saError', 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
    if (students.some(s => s.mobile === mobile)) return showErr('#saError', 'این شماره قبلاً ثبت شده است.');
    if (pass.length < 4) return showErr('#saError', 'رمز حداقل ۴ کاراکتر باشد.');
    if (pass === mobile) return showErr('#saError', 'رمز نباید همان شمارهٔ موبایل باشد.');
    if (!parentName) return showErr('#saError', 'نام اولیا را وارد کنید.');
    if (parentPhone && !validPhone(parentPhone)) return showErr('#saError', 'شماره اولیا نامعتبر است.');
    const st = { id: uid(), name, cls, mobile, parentName, parentPhone: parentPhone || mobile, pass, merit: 20, at: Date.now() };
    students.push(st);
    saveStudents();
    closeModal();
    renderAdminStudents();
    if (adminTab === 'students') renderAdminTab();
    refreshAfterAttendance();
    toast('<i class="fas fa-user-plus"></i> ' + esc(name) + ' عضو شد و در کلاس ' + CLASS_LABEL[cls] + ' ثبت شد.');
}

function renderAdminStudentsList() {
    const chipsEl = $('#stuChips'), grid = $('#stuGrid');
    if (!grid) return;
    if (chipsEl) chipsEl.innerHTML =
        [`<button class="chip ${adminClsFilter === 'all' ? 'active' : ''}" onclick="setClsFilter('all')">همه</button>`]
            .concat(CLASSES.map(c => `<button class="chip ${adminClsFilter === c ? 'active' : ''}" onclick="setClsFilter('${c}')">${CLASS_LABEL[c]}</button>`))
            .join('');
    const q = adminStuQ.trim();
    const list = students
        .filter(s => adminClsFilter === 'all' || s.cls === adminClsFilter)
        .filter(s => !q || s.name.includes(q) || s.mobile.includes(normPhone(q)));
    const today = dateKey();
    grid.innerHTML = list.length ? list.map(s => {
        const t = attendance.find(a => a.studentId === s.id && a.dkey === today);
        const badge = !t ? '<span class="badge badge-info">ثبت نشده</span>' : (t.status === 'present' ? '<span class="badge badge-ok">حاضر</span>' : '<span class="badge badge-danger">غایب</span>');
        return `
        <div class="stu-card" onclick="openStudentModal('${s.id}',true,true)">
            <div class="stu-avatar">${esc(s.name.trim()[0] || '؟')}</div>
            <div class="stu-name">${esc(s.name)}</div>
            <div class="stu-meta">${CLASS_LABEL[s.cls]} — <span dir="ltr">${fa(s.mobile)}</span><br>ولی: ${esc(s.parentName)}</div>
            <div style="margin-top:8px">${badge}</div>
        </div>`;
    }).join('') : '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-user-graduate"></i><p>چیزی پیدا نشد — یا این کلاس هنوز دانش‌آموزی ندارد.</p></div>';
}
function setClsFilter(c) { adminClsFilter = c; renderAdminStudentsList(); }

/* --- پروفایل کامل دانش‌آموز (مدیر/استاد) --- */
let modalCtx = null;
function openStudentModal(id, canEdit, canDiscipline) {
    purgeOldAttendance();
    const s = studentById(id);
    if (!s) return;
    modalCtx = { id, canEdit: !!canEdit, canDiscipline: !!canDiscipline };
    const canDel = !!session.admin || !!session.teacherId;
    const isAdmin = !!session.admin;
    const today = dateKey();
    const t = attendance.find(a => a.studentId === id && a.dkey === today);
    const myAtt = attendance.filter(a => a.studentId === id).sort((a, b) => b.dkey.localeCompare(a.dkey));
    const myDis = discipline.filter(d => d.studentId === id);
    const myGr = grades.filter(g => g.studentId === id).sort((a, b) => b.at - a.at);
    const avg = studentAvg(id);
    const merit = s.merit ?? 20;
    const canMerit = can('students');
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-user-graduate"></i> ${esc(s.name)} <span class="badge badge-info">${CLASS_LABEL[s.cls]}</span></h3>
        <div class="row-meta" style="margin-bottom:14px">
            موبایل: <b dir="ltr">${fa(s.mobile)}</b> — اولیا: ${esc(s.parentName)} (<span dir="ltr">${fa(s.parentPhone)}</span>)
            ${s.parentPhone ? ` — <a class="btn btn-blue btn-sm" style="padding:2px 10px" href="sms:${toIntl(s.parentPhone)}">پیامک</a> <a class="btn btn-call btn-sm" style="padding:2px 10px" href="tel:${toIntl(s.parentPhone)}">تلفن</a>` : ''}
        </div>

        <div class="divider" style="margin:14px 0"></div>
        <h4 style="font-size:.95rem;margin-bottom:10px"><i class="fas fa-calendar-check" style="color:var(--g600)"></i> حضور امروز — ${faDate()}</h4>
        <div style="margin-bottom:10px">${!t ? '<span class="badge badge-info">هنوز ثبت نشده</span>' :
            (t.status === 'present'
                ? `<span class="badge badge-ok">حاضر</span> <span class="h-times">ورود: ${t.cameAt ? fa(t.cameAt) : '—'} — خروج: ${t.leftAt ? fa(t.leftAt) : 'ثبت نشده'}</span>`
                : `<span class="badge badge-danger">غایب</span> ${t.reason ? '<span class="h-reason">علت: ' + esc(t.reason) + '</span>' : ''}`)}
        </div>
        <div class="modal-actions" style="margin-top:8px">
            <button class="btn btn-green btn-sm" onclick="markCame('${id}')"><i class="fas fa-door-open"></i> حاضر / ثبت ورود</button>
            <button class="btn btn-outline-dark btn-sm" onclick="markLeft('${id}')"><i class="fas fa-door-closed"></i> ثبت خروج</button>
            <button class="btn btn-danger btn-sm" onclick="toggleAbsentForm('${id}')"><i class="fas fa-user-clock"></i> غایب + علت</button>
        </div>
        <form id="absentReasonForm" hidden onsubmit="markAbsentSubmit(event,'${id}')" style="margin-top:12px">
            <label class="form-label">علت غیبت<input class="form-input" id="absReason" placeholder="مثلاً: مریض…"></label>
            <button class="btn btn-danger btn-sm" type="submit"><i class="fas fa-check"></i> ثبت غیبت</button>
        </form>

        <div class="divider"></div>
        <h4 style="font-size:.95rem;margin-bottom:8px"><i class="fas fa-star" style="color:var(--gold)"></i> نمرات ${avg !== null ? `<span class="badge badge-ok">میانگین: ${fa(avg.toFixed(1))}</span>` : ''}</h4>
        <div class="history" style="max-height:150px;overflow-y:auto">${myGr.length ? myGr.map(g => `
            <div class="h-item">
                <span class="h-date" style="min-width:110px">${esc(g.subject)}</span>
                <span class="badge ${g.score >= 17 ? 'badge-ok' : g.score >= 10 ? 'badge-info' : 'badge-danger'}">${fa(g.score)}</span>
                ${g.note ? `<span class="h-times">${esc(g.note)}</span>` : ''}
                <span class="h-times">${g.dateFa}</span>
                ${isAdmin ? `<button class="btn btn-del btn-sm" onclick="deleteGrade('${g.id}',this)"><i class="fas fa-trash"></i></button>` : ''}
            </div>`).join('') : '<p style="font-size:.8rem;color:var(--muted)">نمره‌ای ثبت نشده است.</p>'}
        </div>

        ${canMerit ? `
        <div class="row-card" style="margin-top:12px;padding:12px 14px">
            <div class="row-main">
                <div class="row-title"><i class="fas fa-shield-halved" style="color:var(--g600)"></i> نمرهٔ انضباط
                    <span class="badge ${merit >= 15 ? 'badge-ok' : merit >= 10 ? 'badge-warn' : 'badge-danger'}">${fa(merit)} از ۲۰</span>
                </div>
            </div>
            <div class="row-actions">
                <input class="form-input" id="meritInput" type="number" min="0" max="20" step="0.5" value="${merit}" style="width:90px;padding:7px 12px">
                <button class="btn btn-gold btn-sm" onclick="saveMerit('${id}')"><i class="fas fa-floppy-disk"></i> ذخیرهٔ انضباط</button>
            </div>
        </div>
        ${meritLog.filter(x => x.studentId === id).length ? `
        <div class="row-card" style="margin-top:8px;padding:12px 14px">
            <div class="row-main">
                <div class="row-title"><i class="fas fa-clock-rotate-left" style="color:var(--g600)"></i> تاریخچهٔ نمرهٔ انضباط این دانش‌آموز</div>
                <div class="row-meta">هر تغییر با پیامک به اولیا ثبت می‌شود.</div>
            </div>
            <div class="history" style="max-height:140px;overflow-y:auto">${meritLog.filter(x => x.studentId === id).map(x => `
                <div class="h-item">
                    <span class="badge ${x.to >= x.from ? 'badge-ok' : 'badge-danger'}">${fa(x.from)} ← ${fa(x.to)}</span>
                    <span class="h-times">${x.dateFa} — ثبت: ${esc(x.by || '')}</span>
                    ${x.msg ? `<span class="h-times" style="flex:1">پیام به اولیا: «${esc(x.msg)}»</span>` : ''}
                </div>`).join('')}
            </div>
        </div>` : ''}` : ''}

        <div class="divider"></div>
        <h4 style="font-size:.95rem;margin-bottom:8px"><i class="fas fa-clock-rotate-left"></i> سابقهٔ حضور و غیاب <span style="font-size:.7rem;color:var(--muted);font-weight:400">(بعد از ۲ روز خودکار پاک می‌شود)</span></h4>
        <div class="history" style="max-height:190px;overflow-y:auto">${myAtt.length ? myAtt.map(a => `
            <div class="h-item">
                <span class="h-date">${a.dateFa}</span>
                <span class="badge ${a.status === 'present' ? 'badge-ok' : 'badge-danger'}">${a.status === 'present' ? 'حاضر' : 'غایب'}</span>
                ${a.status === 'present' ? `<span class="h-times">ورود: ${a.cameAt ? fa(a.cameAt) : '—'} — خروج: ${a.leftAt ? fa(a.leftAt) : '—'}</span>` : ''}
                ${a.reason ? `<span class="h-reason">علت: ${esc(a.reason)}</span>` : ''}
                <span class="h-times">ثبت: ${esc(a.by || '')}</span>
                ${canDel ? `<button class="btn btn-del btn-sm" onclick="deleteAttendance('${a.id}',this)"><i class="fas fa-trash"></i> حذف</button>` : ''}
            </div>`).join('') : '<p style="font-size:.8rem;color:var(--muted)">سابقه‌ای نیست.</p>'}
        </div>

        <div class="divider"></div>
        <h4 style="font-size:.95rem;margin-bottom:8px"><i class="fas fa-triangle-exclamation" style="color:var(--orange)"></i> موارد انضباطی</h4>
        <div class="history" style="max-height:150px;overflow-y:auto">${myDis.length ? myDis.map(d => `
            <div class="h-item">
                <span class="h-date">${d.dateFa}</span>
                <span style="flex:1;min-width:110px">${esc(d.note)}${d.editedBy ? ` <span class="h-times">(ویرایش: ${esc(d.editedBy)})</span>` : ''}</span>
                <span class="h-times">ثبت: ${esc(d.by || '')}</span>
                ${session.admin ? `<button class="btn btn-ghost btn-sm" onclick="editDiscipline('${d.id}')"><i class="fas fa-pen"></i></button>` : ''}
                ${canDel ? `<button class="btn btn-del btn-sm" onclick="deleteDiscipline('${d.id}',this)"><i class="fas fa-trash"></i> حذف</button>` : ''}
            </div>`).join('') : '<p style="font-size:.8rem;color:var(--muted)">موردی ثبت نشده است. 👏</p>'}
        </div>
        ${canDiscipline ? `
        <form onsubmit="submitDiscipline(event,'${id}')" style="margin-top:12px">
            <textarea class="note-input" id="disNote" rows="2" placeholder="ثبت مورد انضباطی جدید — مثلاً: حرف زدن سر کلاس…"></textarea>
            <button class="btn btn-gold btn-sm" style="margin-top:8px" type="submit"><i class="fas fa-plus"></i> ثبت مورد انضباطی</button>
        </form>` : ''}

        <div class="divider"></div>
        <div class="modal-actions">
            ${canEdit ? `<button class="btn btn-outline-dark btn-sm" onclick="openStudentEdit('${id}')"><i class="fas fa-pen"></i> ویرایش اطلاعات دانش‌آموز</button>` : ''}
            ${canEdit ? `<button class="btn btn-outline-dark btn-sm" onclick="printReport('${id}')"><i class="fas fa-print"></i> چاپ کارنامه</button>` : ''}
            ${canEdit ? `<button class="btn btn-blue btn-sm" onclick="exportReport('${id}','xls')"><i class="fas fa-file-excel"></i> اکسل</button>` : ''}
            ${isAdmin ? `<button class="btn btn-del btn-sm" onclick="deleteStudent('${id}',this)"><i class="fas fa-user-slash"></i> حذف دانش‌آموز</button>` : ''}
        </div>
    `);
}
function saveMerit(id) {
    if (!can('students')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید — مدیر اجازهٔ تغییر انضباط را نداده است.');
    const s = studentById(id);
    if (!s) return;
    let v = parseFloat(toEn($('#meritInput').value));
    if (isNaN(v) || v < 0 || v > 20) return toast('<i class="fas fa-triangle-exclamation"></i> نمرهٔ انضباط بین ۰ تا ۲۰ باشد.');
    const from = s.merit ?? 20;
    if (from === v) return toast('<i class="fas fa-circle-info"></i> نمرهٔ جدید با نمرهٔ فعلی یکسان است.');
    s.merit = v;
    saveStudents();
    // پیام شبیه‌سازی‌شده به اولیا
    const dir = v > from ? 'افزایش' : 'کاهش';
    const line = `دبیرستان شهید حسین اشرفی: نمرهٔ انضباط فرزند شما ${s.name} از ${fa(from)} به ${fa(v)} تغییر کرد (${dir === 'افزایش' ? 'بهتر شد' : 'کاهش یافت'}).`;
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-paper-plane"></i> اولیه ثبت شد — پیام به اولیا (دمو)</h3>
        <div class="row-meta" style="margin-bottom:10px">${esc(s.name)} — اولیا: ${esc(s.parentName)} (<span dir="ltr">${fa(s.parentPhone)}</span>) — تغییر از ${fa(from)} به <b>${fa(v)}</b></div>
        <div class="sms-sim">
            <span class="sms-sim-tag">حالت دمو — پیامک شبیه‌سازی شده</span>
            <div class="sms-sim-head"><i class="fas fa-comment-sms"></i> پیامک ورودی از 50004262</div>
            <div class="sms-bubble">${esc(line)}</div>
        </div>
        <button class="btn btn-gold btn-block" onclick="closeModal()"><i class="fas fa-circle-check"></i> متوجه شدم</button>`);
    meritLog.push({ id: uid(), studentId: id, from, to: v, dateFa: faDate(), at: Date.now(), by: sessionLabel(), msg: line });
    saveMeritLog();
    refreshAfterAttendance();
    toast('<i class="fas fa-circle-check"></i> نمرهٔ انضباط ' + fa(v) + ' ذخیره شد و پیام به اولیا رفت.');
}
function markCame(id) {
    const today = dateKey();
    let t = attendance.find(a => a.studentId === id && a.dkey === today);
    if (!t) {
        t = { id: uid(), studentId: id, dkey: today, day: faDay(), dateFa: faDate(), status: 'present', cameAt: null, leftAt: null, reason: '', note: '', by: sessionLabel(), at: Date.now() };
        attendance.push(t);
    } else {
        t.status = 'present';
        t.by = sessionLabel();
    }
    if (!t.cameAt) t.cameAt = faTime();
    saveAttendance();
    openStudentModal(id, modalCtx && modalCtx.canEdit, modalCtx && modalCtx.canDiscipline);
    refreshAfterAttendance();
    toast('<i class="fas fa-door-open"></i> ورود در ساعت ' + t.cameAt + ' ثبت شد.');
}
function markLeft(id) {
    const today = dateKey();
    const t = attendance.find(a => a.studentId === id && a.dkey === today);
    if (!t || t.status !== 'present') return toast('<i class="fas fa-triangle-exclamation"></i> اول «حاضر / ثبت ورود» را بزنید.');
    if (t.leftAt) return toast('<i class="fas fa-circle-info"></i> خروج قبلاً در ساعت ' + t.leftAt + ' ثبت شده.');
    t.leftAt = faTime();
    saveAttendance();
    openStudentModal(id, modalCtx && modalCtx.canEdit, modalCtx && modalCtx.canDiscipline);
    refreshAfterAttendance();
    toast('<i class="fas fa-door-closed"></i> خروج در ساعت ' + t.leftAt + ' ثبت شد.');
}
function toggleAbsentForm(id) {
    const f = $('#absentReasonForm');
    f.hidden = !f.hidden;
    if (!f.hidden) $('#absReason').focus();
}
function markAbsentSubmit(e, id) {
    e.preventDefault();
    const reason = $('#absReason').value.trim() || 'بدون علت';
    const today = dateKey();
    let t = attendance.find(a => a.studentId === id && a.dkey === today);
    if (!t) {
        t = { id: uid(), studentId: id, dkey: today, day: faDay(), dateFa: faDate(), status: 'absent', cameAt: null, leftAt: null, reason: '', note: '', by: sessionLabel(), at: Date.now() };
        attendance.push(t);
    }
    t.status = 'absent';
    t.reason = reason;
    t.cameAt = null; t.leftAt = null;
    t.by = sessionLabel();
    saveAttendance();
    openStudentModal(id, modalCtx && modalCtx.canEdit, modalCtx && modalCtx.canDiscipline);
    refreshAfterAttendance();
    toast('<i class="fas fa-user-clock"></i> غیبت با علت «' + esc(reason) + '» ثبت شد.');
}
function refreshAfterAttendance() {
    if (currentView === 'admin' && adminTab === 'students') renderAdminStudents();
    if (currentView === 'admin' && adminTab === 'absents') renderAbsentsList();
    if (currentView === 'admin' && adminTab === 'dash') renderAdminDash();
    if (currentView === 'admin' && adminTab === 'parents') renderParentsList();
    if (currentView === 'teacher') renderTeacherClass();
    if (currentView === 'student' && session.studentId) renderStudentPanel();
}

/* --- ثبت مورد انضباطی --- */
function submitDiscipline(e, id) {
    e.preventDefault();
    const note = $('#disNote').value.trim();
    if (!note) return;
    discipline.push({ id: uid(), studentId: id, dateFa: faDate(), day: faDay(), note, at: Date.now(), by: sessionLabel() });
    saveDiscipline();
    openStudentModal(id, modalCtx && modalCtx.canEdit, modalCtx && modalCtx.canDiscipline);
    refreshAfterAttendance();
    toast('<i class="fas fa-triangle-exclamation"></i> مورد انضباطی ثبت شد.');
}

/* --- حذف و ویرایش رکوردها (مدیر/معاون/استاد) --- */
function deleteAttendance(id, btn) {
    if (!confirmBtn(btn, 'حذف شود؟')) return;
    attendance = attendance.filter(a => a.id !== id);
    saveAttendance();
    if (modalCtx && !$('#overlay').hidden) openStudentModal(modalCtx.id, modalCtx.canEdit, modalCtx.canDiscipline);
    refreshAfterAttendance();
    toast('<i class="fas fa-trash"></i> رکورد حاضر/غایب حذف شد.');
}
function deleteDiscipline(id, btn) {
    if (!confirmBtn(btn, 'حذف شود؟')) return;
    discipline = discipline.filter(d => d.id !== id);
    saveDiscipline();
    if (modalCtx && !$('#overlay').hidden) openStudentModal(modalCtx.id, modalCtx.canEdit, modalCtx.canDiscipline);
    refreshAfterAttendance();
    toast('<i class="fas fa-trash"></i> مورد انضباطی حذف شد.');
}
function deleteGrade(id, btn) {
    if (!confirmBtn(btn, 'حذف نمره؟')) return;
    grades = grades.filter(g => g.id !== id);
    saveGrades();
    if (modalCtx && !$('#overlay').hidden) openStudentModal(modalCtx.id, modalCtx.canEdit, modalCtx.canDiscipline);
    refreshAfterAttendance();
    toast('<i class="fas fa-trash"></i> نمره حذف شد.');
}
function editDiscipline(id) {
    if (!session.admin) return;
    const d = discipline.find(x => x.id === id);
    if (!d) return;
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-pen"></i> ویرایش مورد انضباطی</h3>
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:4px">دانش‌آموز: <b>${esc(studentById(d.studentId)?.name || '—')}</b> — ثبت در ${d.dateFa} ${d.editedBy ? '(آخرین ویرایش: ' + esc(d.editedBy) + ')' : ''}</p>
        <form onsubmit="submitDisciplineEdit(event,'${id}')">
            <label class="form-label">متن / وضعیت مورد انضباطی
                <textarea class="note-input" id="deNote" rows="3" required>${esc(d.note)}</textarea>
            </label>
            <div class="form-error" id="deError" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:16px" type="submit"><i class="fas fa-floppy-disk"></i> ذخیرهٔ تغییرات</button>
        </form>`);
}
function submitDisciplineEdit(e, id) {
    e.preventDefault();
    const d = discipline.find(x => x.id === id);
    if (!d) return;
    const note = $('#deNote').value.trim();
    if (!note) return showErr('#deError', 'متن نمی‌تواند خالی باشد — برای پاک‌کردن کامل، دکمهٔ «حذف» را بزنید.');
    d.note = note;
    d.editedBy = sessionLabel();
    d.editedAt = Date.now();
    saveDiscipline();
    if (modalCtx && !$('#overlay').hidden) openStudentModal(modalCtx.id, modalCtx.canEdit, modalCtx.canDiscipline);
    else closeModal();
    refreshAfterAttendance();
    toast('<i class="fas fa-circle-check"></i> مورد انضباطی ویرایش شد.');
}

/* --- حذف دانش‌آموز --- */
function deleteStudent(id, btn) {
    if (!confirmBtn(btn, 'حذف کامل دانش‌آموز؟')) return;
    deleteStudentById(id);
    closeModal();
    toast('<i class="fas fa-user-slash"></i> دانش‌آموز و همهٔ سوابقش حذف شد.');
}
function deleteStudentById(id) {
    students = students.filter(s => s.id !== id);
    attendance = attendance.filter(a => a.studentId !== id);
    discipline = discipline.filter(d => d.studentId !== id);
    grades = grades.filter(g => g.studentId !== id);
    saveStudents(); saveAttendance(); saveDiscipline(); saveGrades();
    if (session.studentId === id) { session.studentId = null; ls.del('hs_student'); updateHeader(); }
    refreshAfterAttendance();
}

/* --- ویرایش دانش‌آموز --- */
function openStudentEdit(id) {
    const s = studentById(id);
    if (!s) return;
    
    // تشخیص اینکه چه کسی داره ویرایش میکنه
    const isAdminOrTeacher = session.admin || session.teacherId; 
    
    // اگر دانش‌آموز باشه، بقیه فیلدها قفل میشن
    const lockAttr = isAdminOrTeacher ? '' : 'disabled style="background:#e2e8f0;color:#64748b;cursor:not-allowed;"';

    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-pen"></i> ویرایش اطلاعات دانش‌آموز</h3>
        ${!isAdminOrTeacher ? '<p style="font-size:.82rem;color:var(--danger);margin-bottom:10px"><i class="fas fa-triangle-exclamation"></i> شما فقط مجاز به تغییر رمز عبور خود هستید. برای تغییر بقیه اطلاعات با مدیر مدرسه تماس بگیرید.</p>' : ''}
        
        <form onsubmit="submitStudentEdit(event,'${id}')">
            <label class="form-label">نام و نام خانوادگی<input class="form-input" id="seName" required value="${esc(s.name)}" ${lockAttr}></label>
            <div class="form-row">
                <label class="form-label">کلاس
                    <select class="form-select" id="seCls" ${lockAttr}>
                        ${CLASSES.map(c => `<option value="${c}" ${s.cls === c ? 'selected' : ''}>${CLASS_LABEL[c]}</option>`).join('')}
                    </select>
                </label>
                <label class="form-label">شماره موبایل<input class="form-input" id="seMobile" required dir="ltr" value="${s.mobile}" ${lockAttr}></label>
            </div>
            <div class="form-row">
                <label class="form-label">نام اولیا<input class="form-input" id="seParentName" required value="${esc(s.parentName)}" ${lockAttr}></label>
                <label class="form-label">شماره اولیا<input class="form-input" id="seParentPhone" required dir="ltr" value="${s.parentPhone}" ${lockAttr}></label>
            </div>
            <label class="form-label">رمز عبور شخصی (حداقل ۴ کاراکتر)
                <span class="hint">${isAdminOrTeacher ? 'رمز جدید بسازید و فقط به خود دانش‌آموز بگویید' : 'شما می‌توانید رمز خود را در این بخش تغییر دهید'}</span>
                <span class="pass-wrap">
                    <input class="form-input" id="sePass" required type="password" value="${esc(s.pass || '')}" placeholder="حداقل ۴ کاراکتر">
                    <button type="button" class="eye-btn" onclick="togglePass('sePass',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                </span>
            </label>
            <div class="form-error" id="seError" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:18px" type="submit"><i class="fas fa-floppy-disk"></i> ذخیرهٔ تغییرات</button>
        </form>`);
}
function submitStudentEdit(e, id) {
    e.preventDefault();
    const s = studentById(id);
    if (!s) return;
    const name = $('#seName').value.trim();
    const cls = $('#seCls').value;
    const mobile = normPhone($('#seMobile').value);
    const parentName = $('#seParentName').value.trim();
    const parentPhone = normPhone($('#seParentPhone').value);
    const pass = $('#sePass').value;
    if (name.length < 3) return showErr('#seError', 'نام را کامل وارد کنید.');
    if (!validPhone(mobile)) return showErr('#seError', 'شماره موبایل نامعتبر است.');
    if (students.some(x => x.mobile === mobile && x.id !== id)) return showErr('#seError', 'این شماره مال دانش‌آموز دیگری است.');
    if (!validPhone(parentPhone)) return showErr('#seError', 'شماره اولیا نامعتبر است.');
    if (pass.length < 4) return showErr('#seError', 'رمز عبور حداقل ۴ کاراکتر باشد.');
    if (pass === mobile) return showErr('#seError', 'رمز عبور نباید همان شمارهٔ موبایل باشد.');
    Object.assign(s, { name, cls, mobile, parentName, parentPhone, pass });
    saveStudents();
    closeModal();
    renderAdminTab();
    refreshAfterAttendance();
    updateHeader();
    toast('<i class="fas fa-circle-check"></i> اطلاعات ذخیره شد — خودکار در کلاس و بخش اولیا به‌روز شد.');
}

const SP = (sub_) => Array.isArray(sub_) ? sub_.filter(Boolean).join('، ') : sub_;
const escSP = (sub_) => esc(SP(sub_));
const subJ = (sub_) => Array.isArray(sub_) ? sub_.filter(Boolean)[0] || '' : (sub_ || '');
/* انتخاب درس جاری در کلاسِ استاد (فقط از بین درس‌های خودش) */
function setTeacherSub(sub) { teacherSub = sub; renderTeacherClass(); }

/* ---------- تب استادها (مدیریت) ---------- */
function renderAdminTeachers() {
    purgeOldTLog();
    const list = [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    const log = [...tlog].sort((a, b) => b.dkey.localeCompare(a.dkey) || (b.at || 0) - (a.at || 0));
    const leaveList = leaves.filter(l => !l.deletedForMe).length ? `
        <h4 style="margin:24px 0 10px"><i class="fas fa-plane-departure" style="color:var(--blue)"></i> درخواست‌های مرخصی معلمان</h4>
        <div class="rows">
            ${leaves.filter(l => !l.deletedForMe).sort((a,b) => b.at - a.at).map(l => {
                const t = teacherById(l.tid);
                return `
                <div class="row-card">
                    <div class="row-main">
                        <div class="row-title">${STAD_PLAIN} ${esc(t ? t.name : l.teacherName)} <span class="badge badge-info">${l.dateFa}</span></div>
                        <div class="row-meta">${esc(l.text)}</div>
                    </div>
                    <div class="row-actions">
                        ${l.status === 'pending' ? '<span class="badge badge-warn">بدون جواب</span>' : (l.status === 'accepted' ? '<span class="badge badge-ok">قبول شد</span>' : '<span class="badge badge-danger">رد شد</span>')}
                        ${l.status === 'pending' ? `
                            <button class="btn btn-green btn-sm" onclick="setLeaveStatus('${l.id}', 'accepted')"><i class="fas fa-check"></i> قبول</button>
                            <button class="btn btn-danger btn-sm" onclick="setLeaveStatus('${l.id}', 'rejected')"><i class="fas fa-xmark"></i> رد</button>
                        ` : ''}
                    </div>
                </div>`;
            }).join('')}
        </div>
    ` : '';
    $('#adminTab-teachers').innerHTML = `
${leaveList}

        <p class="tab-sub">هر ${STAD_PLAIN} با ثبت‌نام (نام، موبایل، رمز شخصی، کلاس‌ها و درس‌ها) خودکار اینجا ثبت می‌شود. وضعیت ورود و خروج ${STAD_PLAIN}ها بعد از ۲ روز خودکار پاک می‌شود.</p>
        <div class="toolbar" style="margin-bottom:14px">
            ${can('addTeacher') ? `<button class="btn btn-gold btn-sm" onclick="openTeacherRegAdmin()"><i class="fas fa-user-plus"></i> عضو کردن ${STAD_PLAIN} جدید</button>` : ''}
        </div>
        <div class="rows" style="margin-bottom:24px">
            ${list.length ? list.map(t => `
            <div class="row-card">
                <div class="row-main">
                    <div class="row-title"><i class="fas fa-chalkboard-user" style="color:var(--g600)"></i> ${STAD_PLAIN} ${esc(t.name.replace(/^استاد\s*/, ''))}</div>
                    <div class="row-meta">موبایل: <span dir="ltr">${fa(t.phone)}</span> — درس‌ها:
                        ${Object.entries(t.cls).map(([c, sub]) => `<span class="badge badge-info">${CLASS_LABEL[c]}: ${escSP(sub)}</span>`).join(' ')}
                    </div>
                </div>
                <div class="row-actions">
                    <a class="btn btn-call btn-sm" href="tel:${toIntl(t.phone)}"><i class="fas fa-phone"></i> تلفن</a>
                    <a class="btn btn-blue btn-sm" href="sms:${toIntl(t.phone)}"><i class="fas fa-comment-sms"></i> پیامک</a>
                    <button class="btn btn-ghost btn-sm" onclick="openTeacherEdit('${t.id}')"><i class="fas fa-pen"></i> ویرایش کامل</button>
                    <button class="btn btn-ghost btn-sm" onclick="openTeacherPass('${t.id}')"><i class="fas fa-key"></i> رمز جدید</button>
                    <button class="btn btn-del btn-sm" onclick="deleteTeacher('${t.id}',this)"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>`).join('') : '<div class="empty-state"><i class="fas fa-chalkboard-user"></i><p>هنوز ' + STAD_PLAIN + '‌ای ثبت‌نام نکرده است.</p></div>'}
        </div>
        <h4 style="margin:8px 0 10px"><i class="fas fa-right-to-bracket"></i> ورود و خروج ${STAD_PLAIN}ها <span style="font-size:.72rem;color:var(--muted);font-weight:400">(۲ روز اخیر — قدیمی‌ترها خودکار پاک می‌شود)</span></h4>
        <div class="rows">${log.length ? log.map(l => {
            const t = teacherById(l.tid);
            return `
            <div class="row-card">
                <div class="row-main">
                    <div class="row-title">${STAD_PLAIN} ${esc(t ? t.name : '—')} <span class="badge badge-gold">${l.dateFa}</span></div>
                    <div class="row-meta">ورود: <b>${l.cameAt ? fa(l.cameAt) : '—'}</b> — خروج: <b>${l.leftAt ? fa(l.leftAt) : 'ثبت نشده'}</b></div>
                </div>
                <div class="row-actions">
                    <button class="btn btn-del btn-sm" onclick="deleteTLog('${l.id}',this)"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>`; }).join('') : '<div class="empty-state"><i class="fas fa-door-open"></i><p>سابقهٔ ورود و خروجی ثبت نشده است.</p></div>'}
        </div>`;
}
/* --- عضو کردن استاد توسط مدیر/معاون (بدون OTP) --- */
function openTeacherRegAdmin() {
    if (!can('addTeacher')) return toast('<i class="fas fa-lock"></i> مدیر اجازهٔ عضوکردن استاد را نداده است.');
    const clsRows = CLASSES.map(c => `
        <div class="check-line">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" id="atc_${c}" onchange="toggleTClsAdmin('${c}',this.checked)">
                <b>${CLASS_LABEL[c]}</b>
            </label>
            <select class="form-select" id="atsub_${c}" multiple hidden style="margin-top:8px;min-height:64px">
                ${subjectsOf(c).map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
        </div>`).join('');
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-user-plus"></i> عضو کردن ${STAD} جدید</h3>
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:4px">ثبت‌نام دستی بدون تأیید پیامکی — چند درس برای هر کلاس می‌توانید انتخاب کنید (با Ctrl/کلیک‌پی‌درپی).</p>
        <form onsubmit="submitTeacherRegAdmin(event)">
            <label class="form-label">نام و نام خانوادگی<input class="form-input" id="atrName" required placeholder="مثلاً: استاد غفوری"></label>
            <div class="form-row">
                <label class="form-label">شماره موبایل<input class="form-input" id="atrPhone" required dir="ltr" placeholder="09xxxxxxxxx"></label>
                <label class="form-label">رمز عبور شخصی
                    <span class="pass-wrap">
                        <input class="form-input" id="atrPass" required type="password" placeholder="حداقل ۴ کاراکتر">
                        <button type="button" class="eye-btn" onclick="togglePass('atrPass',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                    </span>
                </label>
            </div>
            <div class="form-label" style="margin-top:14px">کلاس‌ها و درس‌ها (برای هر کلاس چند درس قابل انتخاب است)</div>
            <div class="check-grid">${clsRows}</div>
            <div class="form-error" id="atrError" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:14px" type="submit"><i class="fas fa-user-plus"></i> ثبت و عضوکردن</button>
        </form>`);
}
function toggleTClsAdmin(c, on) { const sel = $('#atsub_' + c); if (sel) sel.hidden = !on; }
function submitTeacherRegAdmin(e) {
    e.preventDefault();
    if (!can('addTeacher')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید.');
    const name = $('#atrName').value.trim();
    const phone = normPhone($('#atrPhone').value);
    const pass = $('#atrPass').value;
    const cls = {};
    CLASSES.forEach(c => {
        const cb = $('#atc_' + c), sel = $('#atsub_' + c);
        if (cb && cb.checked) cls[c] = sel ? [...sel.selectedOptions].map(o => o.value) : [];
    });
    if (name.length < 3) return showErr('#atrError', 'نام را کامل وارد کنید.');
    if (!validPhone(phone)) return showErr('#atrError', 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
    if (teachers.some(t => t.phone === phone)) return showErr('#atrError', 'این شماره قبلاً ثبت شده است.');
    if (pass.length < 4) return showErr('#atrError', 'رمز حداقل ۴ کاراکتر باشد.');
    if (!Object.keys(cls).length) return showErr('#atrError', 'حداقل یک کلاس را تیک بزنید.');
    for (const c of Object.keys(cls)) if (!cls[c].length) return showErr('#atrError', 'برای کلاس ' + CLASS_LABEL[c] + ' حداقل یک درس انتخاب کنید.');
    const t = { id: uid(), name: /^استاد/.test(name) ? name : 'استاد ' + name, phone, pass, cls, at: Date.now() };
    teachers.push(t);
    saveTeachers();
    migrateTeacherCls();
    closeModal();
    renderAdminTeachers();
    toast('<i class="fas fa-user-plus"></i> ' + STAD_PLAIN + ' ' + esc(name) + ' عضو شد.');
}

function openTeacherPass(tid) {
    const t = teacherById(tid);
    if (!t) return;
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-key"></i> تغییر رمز ${STAD_PLAIN}</h3>
        <p style="font-size:.85rem;color:var(--muted)">رمز شخصی ${STAD_PLAIN} <b>${esc(t.name)}</b> را عوض کنید و به خودشان بگویید.</p>
        <form onsubmit="submitTeacherPass(event,'${tid}')">
            <label class="form-label">رمز عبور جدید
                <span class="pass-wrap">
                    <input class="form-input" id="tpPass" required type="password" placeholder="حداقل ۴ کاراکتر">
                    <button type="button" class="eye-btn" onclick="togglePass('tpPass',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                </span>
            </label>
            <div class="form-error" id="tpError" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:18px" type="submit"><i class="fas fa-floppy-disk"></i> ذخیرهٔ رمز جدید</button>
        </form>`);
}
function submitTeacherPass(e, tid) {
    e.preventDefault();
    const t = teacherById(tid);
    if (!t) return;
    const p = $('#tpPass').value;
    if (p.length < 4) return showErr('#tpError', 'رمز حداقل ۴ کاراکتر باشد.');
    t.pass = p;
    saveTeachers();
    closeModal();
    renderAdminTeachers();
    toast('<i class="fas fa-circle-check"></i> رمز ' + STAD_PLAIN + ' ' + esc(t.name) + ' عوض شد.');
}
function deleteTeacher(tid, btn) {
    if (!confirmBtn(btn, 'حذف ' + STAD_PLAIN + '؟')) return;
    teachers = teachers.filter(t => t.id !== tid);
    tlog = tlog.filter(l => l.tid !== tid);
    saveTeachers(); saveTLog();
    if (session.teacherId === tid) { session.teacherId = null; ls.del('hs_teacher'); updateHeader(); show('home'); }
    renderAdminTeachers();
    toast('<i class="fas fa-trash"></i> ' + STAD_PLAIN + ' حذف شد.');
}
function deleteTLog(id, btn) {
    if (!confirmBtn(btn, 'حذف شود؟')) return;
    tlog = tlog.filter(l => l.id !== id);
    saveTLog();
    renderAdminTeachers();
    toast('<i class="fas fa-trash"></i> رکورد ورود/خروج حذف شد.');
}

/* --- پیام گروهی به اولیا (انتخاب کلاس‌ها) --- */
let gmSel = [];
function renderGmChips() {
    const box = $('#gmChips'); if (!box) return;
    box.innerHTML = CLASSES.map(c => `<button class="gm-chip ${gmSel.includes(c) ? 'active' : ''}" onclick="toggleGmChip('${c}')">${CLASS_LABEL[c]}</button>`).join('');
    updateGmHint();
}
function toggleGmChip(c) {
    gmSel = gmSel.includes(c) ? gmSel.filter(x => x !== c) : [...gmSel, c];
    renderGmChips();
}
function updateGmHint() {
    const h = $('#gmHint'); if (!h) return;
    const n = allParents().filter(p => gmSel.includes(p.cls)).length;
    h.textContent = gmSel.length ? fa(n) + ' اولیا دریافت می‌کنند.' : 'اول کلاس‌ها را انتخاب کنید.';
}
function sendGroupMsg() {
    if (!can('parents')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید — مدیر اجازهٔ پیام گروهی را نداده است.');
    const text = ($('#gmText') ? $('#gmText').value : '').trim();
    if (!gmSel.length) return toast('<i class="fas fa-triangle-exclamation"></i> اول کلاس‌های موردنظر را انتخاب کنید.');
    if (!text) return toast('<i class="fas fa-triangle-exclamation"></i> متن پیام را بنویسید.');
    const targets = allParents().filter(p => gmSel.includes(p.cls));
    if (!targets.length) return toast('<i class="fas fa-triangle-exclamation"></i> هیچ اولیایی در این کلاس‌ها ثبت نشده است.');
    const line = 'دبیرستان شهید حسین اشرفی: ' + text;
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-paper-plane"></i> پیام گروهی ارسال شد (دمو)</h3>
        <div class="row-meta" style="margin-bottom:10px">کلاس‌ها: ${gmSel.map(c => `<span class="badge badge-info">${CLASS_LABEL[c]}</span>`).join(' ')} — دریافت‌کنندگان: <b>${fa(targets.length)}</b> اولیا</div>
        <div class="sms-sim">
            <span class="sms-sim-tag">حالت دمو — پیامک شبیه‌سازی شده</span>
            <div class="sms-sim-head"><i class="fas fa-comment-sms"></i> پیامک ورودی از 50004262</div>
            ${targets.slice(0, 5).map(p => `<div class="sms-bubble">${esc(p.studentName || 'اولیا')} — <span dir="ltr">${fa(p.phone)}</span><br>${esc(line)}</div>`).join('')}
            ${targets.length > 5 ? `<p style="font-size:.78rem;color:var(--muted)">و ${fa(targets.length - 5)} پیامک دیگر…</p>` : ''}
        </div>
        <button class="btn btn-gold btn-block" onclick="closeModal()"><i class="fas fa-circle-check"></i> متوجه شدم</button>`);
    groupMsgs.push({ id: uid(), text, classes: [...gmSel], dateFa: faDate(), at: Date.now(), by: sessionLabel(), count: targets.length });
    saveGroupMsgs();
    if ($('#gmText')) $('#gmText').value = '';
    toast('<i class="fas fa-paper-plane"></i> پیام برای ' + fa(targets.length) + ' اولیا ارسال شد.');
}
function renderGroupMsgHistory() {
    renderGmChips();
}

/* ---------- تب دسترسی معاون (فقط مدیر) ---------- */
const VP_KEYS = ['parents','absents','students','teachers','addStudent','addTeacher','notices','phones','adminPass'];
function renderVicePerms() {
    const isAdminNow = session.admin === 'مدیر';
    const p = vicePerms();
    $('#adminTab-perms').innerHTML = `
        <p class="tab-sub">معاون با همان رمز مدیر وارد می‌شود، اما فقط بخش‌هایی را می‌بیند که اینجا تیک خورده. هر وقت بخواهی می‌توانی اجازه‌ای را بگیری یا بدهی — بلافاصله اعمال می‌شود.</p>
        ${isAdminNow ? `
        <div class="rows">${VP_KEYS.map(k => `
            <div class="row-card">
                <div class="row-main">
                    <div class="row-title"><i class="fas ${p[k] ? 'fa-lock-open' : 'fa-lock'}" style="color:${p[k] ? 'var(--ok)' : 'var(--muted)'}"></i> ${VP_LABEL[k]}</div>
                </div>
                <div class="row-actions">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.85rem">
                        <input type="checkbox" ${p[k] ? 'checked' : ''} onchange="toggleVicePerm('${k}',this.checked)">
                        <span>${p[k] ? 'اجازه دارد' : 'بدون اجازه'}</span>
                    </label>
                </div>
            </div>`).join('')}</div>
        <button class="btn btn-outline-dark btn-sm" style="margin-top:14px" onclick="grantAllPerms()"><i class="fas fa-user-check"></i> اجازهٔ همه‌چیز به معاون</button>
        <button class="btn btn-ghost btn-sm" style="margin-top:14px" onclick="revokeAllPerms()"><i class="fas fa-user-lock"></i> گرفتن همهٔ اجازه‌ها</button>`
        : `<div class="empty-state"><i class="fas fa-lock"></i><p>تنظیم اجازه‌ها فقط توسط خودِ مدیر امکان دارد.</p></div>`}`;
}
function toggleVicePerm(k, v) { setVicePerm(k, v); renderVicePerms(); toast(v ? '<i class="fas fa-unlock"></i> اجازه دادید.' : '<i class="fas fa-lock"></i> اجازه گرفته شد.'); }
function grantAllPerms() { VP_KEYS.forEach(k => setVicePerm(k, true)); renderVicePerms(); toast('<i class="fas fa-user-check"></i> معاون حالا اجازهٔ همه‌چیز دارد.'); }
function revokeAllPerms() { VP_KEYS.forEach(k => setVicePerm(k, false)); renderVicePerms(); toast('<i class="fas fa-user-lock"></i> همهٔ اجازه‌های معاون گرفته شد.'); }

/* ---------- تب تنظیمات (مدیریت) ---------- */
function renderAdminSettings() {
    $('#adminTab-settings').innerHTML = `
        <p class="tab-sub">مدیر و معاون می‌توانند رمز بخش خودشان را عوض کنند و رمز هر ${STAD_PLAIN} را هم از تب «${STAD_PLAIN}ها» عوض کنند.</p>
        <div class="row-card" style="margin-bottom:20px;border-right:4px solid var(--danger)">
            <div class="row-main">
                <div class="row-title" style="color:var(--danger)"><i class="fas fa-arrow-up-right-dots"></i> ارتقای خودکار دانش‌آموزان</div>
                <div class="row-meta">در ابتدای سال تحصیلی جدید، با یک کلیک پایه‌ی همه دانش‌آموزان را ارتقا دهید (حذف نهم‌ها).</div>
            </div>
            <div class="row-actions">
                <button class="btn btn-danger btn-sm" onclick="openPromoteStudents()"><i class="fas fa-play"></i> اجرای ارتقا</button>
            </div>
        </div>
        <div class="row-card">
            <div class="row-main">
                <div class="row-title"><i class="fas fa-lock" style="color:var(--g600)"></i> تغییر رمز بخش مدیر و معاون</div>
                <div class="row-meta">این رمز برای ورود مدیر، معاون و تب ${STAD_PLAIN}های پنل مدیریت استفاده می‌شود.</div>
            </div>
        </div>
        <form onsubmit="submitAdminPassChange(event)" style="margin-top:14px">
            <div class="form-row">
                <label class="form-label">رمز فعلی
                    <span class="pass-wrap">
                        <input class="form-input" id="apcCur" required type="password">
                        <button type="button" class="eye-btn" onclick="togglePass('apcCur',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                    </span>
                </label>
                <label class="form-label">رمز جدید
                    <span class="pass-wrap">
                        <input class="form-input" id="apcNew" required type="password" placeholder="حداقل ۶ کاراکتر">
                        <button type="button" class="eye-btn" onclick="togglePass('apcNew',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                    </span>
                </label>
            </div>
            <label class="form-label">تکرار رمز جدید
                <span class="pass-wrap">
                    <input class="form-input" id="apcNew2" required type="password">
                    <button type="button" class="eye-btn" onclick="togglePass('apcNew2',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                </span>
            </label>
            <div class="form-error" id="apcError" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:16px" type="submit"><i class="fas fa-key"></i> ذخیرهٔ رمز جدید</button>
        </form>
        <div class="divider"></div>
        <h4 style="font-size:.95rem;margin-bottom:10px"><i class="fas fa-phone" style="color:var(--g600)"></i> شماره‌های تلفن مدرسه <span style="font-size:.72rem;color:var(--muted);font-weight:400">(در صفحهٔ خانه نمایش داده می‌شوند)</span></h4>
        ${can('phones') ? `<div class="rows">${schoolPhones.map(p => `
            <div class="row-card">
                <div class="row-main">
                    <div class="row-title"><i class="fas ${p.icon || 'fa-phone'}" style="color:var(--g600)"></i> ${esc(p.role)} — ${esc(p.name)}</div>
                    <div class="row-meta"><span dir="ltr" style="font-weight:800">${fa(p.phone)}</span></div>
                </div>
                <div class="row-actions">
                    <button class="btn btn-ghost btn-sm" onclick="openPhoneEdit('${p.id}')"><i class="fas fa-pen"></i> ویرایش</button>
                    <button class="btn btn-del btn-sm" onclick="deletePhone('${p.id}',this)"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>`).join('')}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:12px" onclick="openPhoneAdd()"><i class="fas fa-plus"></i> افزودن شمارهٔ جدید</button>`
        : `<div class="empty-state"><i class="fas fa-lock"></i><p>مدیر اجازهٔ دست‌کاری شماره‌ها را نداده است.</p></div>`}
        <div class="divider"></div>
        <h4 style="font-size:.95rem;margin-bottom:10px"><i class="fas fa-bullhorn" style="color:var(--g600)"></i> اطلاعیه‌های مدرسه</h4>
        <form onsubmit="submitNoticeAdd(event)" style="margin-bottom:16px">
            <label class="form-label">عنوان<input class="form-input" id="ntTitle" required placeholder="مثلاً: جلسهٔ اولیا و مربیان"></label>
            <label class="form-label">متن اطلاعیه<textarea class="note-input" id="ntText" rows="2" required placeholder="متن اطلاعیه…"></textarea></label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.88rem;margin:8px 0">
                <input type="checkbox" id="ntBig">
                <b><i class="fas fa-bullhorn" style="color:var(--gold)"></i> اطلاعیهٔ مهم — به‌صورت بزرگ، رنگی و انیمیشنی وسط صفحه نمایش داده شود</b>
            </label>
            <button class="btn btn-gold btn-sm" style="margin-top:10px" type="submit"><i class="fas fa-plus"></i> انتشار اطلاعیه</button>
        </form>
        <div class="rows">${notices.length ? [...notices].sort((a, b) => b.at - a.at).map(n => `
            <div class="row-card">
                <div class="row-main">
                    <div class="row-title">${esc(n.title)}</div>
                    <div class="row-meta">${esc(n.text)} — ${n.dateFa}</div>
                </div>
                <div class="row-actions">
                    <button class="btn btn-del btn-sm" onclick="deleteNotice('${n.id}',this)"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>`).join('') : '<p style="font-size:.82rem;color:var(--muted)">اطلاعیه‌ای ثبت نشده است.</p>'}
        </div>`;
}
function submitAdminPassChange(e) {
    e.preventDefault();
    const cur = $('#apcCur').value, nw = $('#apcNew').value, nw2 = $('#apcNew2').value;
    if (!checkAdminPass(cur)) return showErr('#apcError', 'رمز فعلی درست نیست.');
    if (nw.length < 6) return showErr('#apcError', 'رمز جدید حداقل ۶ کاراکتر باشد.');
    if (nw !== nw2) return showErr('#apcError', 'تکرار رمز با رمز جدید یکسان نیست.');
    ls.set('hs_admin_pass', nw);
    toast('<i class="fas fa-circle-check"></i> رمز بخش مدیر و معاون عوض شد — دفعهٔ بعد با رمز جدید وارد شوید.');
    renderAdminSettings();
}
function submitNoticeAdd(e) {
    e.preventDefault();
    const title = $('#ntTitle').value.trim();
    const text = $('#ntText').value.trim();
    if (!title || !text) return;
    notices.push({ id: uid(), title, text, dateFa: faDate(), at: Date.now(), big: $('#ntBig') && $('#ntBig').checked });
    saveNotices();
    renderAdminSettings();
    renderHome();
    toast('<i class="fas fa-bullhorn"></i> اطلاعیه منتشر شد.');
}
function deleteNotice(id, btn) {
    if (!confirmBtn(btn, 'حذف اطلاعیه؟')) return;
    notices = notices.filter(n => n.id !== id);
    saveNotices();
    renderAdminSettings();
    renderHome();
    toast('<i class="fas fa-trash"></i> اطلاعیه حذف شد.');
}

/* --- مدیریت شماره‌های تلفن مدرسه --- */
function openPhoneAdd() {
    if (!can('phones')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید.');
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-phone"></i> افزودن شمارهٔ مدرسه</h3>
        <form onsubmit="submitPhoneAdd(event)">
            <label class="form-label">سمت / عنوان<input class="form-input" id="phRole" required placeholder="مثلاً: دفتر، مدیر، معاون…"></label>
            <label class="form-label">نام<input class="form-input" id="phName" required placeholder="مثلاً: آقای حسین جعفری"></label>
            <label class="form-label">شماره تلفن<input class="form-input" id="phPhone" required dir="ltr" placeholder="09xxxxxxxxx یا 011..."></label>
            <div class="form-error" id="phError" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:16px" type="submit"><i class="fas fa-floppy-disk"></i> ذخیره</button>
        </form>`);
}
function validAnyPhone(p) {
    return /^(09\d{9}|0\d{10})$/.test(normPhone(p));
}
function submitPhoneAdd(e) {
    e.preventDefault();
    const role = $('#phRole').value.trim(), name = $('#phName').value.trim();
    const phone = normPhone($('#phPhone').value);
    if (!role || !name) return showErr('#phError', 'سمت و نام را کامل وارد کنید.');
    if (!validAnyPhone(phone)) return showErr('#phError', 'شماره باید ۱۱ رقم و با ۰۹ یا ۰۱۱ شروع شود.');
    schoolPhones.push({ id: uid(), role, name, phone, icon: 'fa-phone' });
    savePhones();
    closeModal();
    renderAdminSettings();
    renderHome();
    toast('<i class="fas fa-circle-check"></i> شمارهٔ جدید اضافه شد.');
}
function openPhoneEdit(id) {
    if (!can('phones')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید.');
    const p = schoolPhones.find(x => x.id === id);
    if (!p) return;
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-pen"></i> ویرایش شمارهٔ مدرسه</h3>
        <form onsubmit="submitPhoneEdit(event,'${id}')">
            <label class="form-label">سمت / عنوان<input class="form-input" id="phE_Role" required value="${esc(p.role)}"></label>
            <label class="form-label">نام<input class="form-input" id="phE_Name" required value="${esc(p.name)}"></label>
            <label class="form-label">شماره تلفن<input class="form-input" id="phE_Phone" required dir="ltr" value="${p.phone}"></label>
            <div class="form-error" id="phE_Error" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:16px" type="submit"><i class="fas fa-floppy-disk"></i> ذخیرهٔ تغییرات</button>
        </form>`);
}
function submitPhoneEdit(e, id) {
    e.preventDefault();
    const p = schoolPhones.find(x => x.id === id);
    if (!p) return;
    const role = $('#phE_Role').value.trim(), name = $('#phE_Name').value.trim();
    const phone = normPhone($('#phE_Phone').value);
    if (!role || !name) return showErr('#phE_Error', 'سمت و نام را کامل وارد کنید.');
    if (!validAnyPhone(phone)) return showErr('#phE_Error', 'شماره باید ۱۱ رقم و با ۰۹ یا ۰۱۱ شروع شود.');
    p.role = role; p.name = name; p.phone = phone;
    savePhones();
    closeModal();
    renderAdminSettings();
    renderHome();
    toast('<i class="fas fa-circle-check"></i> شمارهٔ ویرایش شد.');
}
function deletePhone(id, btn) {
    if (!can('phones')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید.');
    if (!confirmBtn(btn, 'حذف شماره؟')) return;
    schoolPhones = schoolPhones.filter(p => p.id !== id);
    savePhones();
    renderAdminSettings();
    renderHome();
    toast('<i class="fas fa-trash"></i> شماره حذف شد.');
}

/* ---------- پنل استادها ---------- */
function renderTeacher() {
    if (!session.teacherId) return;
    purgeOldTLog();
    const me = teacherById(session.teacherId);
    if (!me) { logoutTeacher(); return; }
    const today = dateKey();
    const myLog = tlog.find(l => l.tid === me.id && l.dkey === today);
    const status = !myLog ? '<span class="badge badge-info">امروز ورود ثبت نکرده‌اید</span>'
        : (myLog.leftAt ? `<span class="badge badge-ok">روز کاری تمام شد</span>` : `<span class="badge badge-warn">در مدرسه هستید (ورود ${fa(myLog.cameAt)})</span>`);
    const leaveBtn = `<button class="btn btn-blue btn-sm" onclick="openLeaveRequest()"><i class="fas fa-plane-departure"></i> درخواست مرخصی</button>`;
    // ساخت کارت برای هر درس در هر کلاس
    const cards = Object.entries(me.cls).flatMap(([c, subs]) => {
        const kids = students.filter(s => s.cls === c);
        const list = Array.isArray(subs) ? subs.filter(Boolean) : [subs].filter(Boolean);
        if (!list.length) return [];
        return list.map(sub => `
        <div class="class-card" onclick="openTeacherClsSub('${c}','${esc(sub)}')">
            <div class="class-ic"><i class="fas fa-book-open"></i></div>
            <h4>کلاس ${CLASS_LABEL[c]}</h4>
            <span class="badge badge-gold" style="margin:6px 0">درس ${esc(sub)}</span>
            <span style="display:block">${fa(kids.length)} دانش‌آموز</span>
        </div>`);
    }).join('');

    $('#teacherBody').innerHTML = `
        <div class="row-card" style="margin-bottom:18px">
            <div class="row-main">
                <div class="row-title"><i class="fas fa-chalkboard-user" style="color:var(--g600)"></i> ${STAD} ${esc(me.name)} ${status}</div>
                <div class="row-meta">${Object.entries(me.cls).map(([c, sub]) => CLASS_LABEL[c] + ': ' + escSP(sub)).join(' — ')}</div>
            </div>
            <div class="row-actions">                ${leaveBtn}
                <button class="btn btn-green btn-sm" onclick="teacherCame()"><i class="fas fa-door-open"></i> ثبت ورود من</button>
                <button class="btn btn-outline-dark btn-sm" onclick="teacherLeft()"><i class="fas fa-door-closed"></i> ثبت خروج من</button>
            </div>
        </div>
        ${leaves.filter(l => l.tid === me.id && !l.deletedForMe).length ? `<h4 style="margin:10px 0 14px"><i class="fas fa-list"></i> درخواست‌های مرخصی من</h4>
        <div class="rows" style="margin-bottom:20px">
            ${leaves.filter(l => l.tid === me.id && !l.deletedForMe).sort((a,b)=> b.at - a.at).map(l => `
                <div class="row-card">
                    <div class="row-main">
                        <div class="row-title">${esc(l.text)}</div>
                        <div class="row-meta">تاریخ درخواست: ${l.dateFa}</div>
                    </div>
                    <div class="row-actions">
                        ${l.status === 'pending' ? '<span class="badge badge-warn">بدون جواب</span>' : (l.status === 'accepted' ? '<span class="badge badge-ok">قبول شد</span>' : '<span class="badge badge-danger">رد شد</span>')}
                        ${l.status === 'pending' ? `<button class="btn btn-ghost btn-sm" onclick="editLeaveRequest('${l.id}')"><i class="fas fa-pen"></i> ویرایش</button>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>` : ''}
        <p class="tab-sub">فقط کلاس‌ها و درس‌های خودتان — هر درسِ هر کلاس یک بخش جداگانه است.</p>
        <div class="class-grid">${cards || '<p style="color:var(--muted)">کلاسی برای شما ثبت نشده است.</p>'}</div>`;
}
function teacherCame() {
    if (!session.teacherId) return;
    const today = dateKey();
    let l = tlog.find(x => x.tid === session.teacherId && x.dkey === today);
    if (!l) {
        l = { id: uid(), tid: session.teacherId, dkey: today, day: faDay(), dateFa: faDate(), cameAt: null, leftAt: null, by: STAD_PLAIN, at: Date.now() };
        tlog.push(l);
    }
    if (!l.cameAt) l.cameAt = faTime();
    saveTLog();
    renderTeacher();
    toast('<i class="fas fa-door-open"></i> ورود شما در ساعت ' + l.cameAt + ' ثبت شد — مدیر می‌بیند.');
}
function teacherLeft() {
    if (!session.teacherId) return;
    const today = dateKey();
    const l = tlog.find(x => x.tid === session.teacherId && x.dkey === today);
    if (!l || !l.cameAt) return toast('<i class="fas fa-triangle-exclamation"></i> اول «ثبت ورود» را بزنید.');
    if (l.leftAt) return toast('<i class="fas fa-circle-info"></i> خروج قبلاً در ساعت ' + l.leftAt + ' ثبت شده.');
    l.leftAt = faTime();
    saveTLog();
    renderTeacher();
    toast('<i class="fas fa-door-closed"></i> خروج شما در ساعت ' + l.leftAt + ' ثبت شد.');
}
function setTeacherClass(c) { teacherCls = c; teacherSub = null; renderTeacherClass(); }
/* ورود مستقیم به بخش یک درس، که از کارت‌های صفحهٔ اصلی استاد */
function openTeacherClsSub(c, sub) {
    teacherCls = c;
    const me = teacherById(session.teacherId);
    // تبدیل درس‌ها به آرایه (حتی اگر فقط ۱ درس باشد)
    const mySubs = Array.isArray(me?.cls[c]) ? me.cls[c].filter(Boolean) : [me?.cls[c]].filter(Boolean);
    teacherSub = mySubs.includes(sub) ? sub : mySubs[0];
    renderTeacherClass();
}
let teacherCls = null;
let teacherSub = null;   // درسِ انتخاب‌شده در کلاس جاری (فقط از درس‌های خود استاد)
function renderTeacherClass() {
    if (!session.teacherId) return;
    purgeOldAttendance();
    if (!teacherCls) return renderTeacher();
    const me = teacherById(session.teacherId);
    if (!me) return;
    
    const mySubs = Array.isArray(me.cls[teacherCls]) ? me.cls[teacherCls].filter(Boolean) : [me.cls[teacherCls]].filter(Boolean);
    if (!mySubs.length) { teacherCls = null; teacherSub = null; return renderTeacher(); } 
    
    if (!teacherSub || !mySubs.includes(teacherSub)) teacherSub = mySubs[0];
    const subject = teacherSub;
    const kids = students.filter(s => s.cls === teacherCls);
    const today = dateKey();
    const kidIds = kids.map(k => k.id);
    const subGrades = grades.filter(g => g.subject === subject && kidIds.includes(g.studentId));
    const clsAvg = subGrades.length ? subGrades.reduce((x, g) => x + g.score, 0) / subGrades.length : null;
    const gradedKids = kids.filter(k => grades.some(g => g.studentId === k.id && g.subject === subject));
    const best = subGrades.length ? Math.max(...subGrades.map(g => g.score)) : null;
    const worst = subGrades.length ? Math.min(...subGrades.map(g => g.score)) : null;
    
    // دکمه‌های تغییر سریع بین درس‌ها
    const subChips = mySubs.length > 1
        ? `<div class="chip-row" style="margin:12px 0 4px">${mySubs.map(s => `<button class="chip ${teacherSub === s ? 'active' : ''}" onclick="setTeacherSub('${esc(s)}')">${esc(s)}</button>`).join('')}</div>`
        : '';
        
    $('#teacherBody').innerHTML = `

        <div class="toolbar">
            <button class="btn btn-outline-dark btn-sm" onclick="teacherCls=null; teacherSub=null; renderTeacher()"><i class="fas fa-arrow-right"></i> همهٔ کلاس‌ها</button>
            <b style="font-size:1rem">کلاس ${CLASS_LABEL[teacherCls]}</b>
            <span class="badge badge-gold">درس شما: ${esc(subject)}</span>
        </div>
        ${subChips}
        <div class="row-card" style="margin-bottom:18px">
            <div class="row-main">
                <div class="row-title"><i class="fas fa-chart-simple" style="color:var(--g600)"></i> میانگین کلاس شما — درس ${esc(subject)}
                    ${clsAvg !== null ? `<span class="badge badge-ok">میانگین کلاس: ${fa(clsAvg.toFixed(2))}</span>` : '<span class="badge badge-info">هنوز نمره‌ای ثبت نشده</span>'}
                </div>
                <div class="row-meta">${clsAvg !== null ? `${fa(subGrades.length)} نمرهٔ ثبت‌شدهٔ شما در این کلاس — بالاترین: ${fa(best)} — پایین‌ترین: ${fa(worst)} — از ${fa(kids.length)} دانش‌آموزِ کلاس، ${fa(gradedKids.length)} نفر در درس شما نمره دارند.` : 'با ثبت اولین نمره، میانگین کلاس همین‌جا نمایش داده می‌شود.'}</div>
            </div>
        </div>
                <div class="row-card" style="margin-bottom:18px; border-right:4px solid var(--gold)">
            <div class="row-main">
                <div class="row-title"><i class="fas fa-bullhorn" style="color:var(--gold)"></i> اطلاعیه‌ها و تکالیف این درس</div>
                <div class="row-meta">اطلاعیه‌ای برای دانش‌آموزان این کلاس در درس ${esc(subject)} ثبت کنید.</div>
            </div>
            <div class="row-actions">
                <button class="btn btn-gold btn-sm" onclick="openTeacherNoticeAdd('${teacherCls}', '${esc(subject)}')"><i class="fas fa-plus"></i> ثبت اطلاعیه / تکلیف</button>
            </div>
        </div>
        <div class="history" style="margin-bottom:24px">
            ${teacherNotices.filter(n => n.cls === teacherCls && n.subject === subject).sort((a,b)=> b.at - a.at).map(n => `
                <div class="h-item" style="align-items:flex-start">
                    <span class="h-date" style="min-width:120px; font-size:.8rem"><i class="far fa-clock"></i> ${n.dateFa} - ${n.time}</span>
                    <span style="flex:1">${esc(n.text)}</span>
                    <button class="btn btn-del btn-sm" onclick="deleteTeacherNotice('${n.id}',this)"><i class="fas fa-trash"></i></button>
                </div>
            `).join('') || '<p style="font-size:.85rem;color:var(--muted)">هنوز اطلاعیه‌ای برای این درس ثبت نشده است.</p>'}
        </div>
        <div class="students-grid">${kids.length ? kids.map(s => {
            const t = attendance.find(a => a.studentId === s.id && a.dkey === today);
            const badge = !t ? '<span class="badge badge-info">ثبت نشده</span>' : (t.status === 'present' ? '<span class="badge badge-ok">حاضر</span>' : '<span class="badge badge-danger">غایب</span>');
            const sg = grades.filter(g => g.studentId === s.id && g.subject === subject);
            const sa = sg.length ? sg.reduce((x, g) => x + g.score, 0) / sg.length : null;
            return `
            <div class="stu-card" onclick="openStudentModal('${s.id}',false,false)">
                <div class="stu-avatar">${esc(s.name.trim()[0] || '؟')}</div>
                <div class="stu-name">${esc(s.name)}</div>
                <div class="stu-meta"><span dir="ltr">${fa(s.mobile)}</span><br>ولی: ${esc(s.parentName)}</div>
                <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge}
                    ${sa !== null ? `<span class="badge ${sa >= 17 ? 'badge-ok' : sa >= 10 ? 'badge-info' : 'badge-danger'}">میانگین ${esc(subject)}: ${fa(sa.toFixed(1))} (${fa(sg.length)} نمره)</span>` : '<span class="badge badge-gold">در درس شما نمره ندارد</span>'}
                    <button class="btn btn-gold btn-sm" style="margin-right:auto" onclick="event.stopPropagation(); gradeStudent('${s.id}')"><i class="fas fa-star"></i> ثبت نمرهٔ ${esc(subject)}</button>
                </div>
            </div>`;
        }).join('') : '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-user-graduate"></i><p>این کلاس هنوز دانش‌آموزی ندارد.</p></div>'}
        </div>`;
}

/* --- نمره‌گذاری (استاد) --- */
function gradeStudent(sid) {
    const s = studentById(sid);
    const me = teacherById(session.teacherId);
    if (!s || !me) return;
    const subject = teacherSub || subJ(me.cls[teacherCls]);
    if (!subject) return toast('کلاس و درس جاری برای شما ثبت نشده است.');
    const list = grades.filter(g => g.studentId === sid && g.subject === subject).sort((a, b) => b.at - a.at);
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-star"></i> ثبت نمره — ${esc(s.name)}</h3>
        <p style="font-size:.85rem;color:var(--muted)">کلاس ${CLASS_LABEL[teacherCls]} — درس: <b>${esc(subject)}</b> (فقط درس خودتان)</p>
        <form onsubmit="submitGrade(event,'${sid}','${esc(subject)}')">
            <div class="form-row">
                <label class="form-label">نمره (از ۲۰)<input class="form-input" id="grScore" required type="number" min="0" max="20" step="0.25" dir="ltr" placeholder="مثلاً 18.5"></label>
                <label class="form-label">توضیح (اختیاری)<input class="form-input" id="grNote" placeholder="مثلاً: میان‌ترم، آزمون کلاسی…"></label>
            </div>
            <div class="form-error" id="grError" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:16px" type="submit"><i class="fas fa-floppy-disk"></i> ثبت نمره</button>
        </form>
        <div class="divider"></div>
        <h4 style="font-size:.9rem;margin-bottom:8px">نمرات قبلی ${esc(subject)} این دانش‌آموز</h4>
        <div class="history" style="max-height:150px;overflow-y:auto">${list.length ? list.map(g => `
            <div class="h-item">
                <span class="badge ${g.score >= 17 ? 'badge-ok' : g.score >= 10 ? 'badge-info' : 'badge-danger'}">${fa(g.score)}</span>
                ${g.note ? `<span class="h-times">${esc(g.note)}</span>` : ''}
                <span class="h-times">${g.dateFa}</span>
                <button class="btn btn-del btn-sm" style="margin-right:auto" onclick="deleteGrade('${g.id}',this)"><i class="fas fa-trash"></i></button>
            </div>`).join('') : '<p style="font-size:.8rem;color:var(--muted)">نمره‌ای نیست.</p>'}
        </div>`);
}
function submitGrade(e, sid, subject) {
    e.preventDefault();
    const score = parseFloat(toEn($('#grScore').value));
    const note = $('#grNote').value.trim();
    if (isNaN(score) || score < 0 || score > 20) return showErr('#grError', 'نمره بین ۰ تا ۲۰ باشد.');
    grades.push({ id: uid(), studentId: sid, subject, dkey: dateKey(), dateFa: faDate(), score, note, by: sessionLabel(), at: Date.now() });
    saveGrades();
    closeModal();
    renderTeacherClass();
    toast('<i class="fas fa-star"></i> نمرهٔ ' + fa(score) + ' در ' + esc(subject) + ' ثبت شد.');
}

/* --- چاپ کارنامه --- */
function printReport(sid) {
    const s = studentById(sid);
    if (!s) return;
    const myGr = grades.filter(g => g.studentId === sid);
    const bySub = {};
    myGr.forEach(g => { (bySub[g.subject] = bySub[g.subject] || []).push(g.score); });
    const avg = studentAvg(sid);
    const merit = s.merit ?? 20;
    const rows = Object.entries(bySub).map(([sub, arr]) => {
        const a = arr.reduce((x, y) => x + y, 0) / arr.length;
        return `<tr><td>${esc(sub)}</td><td>${fa(arr.length)}</td><td><b>${fa(a.toFixed(1))}</b></td></tr>`;
    }).join('');
    const w = window.open('', '_blank');
    if (!w) return toast('پنجرهٔ چاپ بسته شد — popup را اجازه دهید.');
    w.document.write(`<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>کارنامه — ${esc(s.name)}</title>
    <style>body{font-family:Tahoma,sans-serif;padding:30px;color:#111}h1{text-align:center;color:#065f46;font-size:1.4rem}h2{text-align:center;font-size:1.1rem;font-weight:normal;color:#333}
    table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #999;padding:8px 12px;text-align:center}th{background:#065f46;color:#fff}
    .meta{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:14px 0;line-height:2.2}
    .print-btn{display:block;margin:20px auto;padding:10px 30px;background:#059669;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:1rem}
    @media print{.print-btn{display:none}}</style></head><body>
    <h1>🎓 دبیرستان شهید حسین اشرفی</h1>
    <h2>کارنامهٔ ${esc(s.name)} — کلاس ${CLASS_LABEL[s.cls]}</h2>
    <div class="meta">اولیا: ${esc(s.parentName)} — تماس: <span dir="ltr">${fa(s.parentPhone)}</span> — نمرهٔ انضباط: <b>${fa(merit)}</b> از ۲۰ — تاریخ چاپ: ${faDate()}</div>
    <table><tr><th>درس</th><th>تعداد نمره</th><th>میانگین</th></tr>${rows || '<tr><td colspan="3">نمره‌ای ثبت نشده است</td></tr>'}
    ${avg !== null ? `<tr><th colspan="2">میانگین کل</th><th>${fa(avg.toFixed(1))}</th></tr>` : ''}</table>
    <button class="print-btn" onclick="window.print()">🖨 چاپ</button>
    </body></html>`);
    w.document.close();
}

/* --- خروجی کارنامه: اکسل (xls) و CSV — فایل دانلود می‌شود؛ در لپ‌تاپ با اکسل و در گوشی با شیت/برنامه‌های مشابه باز می‌شود --- */
function downloadFile(content, name, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function reportData(sid) {
    const s = studentById(sid);
    if (!s) return null;
    const myGr = grades.filter(g => g.studentId === sid).sort((a, b) => a.at - b.at);
    const bySub = {};
    myGr.forEach(g => { (bySub[g.subject] = bySub[g.subject] || []).push(g.score); });
    return { s, myGr, bySub, avg: studentAvg(sid), merit: s.merit ?? 20 };
}
function exportReport(sid, fmt) {
    const d = reportData(sid);
    if (!d) return;
    const base = 'کارنامه-' + d.s.name.trim().replace(/\s+/g, '-');
    if (fmt === 'csv') return exportCsv(d, base + '.csv');
    exportXls(d, base + '.xls');
}
function exportXls(d, fname) {
    const { s, myGr, bySub, avg, merit } = d;
    const subRows = Object.entries(bySub).map(([sub, arr]) => {
        const a = arr.reduce((x, y) => x + y, 0) / arr.length;
        return `<tr><td>${esc(sub)}</td><td>${fa(arr.length)}</td><td>${fa(a.toFixed(2))}</td></tr>`;
    }).join('');
    const allRows = myGr.map(g => `<tr><td>${esc(g.subject)}</td><td>${fa(g.score)}</td><td>${esc(g.note || '')}</td><td>${g.dateFa}</td><td>${esc(g.by || '')}</td></tr>`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>کارنامه</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body dir="rtl">
<table border="1"><tr><td colspan="5" style="background:#065f46;color:#fff;font-weight:bold;font-size:14pt">🎓 دبیرستان شهید حسین اشرفی — کارنامهٔ ${esc(s.name)}</td></tr>
<tr><td>کلاس</td><td>${CLASS_LABEL[s.cls]}</td><td>اولیا</td><td>${esc(s.parentName)}</td><td>تماس: ${fa(s.parentPhone)}</td></tr>
<tr><td>نمرهٔ انضباط</td><td>${fa(merit)} از ۲۰</td><td colspan="3">تاریخ خروجی: ${faDate()}</td></tr></table>
<br><table border="1"><tr style="background:#065f46;color:#fff"><th>درس</th><th>تعداد نمره</th><th>میانگین</th></tr>${subRows || '<tr><td colspan="3">نمره‌ای ثبت نشده است</td></tr>'}${avg !== null ? `<tr style="background:#fef3c7;font-weight:bold"><td>میانگین کل</td><td></td><td>${fa(avg.toFixed(2))}</td></tr>` : ''}</table>
<br><table border="1"><tr style="background:#065f46;color:#fff"><th>درس</th><th>نمره</th><th>توضیح</th><th>تاریخ</th><th>ثبت‌کننده</th></tr>${allRows || '<tr><td colspan="5">نمره‌ای ثبت نشده است</td></tr>'}</table>
</body></html>`;
    downloadFile('\uFEFF' + html, fname, 'application/vnd.ms-excel;charset=utf-8');
    toast('<i class="fas fa-file-excel"></i> فایل اکسل کارنامه دانلود شد — در لپ‌تاپ با اکسل و در گوشی با شیت بازش کنید.');
}
function exportCsv(d, fname) {
    const { s, myGr, bySub, avg, merit } = d;
    const q = (c) => '"' + String(c ?? '').replace(/"/g, '""') + '"';
    const rows = [
        ['دبیرستان شهید حسین اشرفی — کارنامهٔ ' + s.name],
        ['کلاس', CLASS_LABEL[s.cls], 'اولیا', s.parentName, 'تماس', s.parentPhone],
        ['نمرهٔ انضباط', merit + ' از ۲۰', 'تاریخ خروجی', faDate()],
        [],
        ['درس', 'نمره', 'توضیح', 'تاریخ', 'ثبت‌کننده'],
        ...myGr.map(g => [g.subject, g.score, g.note || '', g.dateFa, g.by || '']),
        [],
        ['درس', 'تعداد نمره', 'میانگین'],
        ...Object.entries(bySub).map(([sub, arr]) => [sub, arr.length, (arr.reduce((x, y) => x + y, 0) / arr.length).toFixed(2)]),
        ...(avg !== null ? [['میانگین کل', '', avg.toFixed(2)]] : [])
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(q).join(',')).join('\r\n');
    downloadFile(csv, fname, 'text/csv;charset=utf-8');
    toast('<i class="fas fa-file-csv"></i> فایل CSV کارنامه دانلود شد.');
}

/* ---------- راه‌اندازی ---------- */
$('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

/* ---------- آپلود اکسل دانش‌آموزان ---------- */
function openExcelUpload() {
    if (!can('addStudent')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید.');
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-file-excel" style="color:var(--ok)"></i> آپلود فایل اکسل</h3>
        <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px">
            ستون‌های فایل اکسل باید دقیقاً به این ترتیب باشد:<br>
            <b>نام</b> | <b>کلاس (مثل 7a)</b> | <b>موبایل</b> | <b>نام اولیا</b> | <b>موبایل اولیا</b> | <b>رمز</b>
        </p>
        <input type="file" id="excelFile" accept=".xlsx, .xls" class="form-input" style="padding:10px">
        <div class="form-error" id="excelError" hidden style="margin-top:10px"></div>
        <button class="btn btn-gold btn-block" style="margin-top:16px" onclick="processExcel()"><i class="fas fa-upload"></i> خواندن و ثبت دانش‌آموزان</button>
    `);
}

function processExcel() {
    hideErr('#excelError');
    const fileInput = $('#excelFile');
    if (!fileInput.files.length) return showErr('#excelError', 'لطفاً ابتدا یک فایل اکسل انتخاب کنید.');
    
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            let addedCount = 0;
            let errors = [];

            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || !row[0]) continue; 

                // 1. خواندن نام و نام خانوادگی از دو ستون جداگانه
                const firstName = String(row[0] || '').trim(); // ستون A
                const lastName = String(row[1] || '').trim();  // ستون B
                const name = (firstName + ' ' + lastName).trim(); // چسباندن نام و فامیلی با هم
                
                // 2. خواندن بقیه اطلاعات (چون یک ستون اضافه شد، بقیه یکی به راست رفتن)
                const cls = String(row[2] || '').trim().toLowerCase().replace(/\s/g, ''); // ستون C
                let mobile = normPhone(row[3] || '');
                if (mobile.startsWith('9') && mobile.length === 10) mobile = '0' + mobile; // ستون D
                const parentName = String(row[4] || '').trim(); // ستون E
                let parentPhone = normPhone(row[5] || '');
                if (parentPhone.startsWith('9') && parentPhone.length === 10) parentPhone = '0' + parentPhone; // ستون F
                const pass = String(row[6] || '').trim() || '1234'; // ستون G

                // 3. اعتبارسنجی‌ها (چک کردن اینکه اطلاعات درست باشن)
                if (!CLASSES.includes(cls)) { errors.push(`خط ${i+1}: کلاس "${cls}" نامعتبر است (باید مثل 7a باشد).`); continue; }
                if (!validPhone(mobile)) { errors.push(`خط ${i+1}: موبایل دانش‌آموز نامعتبر است.`); continue; }
                if (students.some(s => s.mobile === mobile)) { errors.push(`خط ${i+1}: موبایل ${mobile} قبلاً ثبت شده است.`); continue; }
                if (!parentName) { errors.push(`خط ${i+1}: نام اولیا خالی است.`); continue; }
                if (parentPhone && !validPhone(parentPhone)) { errors.push(`خط ${i+1}: موبایل اولیا نامعتبر است.`); continue; }

                // 4. اضافه کردن به سیستم
                students.push({
                    id: uid(), name, cls, mobile, parentName, 
                    parentPhone: parentPhone || mobile, 
                    pass, merit: 20, at: Date.now()
                });
                addedCount++;
            }

            if (addedCount > 0) {
                saveStudents();
                closeModal();
                renderAdminStudents();
                refreshAfterAttendance();
                toast(`<i class="fas fa-circle-check"></i> ${fa(addedCount)} دانش‌آموز با موفقیت از اکسل اضافه شد.`);
            }

            if (errors.length > 0) {
                openModal(`
                    <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
                    <h3 class="modal-title" style="color:var(--danger)"><i class="fas fa-triangle-exclamation"></i> برخی خطوط ثبت نشدند</h3>
                    <p style="font-size:.85rem;color:var(--muted)">تعداد <b>${fa(addedCount)}</b> نفر ثبت شد، اما این خطوط مشکل داشتند:</p>
                    <div class="history" style="max-height:200px;overflow-y:auto">
                        ${errors.map(err => `<div class="h-item" style="color:var(--danger)">${esc(err)}</div>`).join('')}
                    </div>
                    <button class="btn btn-gold btn-block" style="margin-top:16px" onclick="closeModal(); setAdminTab('students');"><i class="fas fa-check"></i> متوجه شدم</button>
                `);
            }

        } catch (err) {
            showErr('#excelError', 'خطا در خواندن فایل. آیا فایل شما یک اکسل معتبر است؟');
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
}

/* ---------- ارتقای خودکار پایه تحصیلی ---------- */
function openPromoteStudents() {
    if (session.admin !== 'مدیر') return toast('<i class="fas fa-lock"></i> فقط مدیر کل می‌تواند این کار را انجام دهد.');
    
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title" style="color:var(--danger)"><i class="fas fa-arrow-up-right-dots"></i> ارتقای پایه تحصیلی</h3>
        <p style="font-size:.88rem;color:var(--muted);margin-bottom:14px">
            با کلیک روی دکمه زیر، تمام دانش‌آموزان پایه هفتم به هشتم و هشتم به نهم منتقل می‌شوند.<br>
            <b>هشدار:</b> دانش‌آموزان پایه نهم فارغ‌التحصیل شده و از سیستم حذف می‌شوند!
        </p>
        <form onsubmit="executePromotion(event)">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.85rem;margin-bottom:16px">
                <input type="checkbox" id="promoConfirm" required>
                <span>تایید می‌کنم که می‌خواهم این تغییرات را اعمال کنم.</span>
            </label>
            <button class="btn btn-danger btn-block" type="submit"><i class="fas fa-check-double"></i> اجرای ارتقای سالانه</button>
        </form>
    `);
}

function executePromotion(e) {
    e.preventDefault();
    if (!$('#promoConfirm').checked) return;
    
    let count7to8 = 0;
    let count8to9 = 0;
    let count9grad = 0;

    // فیلتر کردن دانش‌آموزان پایه نهم (حذف)
    const students9 = students.filter(s => s.cls.startsWith('9'));
    count9grad = students9.length;
    
    // حذف کل سوابق دانش‌آموزان نهم
    const gradIds = students9.map(s => s.id);
    students = students.filter(s => !s.cls.startsWith('9'));
    attendance = attendance.filter(a => !gradIds.includes(a.studentId));
    grades = grades.filter(g => !gradIds.includes(g.studentId));
    discipline = discipline.filter(d => !gradIds.includes(d.studentId));

    // ارتقای هشتم‌ها به نهم
    students.forEach(s => {
        if (s.cls.startsWith('8')) {
            s.cls = s.cls.replace('8', '9');
            count8to9++;
        } else if (s.cls.startsWith('7')) {
            s.cls = s.cls.replace('7', '8');
            count7to8++;
        }
    });

    // ذخیره تغییرات
    saveStudents();
    saveAttendance();
    saveGrades();
    saveDiscipline();
    
    closeModal();
    renderAdminTab();
    toast(`<i class="fas fa-circle-check"></i> ارتقا انجام شد: ${fa(count7to8)} نفر به هشتم، ${fa(count8to9)} نفر به نهم رفتند و ${fa(count9grad)} نفر فارغ‌التحصیل شدند.`);
}

/* ---------- درخواست مرخصی استاد ---------- */
function openLeaveRequest() {
    if (!session.teacherId) return;
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-plane-departure" style="color:var(--blue)"></i> ثبت درخواست مرخصی</h3>
        <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px">توضیح دهید چرا نمی‌توانید بیایید (مثلاً: زنگ ریاضی هفتم B، مشکل شخصی داشتم).</p>
        <form onsubmit="submitLeaveRequest(event)">
            <label class="form-label">متن درخواست / دلیل غیبت
                <textarea class="form-input" id="leaveText" rows="3" required placeholder="مثلاً: زنگ دوم ریاضی کلاس هفتم A، بابت مریضی نمی‌توانم بیایم."></textarea>
            </label>
            <button class="btn btn-blue btn-block" style="margin-top:16px" type="submit"><i class="fas fa-paper-plane"></i> ارسال به مدیر</button>
        </form>
    `);
}

function submitLeaveRequest(e) {
    e.preventDefault();
    const text = $('#leaveText').value.trim();
    if (!text) return;
    const me = teacherById(session.teacherId);
    leaves.push({
        id: uid(), tid: me.id, teacherName: me.name, text: text, status: 'pending', dateFa: faDate(), at: Date.now()
    });
    saveLeaves();
    closeModal();
    renderTeacher();
    toast('<i class="fas fa-circle-check"></i> درخواست مرخصی شما برای مدیر ارسال شد.');
}
/* ---------- ویرایش درخواست مرخصی توسط معلم ---------- */
function editLeaveRequest(id) {
    if (!session.teacherId) return;
    const l = leaves.find(x => x.id === id);
    if (!l || l.status !== 'pending') return; // فقط درخواست‌های بی‌جواب قابل ویرایش هستند

    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-pen" style="color:var(--blue)"></i> ویرایش درخواست مرخصی</h3>
        <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px">می‌توانید متن درخواست خود را اصلاح کنید.</p>
        <form onsubmit="submitEditLeave(event, '${id}')">
            <label class="form-label">متن درخواست / دلیل غیبت
                <textarea class="form-input" id="editLeaveText" rows="3" required>${esc(l.text)}</textarea>
            </label>
            <button class="btn btn-blue btn-block" style="margin-top:16px" type="submit"><i class="fas fa-floppy-disk"></i> ذخیره تغییرات</button>
        </form>
    `);
}

function submitEditLeave(e, id) {
    e.preventDefault();
    const text = $('#editLeaveText').value.trim();
    if (!text) return;
    const l = leaves.find(x => x.id === id);
    if (!l) return;
    
    l.text = text;
    saveLeaves();
    closeModal();
    renderTeacher();
    toast('<i class="fas fa-circle-check"></i> متن درخواست شما ویرایش شد.');
}
/* ---------- ثبت اطلاعیه/تکلیف توسط معلم ---------- */
function openTeacherNoticeAdd(cls, subject) {
    if (!session.teacherId) return;
    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-bullhorn" style="color:var(--gold)"></i> ثبت اطلاعیه</h3>
        <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px">کلاس ${CLASS_LABEL[cls]} — درس ${esc(subject)}</p>
        <form onsubmit="submitTeacherNotice(event, '${cls}', '${esc(subject)}')">
            <label class="form-label">متن اطلاعیه یا تکلیف
                <textarea class="form-input" id="tnText" rows="3" required placeholder="مثلاً: فردا امتحان میان‌ترم از فصل ۱ و ۲ داریم. لطفاً کتاب‌ها را بیاورید."></textarea>
            </label>
            <button class="btn btn-gold btn-block" style="margin-top:16px" type="submit"><i class="fas fa-paper-plane"></i> ثبت اطلاعیه</button>
        </form>
    `);
}

function submitTeacherNotice(e, cls, subject) {
    e.preventDefault();
    const text = $('#tnText').value.trim();
    if (!text) return;
    
    teacherNotices.push({
        id: uid(),
        tid: session.teacherId,
        cls: cls,
        subject: subject,
        text: text,
        dateFa: faDate(),
        time: faTime(),
        at: Date.now()
    });
    saveTeacherNotices();
    closeModal();
    renderTeacherClass();
    toast('<i class="fas fa-circle-check"></i> اطلاعیه با موفقیت ثبت شد.');
}

/* ---------- حذف اطلاعیه توسط معلم ---------- */
function deleteTeacherNotice(id, btn) {
    if (!confirmBtn(btn, 'حذف اطلاعیه؟')) return;
    teacherNotices = teacherNotices.filter(n => n.id !== id);
    saveTeacherNotices();
    renderTeacherClass();
    toast('<i class="fas fa-trash"></i> اطلاعیه حذف شد.');
}
(function init() {
    loadData();
    migrateTeacherCls();
    // بازیابی نشست‌ها
    const sa = ls.get('hs_admin', null); if (sa) session.admin = sa;
    const stid = ls.get('hs_teacher', null);
    if (stid && typeof stid === 'string' && teacherById(stid)) session.teacherId = stid; else if (stid) ls.del('hs_teacher');
    const ss = ls.get('hs_student', null); if (ss && studentById(ss)) session.studentId = ss;
    $('#todayText').textContent = faDate();
    renderHome();
    updateHeader();
    show(session.admin ? 'admin' : (session.teacherId ? 'teacher' : (session.studentId ? 'student' : 'home')));
    if (currentView === 'admin') setAdminTab('dash');
})();

/* ---------- تایید یا رد مرخصی توسط مدیر ---------- */
function setLeaveStatus(id, status) {
    if (!session.admin) return;
    const l = leaves.find(x => x.id === id);
    if (!l) return;
    l.status = status;
    saveLeaves();
    renderAdminTeachers();
    toast(`<i class="fas fa-circle-check"></i> درخواست ${status === 'accepted' ? 'قبول' : 'رد'} شد.`);
}
/* ---------- ویرایش کامل استاد توسط مدیر ---------- */
function openTeacherEdit(tid) {
    if (!can('addTeacher')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید.');
    const t = teacherById(tid);
    if (!t) return;

    // ساخت چک‌باکس‌ها و انتخاب درس‌ها
    const clsRows = CLASSES.map(c => {
        const isChecked = t.cls[c] ? 'checked' : '';
        const subs = Array.isArray(t.cls[c]) ? t.cls[c] : (t.cls[c] ? [t.cls[c]] : []);
        const options = subjectsOf(c).map(s => `<option value="${s}" ${subs.includes(s) ? 'selected' : ''}>${s}</option>`).join('');
        
        return `
        <div class="check-line">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" id="etc_${c}" onchange="toggleTClsAdmin('${c}',this.checked)" ${isChecked}>
                <b>${CLASS_LABEL[c]}</b>
            </label>
            <select class="form-select" id="etsub_${c}" multiple ${isChecked ? '' : 'hidden'} style="margin-top:8px;min-height:64px">
                ${options}
            </select>
        </div>`;
    }).join('');

    openModal(`
        <button class="modal-close" onclick="closeModal()"><i class="fas fa-xmark"></i></button>
        <h3 class="modal-title"><i class="fas fa-pen"></i> ویرایش اطلاعات ${STAD}</h3>
        <form onsubmit="submitTeacherEdit(event, '${tid}')">
            <label class="form-label">نام و نام خانوادگی<input class="form-input" id="etrName" required value="${esc(t.name)}"></label>
            <div class="form-row">
                <label class="form-label">شماره موبایل<input class="form-input" id="etrPhone" required dir="ltr" value="${t.phone}"></label>
                <label class="form-label">رمز عبور شخصی
                    <span class="pass-wrap">
                        <input class="form-input" id="etrPass" required type="password" value="${esc(t.pass)}">
                        <button type="button" class="eye-btn" onclick="togglePass('etrPass',this)" title="نمایش رمز"><i class="fas fa-eye"></i></button>
                    </span>
                </label>
            </div>
            <div class="form-label" style="margin-top:14px">کلاس‌ها و درس‌ها (برای هر کلاس چند درس قابل انتخاب است)</div>
            <div class="check-grid">${clsRows}</div>
            <div class="form-error" id="etrError" hidden></div>
            <button class="btn btn-gold btn-block" style="margin-top:14px" type="submit"><i class="fas fa-floppy-disk"></i> ذخیره تغییرات</button>
        </form>
    `);
}

function submitTeacherEdit(e, tid) {
    e.preventDefault();
    if (!can('addTeacher')) return toast('<i class="fas fa-lock"></i> دسترسی ندارید.');
    const t = teacherById(tid);
    if (!t) return;

    const name = $('#etrName').value.trim();
    const phone = normPhone($('#etrPhone').value);
    const pass = $('#etrPass').value;
    const cls = {};

    CLASSES.forEach(c => {
        const cb = $('#etc_' + c), sel = $('#etsub_' + c);
        if (cb && cb.checked) cls[c] = sel ? [...sel.selectedOptions].map(o => o.value) : [];
    });

    if (name.length < 3) return showErr('#etrError', 'نام را کامل وارد کنید.');
    if (!validPhone(phone)) return showErr('#etrError', 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
    if (teachers.some(x => x.phone === phone && x.id !== tid)) return showErr('#etrError', 'این شماره متعلق به استاد دیگری است.');
    if (pass.length < 4) return showErr('#etrError', 'رمز حداقل ۴ کاراکتر باشد.');
    if (!Object.keys(cls).length) return showErr('#etrError', 'حداقل یک کلاس را تیک بزنید.');
    for (const c of Object.keys(cls)) if (!cls[c].length) return showErr('#etrError', 'برای کلاس ' + CLASS_LABEL[c] + ' حداقل یک درس انتخاب کنید.');

    // اعمال تغییرات
    t.name = name;
    t.phone = phone;
    t.pass = pass;
    t.cls = cls;

    saveTeachers();
    closeModal();
    renderAdminTeachers();
    toast('<i class="fas fa-circle-check"></i> اطلاعات ' + STAD_PLAIN + ' با موفقیت ویرایش شد.');
}
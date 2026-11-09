// api/result.js — NU Honours result proxy for the CGPA calculator.
// Scrapes the official NU results site (results.nu.ac.bd) which uses a
// simple math CAPTCHA rendered as text in the form HTML, then returns
// the result as JSON in the shape the frontend expects:
// { found, name, exam_roll, father_name, mother_name, college, session,
//   student_type, subject, status, courses: [{code, title, credit, grade}] }

const NU_FORM = 'https://results.nu.ac.bd/honours';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function collectCookies(res) {
  const out = [];
  const arr =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie')]
        : [];
  for (const c of arr) out.push(c.split(';')[0].trim());
  return out.filter(Boolean).join('; ');
}

function fieldMap(page) {
  const fields = {};
  // Info fields: label span followed by a value span (fw-semibold, or
  // fw-bold fs-6 for Examination Roll).
  const re =
    /<span class="text-muted small d-block">([^<]+)<\/span>\s*<span class="(?:fw-semibold|fw-bold)(?:\s+fs-6)?">\s*([^<]*?)\s*<\/span>/g;
  let m;
  while ((m = re.exec(page)) !== null) fields[m[1].trim()] = m[2].trim();
  // Status ("Promoted"/"Failed") is a big fw-bold div, not a label pair.
  const st = page.match(
    /<div class="fw-bold" style="font-size:\s*22px;[^"]*">\s*([^<]+?)\s*<\/div>/
  );
  if (st) fields['Result'] = st[1].trim();
  return fields;
}

function parseCourses(page) {
  const courses = [];
  const rowRe =
    /<tr[^>]*>\s*<td[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>\s*([A-F][+-]?|FAIL)\s*<\/td>/g;
  let m;
  while ((m = rowRe.exec(page)) !== null) {
    courses.push({
      code: m[1],
      title: m[2].trim(),
      credit: parseInt(m[3], 10),
      grade: m[4].trim(),
    });
  }
  return courses;
}

async function fetchNuResult(exam, year, reg) {
  // 1. GET the form: CSRF token + math captcha + session cookie.
  const getRes = await fetch(NU_FORM, { headers: { 'User-Agent': UA } });
  if (!getRes.ok) return { found: false };
  const cookie = collectCookies(getRes);
  const html = await getRes.text();
  const token = (html.match(/name="_token"\s+value="([^"]+)"/) || [])[1];
  const cap = html.match(/(\d+)\s*([+\-x\u00d7])\s*(\d+)\s*=/);
  if (!token || !cap) return { found: false };
  const a = parseInt(cap[1], 10);
  const b = parseInt(cap[3], 10);
  const ans = cap[2] === '+' ? a + b : cap[2] === '-' ? a - b : a * b;

  // 2. POST the form with the solved captcha.
  const body = new URLSearchParams({
    _token: token,
    examination_name: exam,
    year: String(year),
    examination_roll: '',
    registration_no: reg,
    captcha: String(ans),
  });
  const postRes = await fetch(NU_FORM, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: NU_FORM,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body.toString(),
  });
  const page = await postRes.text();
  if (/No result found/i.test(page)) return { found: false };

  const f = fieldMap(page);
  const courses = parseCourses(page);
  if (!courses.length && !f['Name of Student']) return { found: false };
  return {
    found: true,
    name: f['Name of Student'] || '',
    exam_roll: f['Examination Roll'] || '',
    father_name: f["Father's Name"] || '',
    mother_name: f["Mother's Name"] || '',
    college: f['College'] || '',
    session: f['Session'] || '',
    student_type: f['Student Type'] || '',
    subject: f['Subject'] || '',
    status: f['Result'] || '',
    courses,
  };
}

export default async function handler(req, res) {
  const exam = String(req.query.exam || '');
  const year = String(req.query.year || '');
  const reg = String(req.query.reg || '');
  if (!/^\d{4}$/.test(exam) || !/^\d{4}$/.test(year) || !/^\d{5,11}$/.test(reg)) {
    return res.status(400).json({ found: false, error: 'Invalid parameters' });
  }
  try {
    const result = await fetchNuResult(exam, year, reg);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(result);
  } catch (e) {
    return res.status(200).json({ found: false, error: 'Upstream fetch failed' });
  }
}

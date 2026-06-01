const express = require('express');
const oracledb = require('oracledb');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const axios = require('axios');
const db = require("../db");
const router = express.Router();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const dbOptions = {
  outFormat: oracledb.OUT_FORMAT_OBJECT,
  autoCommit: true 
};

// 1. 닉네임 중복 확인
router.post('/check-nickname', async (req, res) => {
  const { nickname } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    const result = await connection.execute(
      `SELECT COUNT(*) AS COUNT FROM users WHERE nickname = :nickname`,
      [nickname],
      dbOptions
    );
    if (result.rows[0].COUNT > 0) {
      return res.json({ result: false, message: '이미 사용 중인 닉네임입니다.' });
    }
    res.json({ result: true, message: '사용 가능한 닉네임입니다.' });
  } catch (error) {
    console.error('닉네임 체크 오류', error);
    res.status(500).json({ result: false, message: '서버 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

// 2. 일반 회원가입
router.post('/join', async (req, res) => {
  const { email, nickname, password, birthDate } = req.body;
  let connection;

  try {
    connection = await db.getConnection();

    const checkResult = await connection.execute(
      `SELECT COUNT(*) AS COUNT FROM users WHERE email = :email`,
      [email],
      dbOptions
    );
    if (checkResult.rows[0].COUNT > 0) return res.json({ result: false, message: '이미 가입된 이메일입니다.' });

    if (!birthDate) return res.json({ result: false, message: '생년월일 정보가 누락되었습니다.' });
    const birthYear = new Date(birthDate).getFullYear();
    const currentYear = new Date().getFullYear();
    if (currentYear - birthYear < 19) return res.json({ result: false, message: '만 19세 미만 청소년은 가입할 수 없습니다.' });

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // SQL 컬럼은 snake_case, 바인딩 변수는 camelCase 사용
    const insertSql = `
      INSERT INTO users (email, nickname, password, provider, email_verified, birth_date, last_login_at) 
      VALUES (:email, :nickname, :hashedPassword, 'LOCAL', 1, TO_DATE(:birthDate, 'YYYY-MM-DD'), CURRENT_TIMESTAMP)
    `;
    await connection.execute(insertSql, { email, nickname, hashedPassword, birthDate }, dbOptions);
    
    res.json({ result: true, message: '회원가입 성공!' });
  } catch (error) {
    console.error('회원가입 오류', error);
    res.status(500).json({ result: false, message: '회원가입 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

// 3. 일반 로그인
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    
    const result = await connection.execute(
      `SELECT id, email, password, nickname, status FROM users WHERE email = :email`,
      [email],
      dbOptions
    );
    
    if (result.rows.length === 0) return res.json({ result: false, message: '존재하지 않는 계정입니다.' });
    
    const dbUser = result.rows[0]; // Oracle은 대문자로 반환함 (dbUser.ID, dbUser.EMAIL 등)
    
    if (dbUser.STATUS !== 'ACTIVE') return res.json({ result: false, message: '정지되거나 탈퇴된 계정입니다.' });
    
    const isMatch = await bcrypt.compare(password, dbUser.PASSWORD);
    if (!isMatch) return res.json({ result: false, message: '비밀번호가 일치하지 않습니다.' });
    
    await connection.execute(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id`, [dbUser.ID], dbOptions);

    // 프론트로 보낼 때는 철저하게 camelCase로 변환해서 응답
    res.json({
      result: true,
      message: '로그인 성공!',
      user: { id: dbUser.ID, email: dbUser.EMAIL, nickname: dbUser.NICKNAME }
    });
  } catch (error) {
    console.error('로그인 오류', error);
    res.status(500).json({ result: false, message: '로그인 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

// 4. 이메일 인증 발송
router.post('/send-email', async (req, res) => {
  const { email } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const insertSql = `
      INSERT INTO email_verifications (email, token, expires_at)
      VALUES (:email, :verificationCode, CURRENT_TIMESTAMP + INTERVAL '5' MINUTE)
    `;
    await connection.execute(insertSql, { email, verificationCode }, dbOptions);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '잔너머 회원가입 인증 메일입니다.',
      html: `<h2>${verificationCode}</h2>`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ result: true, message: '인증번호가 발송되었습니다.' });
  } catch (error) {
    res.status(500).json({ result: false, message: '이메일 발송 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

// 5. 이메일 검증
router.post('/verify-email', async (req, res) => {
  const { email, token } = req.body;
  let connection;
  try {
    connection = await db.getConnection();
    const selectSql = `
      SELECT id FROM email_verifications
      WHERE email = :email AND token = :token AND is_used = 0 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
    `;
    const result = await connection.execute(selectSql, { email, token }, dbOptions);

    if (result.rows.length === 0) return res.json({ result: false, message: '인증번호가 잘못되었거나 만료되었습니다.' });

    await connection.execute(`UPDATE email_verifications SET is_used = 1 WHERE id = :id`, [result.rows[0].ID], dbOptions);
    res.json({ result: true, message: '이메일 인증 완료.' });
  } catch (error) {
    res.status(500).json({ result: false, message: '인증 확인 중 오류가 발생했습니다.' });
  } finally {
    if (connection) await connection.close();
  }
});

// 6. 구글 소셜 로그인 콜백
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  let connection;

  if (!code) return res.send('<script>alert("인증 코드가 없습니다."); location.href="http://localhost:3000/login";</script>');

  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    // 구글의 access_token을 비구조화 할당으로 accessToken 이라는 카멜케이스 변수로 이름 변경
    const { access_token: accessToken } = tokenResponse.data;

    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const googleUser = userResponse.data; 
    connection = await db.getConnection();

    const selectSql = `SELECT id, email, nickname, status FROM users WHERE provider = 'GOOGLE' AND provider_id = :providerId`;
    const findUserResult = await connection.execute(selectSql, { providerId: googleUser.id }, dbOptions);

    let dbUser;

    if (findUserResult.rows.length > 0) {
      dbUser = findUserResult.rows[0];
      if (dbUser.STATUS !== 'ACTIVE') return res.send('<script>alert("정지된 계정입니다."); location.href="http://localhost:3000/login";</script>');
      await connection.execute(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id`, [dbUser.ID], dbOptions);
    } else {
      const emailCheckResult = await connection.execute(`SELECT provider FROM users WHERE email = :email`, [googleUser.email], dbOptions);
      if (emailCheckResult.rows.length > 0) {
        return res.send(`<script>alert("이미 [${emailCheckResult.rows[0].PROVIDER}] 계정으로 등록된 이메일입니다."); location.href="http://localhost:3000/login";</script>`);
      }
      
      const encodedEmail = encodeURIComponent(googleUser.email);
      const encodedName = encodeURIComponent(googleUser.name);
      const encodedPic = encodeURIComponent(googleUser.picture);
      
      return res.redirect(`http://localhost:3000/social-join?email=${encodedEmail}&name=${encodedName}&provider=GOOGLE&providerId=${googleUser.id}&profileImage=${encodedPic}`);
    }

    const encodedNickname = encodeURIComponent(dbUser.NICKNAME);
    res.redirect(`http://localhost:3000/home?loginSuccess=true&nickname=${encodedNickname}`);

  } catch (error) {
    console.error('구글 콜백 오류', error);
    res.send('<script>alert("로그인 중 서버 오류가 발생했습니다."); location.href="http://localhost:3000/login";</script>');
  } finally {
    if (connection) await connection.close();
  }
});

// 7. 소셜 최종 회원가입
router.post('/socialRegister', async (req, res) => {
  // 프론트에서 전부 카멜로 받음
  const { email, nickname, provider, providerId, profileImage, birthDate } = req.body;
  let connection;

  try {
    connection = await db.getConnection();

    const nickCheckResult = await connection.execute(`SELECT COUNT(*) AS COUNT FROM users WHERE nickname = :nickname`, [nickname], dbOptions);
    if (nickCheckResult.rows[0].COUNT > 0) return res.json({ result: false, message: '이미 사용 중인 닉네임입니다.' });

    const birthYear = new Date(birthDate).getFullYear();
    if (new Date().getFullYear() - birthYear < 19) return res.json({ result: false, message: '만 19세 미만입니다.' });

    const insertSql = `
      INSERT INTO users (email, nickname, password, provider, email_verified, birth_date, last_login_at) 
      VALUES (:email, :nickname, :hashedPassword, 'LOCAL', 1, TO_DATE(:birthDate, 'YYYY-MM-DD'), CURRENT_TIMESTAMP)
    `;
    await connection.execute(insertSql, { email, nickname, provider, providerId, profileImage, birthDate }, dbOptions);

    const userResult = await connection.execute(`SELECT id, email, nickname FROM users WHERE provider = :provider AND provider_id = :providerId`, { provider, providerId }, dbOptions);
    const newUser = userResult.rows[0];

    res.json({
      result: true,
      message: '소셜 회원가입 완료!',
      user: { id: newUser.ID, email: newUser.EMAIL, nickname: newUser.NICKNAME }
    });
  } catch (error) {
    console.error('소셜 가입 오류', error);
    res.status(500).json({ result: false, message: '가입 중 오류 발생.' });
  } finally {
    if (connection) await connection.close();
  }
});

// 8. 다날 본인인증 영수증 검증
router.post('/certifications', async (req, res) => {
  const { impUid } = req.body; // ✨ 프론트에서 impUid로 통일해서 받음

  try {
    const tokenResponse = await axios.post('https://api.iamport.kr/users/getToken', {
      imp_key: process.env.PORTONE_API_KEY,
      imp_secret: process.env.PORTONE_API_SECRET
    });
    
    // 포트원 응답인 access_token을 accessToken으로 변환
    const { access_token: accessToken } = tokenResponse.data.response;

    const certResponse = await axios.get(`https://api.iamport.kr/certifications/${impUid}`, {
      headers: { Authorization: accessToken }
    });
    
    const certData = certResponse.data.response; 

    const birthYear = new Date(certData.birthday).getFullYear();
    const isAdult = (new Date().getFullYear() - birthYear) >= 19;

    if (isAdult) {
      const birthDateStr = new Date(certData.birthday).toISOString().split('T')[0];
      res.json({ result: true, name: certData.name, birthDate: birthDateStr });
    } else {
      res.json({ result: false, message: '❌ 만 19세 미만 청소년은 가입할 수 없습니다.' });
    }
  } catch (error) {
    res.status(500).json({ result: false, message: '인증 서버 오류' });
  }
});

module.exports = router;
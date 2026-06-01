import React, { useState } from 'react';
import { Box, Button, Divider, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom'; // ✨ 추가: 로그인 성공 후 화면 이동을 위함

function Login() {
  const navigate = useNavigate(); // ✨ 추가: 이동 함수 초기화

  const [id, setId] = useState(''); // 사용자가 입력한 Email 값
  const [password, setPassword] = useState('');

  // ✨ 로그인 제출 함수 (진짜 API 연결)
  const handleSubmit = (event) => {
    event.preventDefault();

    // 기본 유효성 검사
    if (!id || !password) {
      return alert("이메일과 비밀번호를 모두 입력해주세요.");
    }

    // 백엔드 로그인 API 호출
    fetch("http://localhost:3010/user/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: id,         // 💡 중요: 프론트의 상태명은 id이지만 백엔드는 email로 받으므로 매핑해줍니다.
        password: password
      })
    })
    .then(res => res.json())
    .then(data => {
      alert(data.message); // 백엔드가 보낸 메시지 ("로그인 성공!", "비밀번호가 일치하지 않습니다." 등)
      
      if (data.result) {
        // [로그인 성공 시]
        console.log("로그인 성공 유저 정보:", data.user);
        
        // 나중에 세션이나 localStorage, 또는 리액트 Context에 유저 정보를 저장하는 로직이 여기에 들어갑니다!
        // 예: localStorage.setItem("user", JSON.stringify(data.user));

        navigate("/home"); // 🚀 App.js에 등록된 홈 화면으로 이동합니다.
      }
    })
    .catch(err => {
      console.error("로그인 통신 에러:", err);
      alert("서버 통신 실패");
    });
  };

  return (
    /* 최상단 배경 및 정중앙 정렬 박스 */
    <Box 
      sx={{ 
        minHeight: '100vh', 
        display: 'grid', 
        placeItems: 'center',
        backgroundColor: '#f5f5f5' // 영역 구분을 위한 연한 회색 배경
      }}
    >
      {/* 흰색 로그인 카드 상자 */}
      <Paper 
        elevation={3} 
        sx={{ 
          padding: 4, 
          width: '100%', 
          maxWidth: 400 
        }}
      >
        <Typography variant="h5" align="center" gutterBottom fontWeight="bold">
          잔너머 로그인
        </Typography>

        <form onSubmit={handleSubmit}>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField 
              label="Email" 
              variant="outlined" 
              fullWidth 
              value={id} 
              onChange={(e) => setId(e.target.value)} 
            />
            <TextField 
              label="Password" 
              type="password" 
              variant="outlined" 
              fullWidth 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
            <Button type="submit" variant="contained" color="primary" size="large">
              Sign in
            </Button>
          </Stack>
        </form>

        <Divider sx={{ my: 3 }}>or continue with</Divider>

        {/* 원형 소셜 로그인 버튼 스택 */}
        <Stack direction="row" spacing={3} justifyContent="center" sx={{ mb: 1 }}>
          <Button
            onClick={() => {
                const clientFileId = "543671638677-cusv4p5t4vp7v5j1klnqu61f97tgoc4i.apps.googleusercontent.com"; 
                const redirectUri = "http://localhost:3010/user/google/callback";
                const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientFileId}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&prompt=select_account`;
                
                // 구글 로그인 페이지로 브라우저 이동!
                window.location.href = googleUrl;
                }}
                sx={{
                    width: 46, height: 46, borderRadius: '50%', minWidth: 0,
                    backgroundColor: '#ffffff', border: '1px solid #e0e0e0', color: '#757575',
                    fontWeight: 'bold', fontSize: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    '&:hover': { backgroundColor: '#f5f5f5', border: '1px solid #ccc' }
                }}
            >
                G
            </Button>

          <Button
            onClick={() => console.log('네이버 로그인 클릭')}
            sx={{
              width: 46, height: 46, borderRadius: '50%', minWidth: 0,
              backgroundColor: '#03C75A', color: '#ffffff', fontWeight: 'bold', fontSize: '16px',
              '&:hover': { backgroundColor: '#02b34f' }
            }}
          >
            N
          </Button>

          <Button
            onClick={() => console.log('카카오 로그인 클릭')}
            sx={{
              width: 46, height: 46, borderRadius: '50%', minWidth: 0,
              backgroundColor: '#FEE500', color: '#191919', fontWeight: 'bold', fontSize: '16px',
              '&:hover': { backgroundColor: '#fada00' }
            }}
          >
            K
          </Button>
        </Stack>

        {/* 하단 회원가입 링크 이동 박스 */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <Link href="/join" underline="hover">
              Sign up
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default Login;
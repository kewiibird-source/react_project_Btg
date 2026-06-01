import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';
import Main from './components/Main';
import Login from './components/Login';
import Home from './components/Home'; 
import Join from './components/Join';
import Menu from './components/Menu';
import SocialJoin from './components/SocialJoin';

function App() {
  const location = useLocation();
  
  // ✨ 1. 여기에 '/social-join' 이 완벽하게 추가되어야 사이드 메뉴가 예쁘게 숨겨집니다!
  const isAuthPage = 
    location.pathname === '/login' || 
    location.pathname === '/join' || 
    location.pathname === '/social-join'; 

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      
      {/* 2. 인증 페이지가 아닐 때만 Menu(사이드바) 렌더링 */}
      {!isAuthPage && <Menu />} 

      {/* 3. 메인 컨텐츠 영역 */}
      <Box 
        component={isAuthPage ? 'div' : 'main'} 
        sx={{ 
          flexGrow: 1, 
          p: isAuthPage ? 0 : 3 
        }}
      >
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/login" element={<Login />} />
          <Route path="/join" element={<Join />} />
          <Route path="/home" element={<Home />} />
          <Route path="/social-join" element={<SocialJoin />} /> 
        </Routes>
      </Box>
    </Box>
  );
}

export default App;
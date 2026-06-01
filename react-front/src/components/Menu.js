import React from 'react';
import { Drawer, List, ListItem, ListItemText, Typography, Toolbar, ListItemIcon } from '@mui/material';
import { Home } from '@mui/icons-material';
import { Link } from 'react-router-dom';

function Menu() {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 240, // 너비 설정
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 240, // Drawer 내부의 너비 설정
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar />
      <Typography variant="h6" component="div" sx={{ p: 2 }}>
        SNS 메뉴
      </Typography>
      <List>
        <ListItem button component={Link} to="/Home">
          <ListItemIcon>
            <Home />
          </ListItemIcon>
          <ListItemText primary="홈" />
        </ListItem>
      </List>
      
    </Drawer>
  );
};

export default Menu;
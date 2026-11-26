import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import WaterSplash from './components/WaterSplash';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <WaterSplash />
  </React.StrictMode>
);


import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToolboxProvider } from './contexts/ToolboxContext';
import App from './App';
import Marketplace from './pages/Marketplace';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ToolboxProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/marketplace" element={<Marketplace />} />
        </Routes>
      </ToolboxProvider>
    </BrowserRouter>
  </React.StrictMode>
);

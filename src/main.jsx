import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { LanguageProvider } from '@/lib/i18n'
import '@/index.css' // FlowGrid ERP

ReactDOM.createRoot(document.getElementById('root')).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
)
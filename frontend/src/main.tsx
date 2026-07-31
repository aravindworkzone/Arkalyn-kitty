import React from 'react'
import ReactDOM from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App.js'
import { BrowserRouter } from 'react-router-dom'
// Self-hosted so the app carries no Google Fonts CDN dependency (it ships as an
// installable PWA). Variable font: one file covers weights 100-900.
import '@fontsource-variable/outfit'
import './index.css'
import { store } from './redux/store'
import { Provider } from 'react-redux'
import './i18n'

const Root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

Root.render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App.js'
import { BrowserRouter } from 'react-router-dom'
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

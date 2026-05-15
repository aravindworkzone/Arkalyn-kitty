import http from 'node:http'
import { readFile, writeFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const DIST = resolve('dist')
const ROUTE = '/'
const PORT = 4173
const RENDER_WAIT_MS = 1500

const CHROME_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

function findBrowser() {
  for (const p of CHROME_PATHS) if (existsSync(p)) return p
  throw new Error('No Chrome/Edge install found. Set PUPPETEER_EXECUTABLE_PATH.')
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

function startStaticServer() {
  return new Promise((res) => {
    const server = http.createServer(async (req, response) => {
      try {
        const url = req.url.split('?')[0]
        let file = url === '/' ? '/index.html' : url
        const filePath = join(DIST, file)
        if (!existsSync(filePath)) {
          if (extname(file) === '') {
            const buf = await readFile(join(DIST, 'index.html'))
            response.writeHead(200, { 'content-type': MIME['.html'] })
            response.end(buf)
            return
          }
          response.writeHead(404)
          response.end('not found')
          return
        }
        const buf = await readFile(filePath)
        response.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
        response.end(buf)
      } catch (err) {
        response.writeHead(500)
        response.end(String(err))
      }
    })
    server.listen(PORT, '127.0.0.1', () => res(server))
  })
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('[prerender] dist/index.html not found — run vite build first.')
    process.exit(1)
  }

  await copyFile(join(DIST, 'index.html'), join(DIST, 'app.html'))

  const executablePath = findBrowser()
  console.log(`[prerender] using browser: ${executablePath}`)
  const server = await startStaticServer()
  let browser

  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    page.on('pageerror', (err) => console.warn('[prerender] pageerror:', err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.warn('[prerender] console.error:', msg.text())
    })

    const url = `http://127.0.0.1:${PORT}${ROUTE}`
    console.log(`[prerender] rendering ${url} ...`)
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    await page.waitForSelector('#root > *', { timeout: 10000 }).catch(() => null)
    await new Promise((r) => setTimeout(r, RENDER_WAIT_MS))

    const html = await page.content()
    const rootInner = await page.$eval('#root', (el) => el.innerHTML.trim()).catch(() => '')

    if (!rootInner) {
      console.warn('[prerender] root was empty after render — keeping original index.html.')
      return
    }

    await writeFile(join(DIST, 'index.html'), html, 'utf-8')
    console.log(`[prerender] wrote dist/index.html (${html.length} bytes, ${rootInner.length} bytes inside #root).`)
  } finally {
    if (browser) await browser.close()
    server.close()
  }
}

main().catch((err) => {
  console.error('[prerender] failed:', err)
  process.exit(1)
})

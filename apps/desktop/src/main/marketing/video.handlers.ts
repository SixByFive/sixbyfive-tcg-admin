import { BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { Client } from 'ssh2'
import { readSettings } from '../vl/services/settings.service.js'

interface VideoStatus {
  ok: boolean
  connected: boolean
  ffmpeg: boolean
  gpu: boolean
  comfy: boolean
  message: string
}

interface RenderVideoArgs {
  title: string
  body: string
  cta?: string
  duration?: number
}

interface RenderResult {
  ok: boolean
  outputPath?: string
  remotePath?: string
  error?: string
}

function emit(channel: string, payload: unknown): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

function openSsh(settings: any): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => resolve(conn))
    conn.on('error', reject)
    conn.connect({
      host: settings.heimdallHost,
      port: settings.heimdallPort ?? 22,
      username: settings.heimdallUser,
      password: settings.heimdallPassword,
      readyTimeout: 10000,
    })
  })
}

function exec(conn: Client, command: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (error, stream) => {
      if (error) return reject(error)
      let stdout = ''
      let stderr = ''
      stream.on('data', data => { stdout += data.toString('utf8') })
      stream.stderr.on('data', data => { stderr += data.toString('utf8') })
      stream.on('close', code => resolve({ code: code ?? 0, stdout, stderr }))
    })
  })
}

function validateHeimdall(settings: any): string | null {
  if (!settings.heimdallHost || !settings.heimdallUser || !settings.heimdallPassword) {
    return 'Configure Heimdall in Vision Lab → Settings → Infrastructure first.'
  }
  if (!settings.heimdallWorkspacePath || !settings.fenrirWorkspacePath) {
    return 'Heimdall and Fenrir workspace paths are required so rendered videos are shared back to this PC.'
  }
  return null
}

function remoteMarketingRoot(settings: any): string {
  return `${String(settings.heimdallWorkspacePath).replace(/\/$/, '')}/marketing`
}

function localMarketingRoot(settings: any): string {
  return path.join(settings.fenrirWorkspacePath, 'marketing')
}

function base64Text(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'campaign'
}

async function getVideoStatus(): Promise<VideoStatus> {
  const settings = readSettings()
  const configError = validateHeimdall(settings)
  if (configError) return { ok: false, connected: false, ffmpeg: false, gpu: false, comfy: false, message: configError }

  let conn: Client | undefined
  try {
    conn = await openSsh(settings)
    const result = await exec(conn, [
      'command -v ffmpeg >/dev/null 2>&1 && echo FFMPEG_OK || echo FFMPEG_MISSING',
      'command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1 && echo GPU_OK || echo GPU_MISSING',
      "curl -fsS --max-time 2 http://127.0.0.1:8188/system_stats >/dev/null 2>&1 && echo COMFY_OK || echo COMFY_MISSING",
    ].join('; '))

    const ffmpeg = result.stdout.includes('FFMPEG_OK')
    const gpu = result.stdout.includes('GPU_OK')
    const comfy = result.stdout.includes('COMFY_OK')
    return {
      ok: true,
      connected: true,
      ffmpeg,
      gpu,
      comfy,
      message: `Heimdall connected · FFmpeg ${ffmpeg ? '✓' : '✗'} · GPU ${gpu ? '✓' : '✗'} · ComfyUI ${comfy ? '✓' : 'not running'}`,
    }
  } catch (error) {
    return {
      ok: false,
      connected: false,
      ffmpeg: false,
      gpu: false,
      comfy: false,
      message: error instanceof Error ? error.message : String(error),
    }
  } finally {
    conn?.end()
  }
}

async function setupVideoNode(): Promise<{ ok: boolean; message: string }> {
  const settings = readSettings()
  const configError = validateHeimdall(settings)
  if (configError) return { ok: false, message: configError }

  let conn: Client | undefined
  try {
    conn = await openSsh(settings)
    const homeRoot = '$HOME/sixbyfive-marketing'
    const command = [
      `mkdir -p ${homeRoot}/workflows ${homeRoot}/logs "${remoteMarketingRoot(settings)}/videos"`,
      `if [ ! -d ${homeRoot}/ComfyUI/.git ]; then git clone https://github.com/comfyanonymous/ComfyUI.git ${homeRoot}/ComfyUI; fi`,
      `if [ ! -d ${homeRoot}/ComfyUI/.venv ]; then python3 -m venv ${homeRoot}/ComfyUI/.venv; fi`,
      `${homeRoot}/ComfyUI/.venv/bin/python -m pip install --upgrade pip`,
      `${homeRoot}/ComfyUI/.venv/bin/python -m pip install -r ${homeRoot}/ComfyUI/requirements.txt`,
    ].join(' && ')

    emit('marketing:video:status', { status: 'running', message: 'Setting up ComfyUI on Heimdall…' })
    const result = await exec(conn, command)
    if (result.code !== 0) {
      return { ok: false, message: result.stderr || result.stdout || `Setup exited with code ${result.code}` }
    }

    return {
      ok: true,
      message: 'ComfyUI is installed on Heimdall. Wan model files still need to be placed in ComfyUI/model directories before generative video can run.',
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  } finally {
    conn?.end()
  }
}

async function startComfyUi(): Promise<{ ok: boolean; message: string }> {
  const settings = readSettings()
  const configError = validateHeimdall(settings)
  if (configError) return { ok: false, message: configError }

  let conn: Client | undefined
  try {
    conn = await openSsh(settings)
    const root = '$HOME/sixbyfive-marketing/ComfyUI'
    const check = await exec(conn, `test -f ${root}/main.py && test -x ${root}/.venv/bin/python`)
    if (check.code !== 0) return { ok: false, message: 'ComfyUI is not installed yet. Run setup first.' }

    await exec(conn, `if ! curl -fsS --max-time 2 http://127.0.0.1:8188/system_stats >/dev/null 2>&1; then cd ${root} && nohup .venv/bin/python main.py --listen 127.0.0.1 --port 8188 > $HOME/sixbyfive-marketing/logs/comfyui.log 2>&1 & fi`)
    return { ok: true, message: 'ComfyUI start requested on Heimdall.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  } finally {
    conn?.end()
  }
}

async function renderMotionVideo(args: RenderVideoArgs): Promise<RenderResult> {
  const settings = readSettings()
  const configError = validateHeimdall(settings)
  if (configError) return { ok: false, error: configError }

  if (!args?.title?.trim() || !args?.body?.trim()) {
    return { ok: false, error: 'A title and body are required.' }
  }

  const duration = Math.max(6, Math.min(30, Number(args.duration) || 15))
  const stamp = Date.now()
  const slug = safeFileName(args.title)
  const fileName = `${stamp}-${slug}.mp4`
  const remoteRoot = remoteMarketingRoot(settings)
  const remoteJobDir = `${remoteRoot}/jobs/${stamp}`
  const remoteOutput = `${remoteRoot}/videos/${fileName}`
  const localOutput = path.join(localMarketingRoot(settings), 'videos', fileName)
  const titleB64 = base64Text(args.title.trim())
  const bodyB64 = base64Text(args.body.trim())
  const ctaB64 = base64Text((args.cta?.trim() || 'Track your collection at tcg.sixbyfive.com'))

  let conn: Client | undefined
  try {
    conn = await openSsh(settings)
    const ffmpegCheck = await exec(conn, 'command -v ffmpeg >/dev/null 2>&1')
    if (ffmpegCheck.code !== 0) {
      return { ok: false, error: 'FFmpeg is not installed on Heimdall. Install ffmpeg on the server, then retry.' }
    }

    emit('marketing:video:status', { status: 'running', message: 'Rendering vertical video on Heimdall…' })

    const firstEnd = Math.max(2, Math.floor(duration * 0.27))
    const secondEnd = Math.max(firstEnd + 2, Math.floor(duration * 0.76))
    const command = [
      `mkdir -p "${remoteJobDir}" "${remoteRoot}/videos"`,
      `echo '${titleB64}' | base64 -d > "${remoteJobDir}/title.txt"`,
      `echo '${bodyB64}' | base64 -d > "${remoteJobDir}/body.txt"`,
      `echo '${ctaB64}' | base64 -d > "${remoteJobDir}/cta.txt"`,
      `ffmpeg -y -f lavfi -i "color=c=#101114:s=1080x1920:r=30:d=${duration}" -vf "drawtext=textfile='${remoteJobDir}/title.txt':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=420:enable='between(t,0,${firstEnd})',drawtext=textfile='${remoteJobDir}/body.txt':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=760:enable='between(t,${firstEnd},${secondEnd})',drawtext=textfile='${remoteJobDir}/cta.txt':fontcolor=white:fontsize=44:x=(w-text_w)/2:y=1320:enable='between(t,${secondEnd},${duration})',drawtext=text='SIXBYFIVE TCG':fontcolor=white@0.6:fontsize=30:x=(w-text_w)/2:y=h-110" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart "${remoteOutput}"`,
    ].join(' && ')

    const result = await exec(conn, command)
    if (result.code !== 0) {
      emit('marketing:video:status', { status: 'error', message: result.stderr || `FFmpeg exited with ${result.code}` })
      return { ok: false, error: result.stderr || result.stdout || `FFmpeg exited with ${result.code}` }
    }

    emit('marketing:video:status', { status: 'done', message: 'Video rendered on Heimdall.', outputPath: localOutput })
    return { ok: true, outputPath: localOutput, remotePath: remoteOutput }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emit('marketing:video:status', { status: 'error', message })
    return { ok: false, error: message }
  } finally {
    conn?.end()
  }
}

async function revealOutput(_event: unknown, outputPath: string): Promise<{ ok: boolean; error?: string }> {
  if (!outputPath) return { ok: false, error: 'No output path supplied.' }
  try {
    shell.showItemInFolder(outputPath)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function registerMarketingVideoIpcHandlers(): void {
  ipcMain.handle('marketing:video:status', getVideoStatus)
  ipcMain.handle('marketing:video:setup', setupVideoNode)
  ipcMain.handle('marketing:video:startComfy', startComfyUi)
  ipcMain.handle('marketing:video:renderMotion', (_event, args: RenderVideoArgs) => renderMotionVideo(args))
  ipcMain.handle('marketing:video:revealOutput', revealOutput)
}

import fs from 'fs'
import path from 'path'
import process from 'process'
import { exec } from 'child_process'
import io from 'socket.io-client'

// 获取入参
const processArgs = getProcessArgs()

// OHTTPS中创建的部署节点ID
const PUSH_NODE_ID = processArgs['node-id'] || process.env.PUSH_NODE_ID
// OHTTPS中创建的部署节点令牌
const PUSH_NODE_TOKEN = processArgs['node-token'] || process.env.PUSH_NODE_TOKEN
// OHTTPS的SOCKET服务地址
const PUSH_SOCKET_URL = processArgs['socket-url'] || process.env.PUSH_SOCKET_URL || 'https://socket.ohttps.com/'
// 证书文件首次下载后执行的启动命令
const PUSH_NODE_SERVICE_START_CMD = processArgs['service-start-cmd'] || process.env.PUSH_NODE_SERVICE_START_CMD
// 证书文件每次更新后执行的重载命令
const PUSH_NODE_SERVICE_RELOAD_CMD = processArgs['service-reload-cmd'] || process.env.PUSH_NODE_SERVICE_RELOAD_CMD
// 证书文件所在文件夹
let PUSH_NODE_FOLDER = processArgs['cert-folder'] || process.env.PUSH_NODE_FOLDER || '/etc/ohttps/certificates/'
if (!PUSH_NODE_FOLDER.endsWith('/')) {
  PUSH_NODE_FOLDER = `${PUSH_NODE_FOLDER}/`
}
// 单个证书的文件路径
const CERTIFICATE_FILE_PATH = {
  FOLDER: PUSH_NODE_FOLDER,
  KEY: (certificateName) => `${PUSH_NODE_FOLDER}${certificateName}/cert.key`,
  FULLCHAIN: (certificateName) => `${PUSH_NODE_FOLDER}${certificateName}/fullchain.cer`
}

if (!PUSH_NODE_ID) {
  debug('[部署节点ID缺失|push-node-id-missing]: PUSH_NODE_ID')
  process.exit()
}

if (!PUSH_NODE_TOKEN) {
  debug('[部署节点TOKEN缺失|push-node-token-missing]: PUSH_NODE_TOKEN')
  process.exit()
}

debug('[参数配置|configuration]')
debug('  [PUSH_NODE_ID]:', PUSH_NODE_ID)
debug('  [PUSH_NODE_TOKEN]:', PUSH_NODE_TOKEN)
debug('  [PUSH_SOCKET_URL]:', PUSH_SOCKET_URL || '')
debug('  [PUSH_NODE_FOLDER]:', PUSH_NODE_FOLDER || '')
debug('  [PUSH_NODE_SERVICE_START_CMD]:', PUSH_NODE_SERVICE_START_CMD || '')
debug('  [PUSH_NODE_SERVICE_RELOAD_CMD]:', PUSH_NODE_SERVICE_RELOAD_CMD || '')

let isFirstTimeLoad = true
const socket = io(PUSH_SOCKET_URL, { transports: ['websocket'], transportOptions: { forceNode: true } })
debug('')
debug('[开始连接服务器|begin-connect-to-server]')

socket.on('connect', () => {
  if (!isFirstTimeLoad) {
    debug('')
  }
  debug(`[服务器${isFirstTimeLoad ? '连接' : '重新连接'}成功|${isFirstTimeLoad ? 'connect' : 'reconnect'}-to-server-success]`)

  debug(`[开始校验部署节点参数|begin-verify-push-node]`)
  socket.emit('login', {
    cloudServerName: PUSH_NODE_ID,
    cloudServerToken: PUSH_NODE_TOKEN
  }, async (response) => {
    if (response.error) {
      debug('[部署节点参数校验失败|verify-push-node-failed]:', response.error)
      debug('[请检查部署节点ID或TOKEN是否配置正确|please-check-the-push-node-id-and-token]')
      return
    }
    debug('[部署节点参数校验成功|verify-push-node-succeed]')

    if (!isFirstTimeLoad) {
      return
    }

    debug('')
    debug(`↓↓↓===================首次证书部署-${getCurrentTime()}===================↓↓↓`)
    debug('[开始首次加载部署节点关联证书|begin-load-certificates-for-the-first-time]')
    isFirstTimeLoad = false
    const updateResult = await updateCertificates({ certificates: response.certificates, isFirstTimeLoad: true })
    debug('[首次加载部署节点关联证书完成|load-certificates-for-the-first-time-finished]: ', updateResult)
    debug(`↑↑↑===================首次证书部署-${getCurrentTime()}===================↑↑↑`)
  })
})

socket.on('disconnect', () => {
  debug('')
  debug('[已断开与服务器连接|server-disconnected]')
})

socket.on('updateCertificate', async (data, cb) => {
  debug('')
  debug(`↓↓↓===================证书更新部署-${getCurrentTime()}===================↓↓↓`)
  debug('[开始处理部署节点关联证书更新事件|receive-certificates-update-event]:', data.certificateName)
  const updateResult = await updateCertificates({ certificates: [data], isFirstTimeLoad: false })
  debug('[部署节点关联证书更新事件处理完成|certificates-update-event-finished]:', JSON.stringify(updateResult))
  debug(`↑↑↑===================证书更新部署-${getCurrentTime()}===================↑↑↑`)
  cb(updateResult)
})

async function updateCertificates({ certificates, isFirstTimeLoad }) {
  debug('[是否是首次证书部署|is-first-time-load]:', isFirstTimeLoad)
  debug('[需要部署的证书数量|certificates-num]:', certificates.length)
  debug('[证书部署目标文件夹|certificates-folder]:', path.resolve(CERTIFICATE_FILE_PATH.FOLDER))

  // 创建证书文件夹
  if (!fs.existsSync(CERTIFICATE_FILE_PATH.FOLDER)) {
    fs.mkdirSync(CERTIFICATE_FILE_PATH.FOLDER, { recursive: true })
    debug('[证书部署目标文件夹创建成功|certificates-folder-created]')
  }

  for (let i = 0; i < certificates.length; i++) {
    const certificate = certificates[i]
    const certificateFoler = path.resolve(`${CERTIFICATE_FILE_PATH.FOLDER}${certificate.certificateName}`)
    const certificateCertKeyPath = path.resolve(CERTIFICATE_FILE_PATH.KEY(certificate.certificateName))
    const certificateFullchainCertsPath = path.resolve(CERTIFICATE_FILE_PATH.FULLCHAIN(certificate.certificateName))

    debug(`[开始部署第N个证书|begin-deploy-nth-certificate]: ${i + 1}/${certificates.length}, ${certificate.certificateName}`)

    debug('  [证书文件夹|certificate-folder]:', certificateFoler)
    // 创建单个证书文件夹
    if (!fs.existsSync(certificateFoler)) {
      fs.mkdirSync(certificateFoler, { recursive: true })
      debug('  [证书文件夹创建成功|certificate-folder-created]')
    }

    debug('  [证书私钥文件路径|private-key-file-path]:', certificateCertKeyPath)
    fs.writeFileSync(certificateCertKeyPath, certificate.certificateCertKey)
    debug('  [证书私钥文件写入成功|private-key-file-created]')

    debug('  [证书公钥文件路径|public-key-file-path]:', certificateFullchainCertsPath)
    fs.writeFileSync(certificateFullchainCertsPath, certificate.certificateFullchainCerts)
    debug('  [证书公钥文件写入成功|public-key-file-created]')
  }

  const cmd = isFirstTimeLoad ? PUSH_NODE_SERVICE_START_CMD : PUSH_NODE_SERVICE_RELOAD_CMD
  const cmdCnName = isFirstTimeLoad ? '启动' : '重启'
  const cmdEnName = isFirstTimeLoad ? 'start' : 'reload'
  if (!cmd) {
    if (isFirstTimeLoad) {
      debug(`[未配置服务${cmdCnName}命令|service-${cmdEnName}-cmd-not-config]`)
    } else {
      debug(`[未配置服务${cmdCnName}命令|service-${cmdEnName}-cmd-not-config]`)
    }
    debug('[命令执行跳过|skip-cmd-excute]')
    return { cmd: '', code: 0, stdout: 'sucess', stderr: '' }
  }

  debug(`[开始执行服务${cmdCnName}命令|begin-excute-service-${cmdEnName}-cmd]:`, cmd)
  const { code, stdout, stderr } = await (new Promise((resolve, _) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve({ code: error ? error.code : 0, stdout, stderr })
    })
  }))

  if (stderr) {
    debug(`[命令执行异常|cmd-excute-error]:`, stderr)
  }

  debug(`[服务${cmdCnName}命令执行完成|excute-service-${cmdEnName}-cmd-complete]:`, cmd)
  return { cmd, code, stdout, stderr }
}

// 日志
function debug() {
  console.log(getCurrentTime(), '•', 'OHTTPS', '•', ...arguments)
}

// 获取当前时间字符串
function getCurrentTime() {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now
      .getHours()
      .toString()
      .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now
        .getSeconds()
        .toString()
        .padStart(2, '0')}.${now
          .getMilliseconds()
          .toString()
          .padStart(3, '0')}`
}

// 入参
function getProcessArgs() {
  const args = {}
  const argv = process.argv
  argv
    .slice(argv.findIndex((arg) => arg.slice(0, 2) === '--'))
    .forEach(arg => {
      if (arg.slice(0, 2) === '--') {
        const argNameValue = arg.split('=')
        const argName = argNameValue[0].slice(2)
        let argValue = argNameValue[1]
        if (argValue[0] === "'" || argValue[0] === '"') {
          argValue = argValue.slice(1)
        }
        if (argValue[argValue.length - 1] === "'" || argValue[argValue.length - 1] === '"') {
          argValue = argValue.slice(0, -1)
        }
        args[argName] = argValue
      }
    })
  return args
}

import { configManager } from './config-manager.ts';
import { resolveServiceName } from '../utils/k8s.ts';
import { certManager } from '../utils/cert-manager.ts';
import tls from 'tls';

// 从 TLS ClientHello 提取 SNI（已废弃，TLS 终止模式不再需要）
/*
function extractSNI(buffer: Buffer): string | null {
  try {
    // TLS ClientHello 格式解析
    if (buffer.length < 43) return null;
    
    // 检查是否是 TLS Handshake (0x16)
    if (buffer[0] !== 0x16) return null;
    
    // 检查是否是 ClientHello (0x01)
    if (buffer[5] !== 0x01) return null;
    
    // 跳过固定字段，找到 extensions
    let pos = 43; // Session ID 之后
    
    // 跳过 Session ID
    if (pos >= buffer.length) return null;
    const sessionIdLength = buffer[pos] ?? 0;
    pos += 1 + sessionIdLength;

    // 跳过 Cipher Suites
    if (pos + 2 > buffer.length) return null;
    const cipherSuitesLength = buffer.readUInt16BE(pos);
    pos += 2 + cipherSuitesLength;

    // 跳过 Compression Methods
    if (pos >= buffer.length) return null;
    const compressionMethodsLength = buffer[pos] ?? 0;
    pos += 1 + compressionMethodsLength;
    
    // Extensions
    if (pos + 2 > buffer.length) return null;
    const extensionsLength = buffer.readUInt16BE(pos);
    pos += 2;
    
    const extensionsEnd = pos + extensionsLength;
    
    // 遍历 extensions
    while (pos + 4 <= extensionsEnd) {
      const extensionType = buffer.readUInt16BE(pos);
      const extensionLength = buffer.readUInt16BE(pos + 2);
      pos += 4;
      
      // SNI extension (type = 0)
      if (extensionType === 0) {
        if (pos + 5 > buffer.length) return null;

        pos += 2; // Skip serverNameListLength

        const nameType = buffer[pos];
        pos += 1;

        // Host name (type = 0)
        if (nameType === 0) {
          const nameLength = buffer.readUInt16BE(pos);
          pos += 2;

          if (pos + nameLength > buffer.length) return null;

          const sni = buffer.toString('utf8', pos, pos + nameLength);
          return sni;
        }
      }
      
      pos += extensionLength;
    }
    
    return null;
  } catch (error) {
    console.error('❌ 解析 SNI 失败:', error);
    return null;
  }
}
*/

// 旧的处理客户端连接函数（已废弃，保留用于参考）
// 现在使用 TLS 终止模式，不再需要手动解析 SNI
/*
async function handleClientConnection(socket: any, data: Buffer) {
  try {
    // 检查是否已处理过 SNI（避免重复处理）
    if ((socket as any)._sniProcessed) {
      // 这是后续数据，直接转发到后端
      const backendSocket = (socket as any)._backendSocket;
      if (backendSocket) {
        backendSocket.write(data);
      }
      return;
    }

    // 提取 SNI
    const sni = extractSNI(data);

    if (!sni) {
      console.log('⚠️ 无法提取 SNI，关闭连接');
      socket.end();
      return;
    }

    console.log(`📨 收到连接: ${sni}`);

    // 查找后端
    const backend = configManager.findBackend(sni);

    if (!backend) {
      console.log(`❌ 未找到后端: ${sni}`);
      socket.end();
      return;
    }

    // 解析服务名（自动补全 namespace）
    const resolvedService = resolveServiceName(backend.service);

    console.log(`✅ 路由到: ${backend.service}:${backend.port}`);
    if (resolvedService !== backend.service) {
      console.log(`   解析为: ${resolvedService}`);
    }

    // 记录统计
    configManager.recordConnection(sni);

    // 连接到后端
    console.log(`🔌 正在连接后端: ${resolvedService}:${backend.port}`);

    let backendSocket;
    try {
      backendSocket = await Bun.connect({
        hostname: resolvedService,
        port: backend.port,
        socket: {
          data(_backendSocket: any, backendData: Buffer) {
            // 后端 → 客户端
            console.log(`📤 后端 → 客户端: ${backendData.length} bytes`);
            socket.write(backendData);
          },
          open(_backendSocket: any) {
            console.log(`✅ 后端连接成功: ${resolvedService}:${backend.port}`);
          },
          close(_backendSocket: any) {
            console.log(`🔌 后端连接关闭: ${resolvedService}:${backend.port}`);
            socket.end();
          },
          error(_backendSocket: any, error: Error) {
            console.error(`❌ 后端连接错误 (${backend.service}:${backend.port}):`, error);
            socket.end();
          },
        },
      });
    } catch (error) {
      console.error(`❌ 无法连接到后端 ${resolvedService}:${backend.port}:`, error);
      socket.end();
      return;
    }

    // 标记已处理 SNI，保存后端 socket 引用
    (socket as any)._sniProcessed = true;
    (socket as any)._backendSocket = backendSocket;

    // 发送初始数据到后端
    console.log(`📥 客户端 → 后端: ${data.length} bytes (ClientHello)`);
    backendSocket.write(data);

    // 后续数据转发
    socket.data = (_socket: any, moreData: Buffer) => {
      backendSocket.write(moreData);
    };

    socket.close = () => {
      backendSocket.end();
    };
  } catch (error) {
    console.error(`❌ 处理连接异常:`, error);
    socket.end();
  }
}
*/

// 处理 TLS 连接（TLS 终止模式）
async function handleTLSConnection(tlsSocket: any) {
  try {
    const sni = tlsSocket.servername as string;

    if (!sni) {
      console.log('⚠️ 无法获取 SNI，关闭连接');
      tlsSocket.end();
      return;
    }

    console.log(`📨 收到 TLS 连接: ${sni}`);

    // 查找后端
    const backend = configManager.findBackend(sni);

    if (!backend) {
      console.log(`❌ 未找到后端: ${sni}`);
      tlsSocket.end();
      return;
    }

    // 解析服务名（自动补全 namespace）
    const resolvedService = resolveServiceName(backend.service);

    console.log(`✅ 路由到: ${backend.service}:${backend.port}`);
    if (resolvedService !== backend.service) {
      console.log(`   解析为: ${resolvedService}`);
    }

    // 记录统计
    configManager.recordConnection(sni);

    // 连接到后端（明文）
    console.log(`🔌 正在连接后端: ${resolvedService}:${backend.port}`);

    const backendSocket = await Bun.connect({
      hostname: resolvedService,
      port: backend.port,
      socket: {
        data(_backendSocket: any, backendData: Buffer) {
          // 后端 → 客户端（TLS 加密）
          console.log(`📤 后端 → 客户端: ${backendData.length} bytes`);
          tlsSocket.write(backendData);
        },
        open(_backendSocket: any) {
          console.log(`✅ 后端连接成功: ${resolvedService}:${backend.port}`);
        },
        close(_backendSocket: any) {
          console.log(`🔌 后端连接关闭: ${resolvedService}:${backend.port}`);
          tlsSocket.end();
        },
        error(_backendSocket: any, error: Error) {
          console.error(`❌ 后端连接错误 (${backend.service}:${backend.port}):`, error);
          tlsSocket.end();
        },
      },
    });

    // 客户端 → 后端（明文）
    tlsSocket.on('data', (data: Buffer) => {
      console.log(`📥 客户端 → 后端: ${data.length} bytes`);
      backendSocket.write(data);
    });

    tlsSocket.on('end', () => {
      console.log(`🔌 客户端连接关闭: ${sni}`);
      backendSocket.end();
    });

    tlsSocket.on('error', (error: Error) => {
      console.error(`❌ 客户端连接错误 (${sni}):`, error);
      backendSocket.end();
    });

  } catch (error) {
    console.error('❌ 处理 TLS 连接失败:', error);
    tlsSocket.end();
  }
}

// 创建 TLS 服务器（TLS 终止模式）
export async function startSNIRouter(port: number) {
  // 等待配置管理器初始化
  await configManager.waitForInit();

  // 获取 TLS 证书
  const cert = certManager.getCertificate('*');

  if (!cert) {
    console.error('❌ 无法获取 TLS 证书，SNI Router 启动失败');
    process.exit(1);
  }

  // 创建 TLS 服务器
  const server = tls.createServer({
    cert: cert.cert,
    key: cert.key,
    // SNI 回调：为每个域名返回相同的证书
    SNICallback: (servername, cb) => {
      const domainCert = certManager.getCertificate(servername);
      if (domainCert) {
        cb(null, tls.createSecureContext({
          cert: domainCert.cert,
          key: domainCert.key,
        }));
      } else {
        cb(new Error(`No certificate for ${servername}`));
      }
    },
  }, (socket) => {
    handleTLSConnection(socket);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`✅ SNI Router (TLS 终止模式) 监听在 0.0.0.0:${port}`);
    console.log(`   TLS 证书已加载，将解密流量并转发到后端服务`);
  });

  server.on('error', (error) => {
    console.error('❌ TLS 服务器错误:', error);
  });

  return server;
}


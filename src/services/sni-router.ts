import { configManager } from './config-manager.ts';

// 从 TLS ClientHello 提取 SNI
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

// 处理客户端连接
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

    console.log(`✅ 路由到: ${backend.service}:${backend.port}`);

    // 记录统计
    configManager.recordConnection(sni);

    // 连接到后端
    const backendSocket = await Bun.connect({
      hostname: backend.service,
      port: backend.port,
      socket: {
        data(_backendSocket: any, backendData: Buffer) {
          // 后端 → 客户端
          socket.write(backendData);
        },
        close(_backendSocket: any) {
          socket.end();
        },
        error(_backendSocket: any, error: Error) {
          console.error(`❌ 后端连接错误 (${backend.service}:${backend.port}):`, error);
          socket.end();
        },
      },
    });

    // 标记已处理 SNI，保存后端 socket 引用
    (socket as any)._sniProcessed = true;
    (socket as any)._backendSocket = backendSocket;

    // 发送初始数据到后端
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

// 创建 TCP 服务器
export async function startSNIRouter(port: number) {
  // 等待配置管理器初始化
  await configManager.waitForInit();

  const server = Bun.listen({
    hostname: '0.0.0.0',
    port: port,
    socket: {
      data(socket: any, data: Buffer) {
        handleClientConnection(socket, data).catch((error) => {
          console.error('❌ 处理连接失败:', error);
          socket.end();
        });
      },

      error(_socket: any, error: Error) {
        console.error('❌ Socket 错误:', error);
      },
    },
  });

  console.log(`✅ SNI Router 监听在 ${server.hostname}:${server.port}`);

  return server;
}


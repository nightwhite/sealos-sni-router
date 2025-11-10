import { readFileSync } from 'fs';

// 缓存 namespace，避免重复读取文件
let cachedNamespace: string | null | undefined = undefined;

/**
 * 获取当前 Pod 所在的 namespace
 */
export function getCurrentNamespace(): string | null {
  // 如果已经缓存，直接返回
  if (cachedNamespace !== undefined) {
    return cachedNamespace;
  }
  try {
    // 方法 1: 从 ServiceAccount 文件读取（标准方式）
    const namespace = readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'utf-8').trim();
    cachedNamespace = namespace;
    return namespace;
  } catch (error) {
    // 方法 2: 从 /etc/resolv.conf 的 search domain 推断
    try {
      const resolvConf = readFileSync('/etc/resolv.conf', 'utf-8');
      const searchLine = resolvConf.split('\n').find(line => line.startsWith('search '));

      if (searchLine) {
        // search 格式: search ns-bgywgilf.svc.cluster.local svc.cluster.local cluster.local
        const firstDomain = searchLine.split(/\s+/)[1];
        if (firstDomain && firstDomain.endsWith('.svc.cluster.local')) {
          const namespace = firstDomain.replace('.svc.cluster.local', '');
          console.log(`📍 检测到 namespace: ${namespace}`);
          cachedNamespace = namespace;
          return namespace;
        }
      }
    } catch (resolvError) {
      // 忽略
    }

    cachedNamespace = null;
    return null;
  }
}

/**
 * 解析服务名，自动补全 namespace 和域名后缀
 * 
 * 支持的格式：
 * 1. service-name -> service-name.current-namespace.svc.cluster.local
 * 2. service-name.namespace -> service-name.namespace.svc.cluster.local
 * 3. service-name.namespace.svc -> service-name.namespace.svc.cluster.local
 * 4. service-name.namespace.svc.cluster.local -> 保持不变
 * 
 * @param serviceName 服务名称
 * @returns 完整的服务域名
 */
export function resolveServiceName(serviceName: string): string {
  // 如果已经是完整域名，直接返回
  if (serviceName.includes('.svc.cluster.local')) {
    return serviceName;
  }

  const parts = serviceName.split('.');

  // 情况 1: 只有服务名 (service-name)
  if (parts.length === 1) {
    const currentNamespace = getCurrentNamespace();
    if (currentNamespace) {
      return `${serviceName}.${currentNamespace}.svc.cluster.local`;
    }
    // 如果无法获取 namespace，返回原始名称（让 DNS 自己解析）
    return serviceName;
  }

  // 情况 2: 服务名.namespace (service-name.namespace)
  if (parts.length === 2) {
    return `${serviceName}.svc.cluster.local`;
  }

  // 情况 3: 服务名.namespace.svc (service-name.namespace.svc)
  if (parts.length === 3 && parts[2] === 'svc') {
    return `${serviceName}.cluster.local`;
  }

  // 其他情况，返回原始名称
  return serviceName;
}

/**
 * 尝试多种方式解析服务名
 * 返回所有可能的服务名列表，按优先级排序
 * 
 * @param serviceName 原始服务名
 * @returns 可能的服务名列表
 */
export function getPossibleServiceNames(serviceName: string): string[] {
  const results: string[] = [];
  
  // 1. 首先尝试用户提供的原始名称
  results.push(serviceName);

  // 2. 如果不包含点，尝试补全当前 namespace
  if (!serviceName.includes('.')) {
    const currentNamespace = getCurrentNamespace();
    if (currentNamespace) {
      results.push(`${serviceName}.${currentNamespace}.svc.cluster.local`);
    }
  }

  // 3. 如果只有一个点（service.namespace），补全后缀
  const parts = serviceName.split('.');
  if (parts.length === 2) {
    results.push(`${serviceName}.svc.cluster.local`);
  }

  // 4. 如果有两个点且第三部分是 svc，补全 cluster.local
  if (parts.length === 3 && parts[2] === 'svc') {
    results.push(`${serviceName}.cluster.local`);
  }

  // 去重
  return [...new Set(results)];
}


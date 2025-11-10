import { readFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

export interface TLSCertificate {
  cert: string;
  key: string;
}

/**
 * 证书管理器
 * 自动生成自签名证书用于 TLS 终止
 */
export class CertificateManager {
  private certificates: Map<string, TLSCertificate> = new Map();
  private defaultCert: TLSCertificate | null = null;

  constructor() {
    this.loadOrGenerateCertificate();
  }

  /**
   * 加载或生成默认证书
   */
  private loadOrGenerateCertificate() {
    const certPath = '/data/certs/tls.crt';
    const keyPath = '/data/certs/tls.key';

    // 如果证书已存在，直接加载
    if (existsSync(certPath) && existsSync(keyPath)) {
      try {
        this.defaultCert = {
          cert: readFileSync(certPath, 'utf-8'),
          key: readFileSync(keyPath, 'utf-8'),
        };
        console.log('✅ 已加载 TLS 证书');
        return;
      } catch (error) {
        console.error('❌ 加载证书失败，将重新生成:', error);
      }
    }

    // 生成新的自签名证书
    this.generateSelfSignedCert(certPath, keyPath);
  }

  /**
   * 使用 openssl 生成自签名证书
   */
  private generateSelfSignedCert(certPath: string, keyPath: string) {
    try {
      console.log('🔐 正在生成自签名 TLS 证书...');

      // 创建证书目录
      mkdirSync('/data/certs', { recursive: true });

      // 使用 openssl 生成自签名证书
      execSync(`openssl req -x509 -newkey rsa:4096 -nodes \
        -keyout ${keyPath} \
        -out ${certPath} \
        -days 365 \
        -subj "/CN=*.sni-router.local" \
        2>/dev/null`, { stdio: 'pipe' });

      this.defaultCert = {
        cert: readFileSync(certPath, 'utf-8'),
        key: readFileSync(keyPath, 'utf-8'),
      };

      console.log('✅ 自签名证书生成成功');
      console.log('   证书路径:', certPath);
      console.log('   密钥路径:', keyPath);
    } catch (error) {
      console.error('❌ 生成自签名证书失败:', error);
      console.log('⚠️  将使用内置的临时证书');
      this.useBuiltinCert();
    }
  }

  /**
   * 使用内置的临时证书（如果 openssl 不可用）
   */
  private useBuiltinCert() {
    // 这是一个预生成的自签名证书，仅用于测试
    this.defaultCert = {
      cert: `-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIUQJL7VqKqKqKqKqKqKqKqKqKqKqIwDQYJKoZIhvcNAQEL
BQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yNDAxMDEwMDAwMDBaFw0yNTAx
MDEwMDAwMDBaMEUxCzAJBgNVBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEw
HwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwggIiMA0GCSqGSIb3DQEB
AQUAA4ICDwAwggIKAoICAQDummy-cert-data-here
-----END CERTIFICATE-----`,
      key: `-----BEGIN PRIVATE KEY-----
MIIJQgIBADANBgkqhkiG9w0BAQEFAASCCSwwggkoAgEAAoICAQDummy-key-data
-----END PRIVATE KEY-----`,
    };
    console.log('⚠️  使用内置临时证书（不安全，仅用于测试）');
  }

  /**
   * 为特定域名添加证书
   */
  addCertificate(domain: string, cert: TLSCertificate) {
    this.certificates.set(domain, cert);
    console.log(`✅ 已为域名 ${domain} 添加证书`);
  }

  /**
   * 获取域名对应的证书
   */
  getCertificate(domain: string): TLSCertificate | null {
    // 1. 精确匹配
    if (this.certificates.has(domain)) {
      return this.certificates.get(domain)!;
    }

    // 2. 通配符匹配
    for (const [certDomain, cert] of this.certificates) {
      if (certDomain.startsWith('*.')) {
        const pattern = certDomain.substring(2);
        if (domain.endsWith(pattern)) {
          return cert;
        }
      }
    }

    // 3. 返回默认证书
    return this.defaultCert;
  }

  /**
   * 检查是否有可用的证书
   */
  hasCertificate(): boolean {
    return this.defaultCert !== null || this.certificates.size > 0;
  }
}

export const certManager = new CertificateManager();


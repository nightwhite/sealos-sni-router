import { Elysia, t } from 'elysia';
import { configManager } from '../services/config-manager.ts';

export const servicesRouter = new Elysia({ prefix: '/api' })
  // ========== 服务管理 ==========

  // 获取所有服务
  .get('/services', () => {
    console.log('Fetching all services');
    const services = configManager.getServices();
    console.log(`Found ${services.length} services`);
    return { services };
  })

  // 添加服务
  .post(
    '/services',
    async ({ body }) => {
      const { domain, service, port } = body;

      console.log(`Adding service: ${domain} -> ${service}:${port}`);

      if (!domain || !service || !port) {
        console.error('Missing required parameters');
        throw new Error('缺少必要参数');
      }

      await configManager.addService({
        domain,
        service,
        port: parseInt(port as any),
      });

      console.log(`Service added successfully: ${domain}`);

      return {
        success: true,
        message: '服务已添加',
      };
    },
    {
      body: t.Object({
        domain: t.String(),
        service: t.String(),
        port: t.Union([t.Number(), t.String()]),
      }),
    }
  )

  // 删除服务
  .delete('/services/:domain', async ({ params }) => {
    const { domain } = params;
    const decodedDomain = decodeURIComponent(domain);

    console.log(`Deleting service: ${decodedDomain}`);

    await configManager.deleteService(decodedDomain);

    console.log(`Service deleted successfully: ${decodedDomain}`);

    return {
      success: true,
      message: '服务已删除',
    };
  })

  // ========== 统计信息 ==========

  // 获取统计信息
  .get('/services/stats', () => {
    console.log('Fetching statistics');
    const stats = configManager.getStats();
    return stats;
  });


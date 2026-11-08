/**
 * backup controller — Executes pg_dump and saves to /opt/app/database/
 * Auth is handled manually (route has auth:false to bypass Strapi permissions)
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export default {
  async create(ctx: any) {
    // --- Manual JWT verification ---
    const authHeader = ctx.request.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      ctx.status = 401;
      ctx.body = { success: false, error: 'Bạn cần đăng nhập để thực hiện backup.' };
      return;
    }

    let decodedUser: any = null;
    try {
      const jwtService = strapi.plugins['users-permissions']?.services?.jwt;
      if (jwtService) {
        decodedUser = await jwtService.verify(token);
      }
    } catch (err) {
      ctx.status = 401;
      ctx.body = { success: false, error: 'Token không hợp lệ hoặc đã hết hạn.' };
      return;
    }

    if (!decodedUser) {
      ctx.status = 401;
      ctx.body = { success: false, error: 'Không thể xác thực người dùng.' };
      return;
    }

    // --- Build filename ---
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dd = pad(now.getDate());
    const mm = pad(now.getMonth() + 1);
    const yyyy = now.getFullYear();
    const HH = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    const filename = `backup_${dd}${mm}${yyyy}_${HH}${min}${ss}.sql`;

    // --- Output directory (mounted volume) ---
    const outputDir = '/opt/app/database';
    const outputPath = path.join(outputDir, filename);

    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // --- Read DB config from environment ---
    const dbHost = process.env.DATABASE_HOST || 'db';
    const dbPort = process.env.DATABASE_PORT || '5432';
    const dbName = process.env.DATABASE_NAME || 'edumaster';
    const dbUser = process.env.DATABASE_USERNAME || 'postgres';
    const dbPassword = process.env.DATABASE_PASSWORD || '123456';

    return new Promise((resolve) => {
      const env = { ...process.env, PGPASSWORD: dbPassword };

      const pgDump = spawn(
        'pg_dump',
        [
          '-h', dbHost,
          '-p', dbPort,
          '-U', dbUser,
          '-d', dbName,
          '--no-owner',
          '--no-acl',
          '-f', outputPath,
        ],
        { env }
      );

      let errorOutput = '';
      pgDump.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pgDump.on('close', (code) => {
        if (code === 0) {
          const stats = fs.statSync(outputPath);
          const sizeKB = Math.round(stats.size / 1024);
          strapi.log.info(`[Backup] Success: ${filename} (${sizeKB} KB)`);

          // --- Auto-cleanup: giữ tối đa 10 bản backup thủ công ---
          const KEEP_COUNT = 10;
          const deletedFiles: string[] = [];
          try {
            const allFiles = fs.readdirSync(outputDir)
              .filter(f => /^backup_\d{8}_\d{6}\.sql$/.test(f))
              .map(f => ({
                name: f,
                time: fs.statSync(path.join(outputDir, f)).mtimeMs,
              }))
              .sort((a, b) => b.time - a.time); // mới nhất trước

            const toDelete = allFiles.slice(KEEP_COUNT);
            for (const f of toDelete) {
              fs.unlinkSync(path.join(outputDir, f.name));
              deletedFiles.push(f.name);
              strapi.log.info(`[Backup] Đã xóa bản cũ: ${f.name}`);
            }
          } catch (cleanupErr: any) {
            strapi.log.warn(`[Backup] Cleanup warning: ${cleanupErr.message}`);
          }

          ctx.body = {
            success: true,
            file: filename,
            filename,
            sizeKB,
            totalBackups: Math.min(KEEP_COUNT, fs.readdirSync(outputDir).filter(f => f.endsWith('.sql')).length),
            message: `Backup thành công! File: ${filename} (${(sizeKB / 1024).toFixed(1)} MB)${deletedFiles.length > 0 ? ` — Đã xóa ${deletedFiles.length} bản cũ` : ''}`,
            deletedFiles,
          };
          resolve(null);
        } else {
          strapi.log.error(`[Backup] pg_dump failed (code ${code}): ${errorOutput}`);
          ctx.status = 500;
          ctx.body = {
            success: false,
            error: `pg_dump thất bại (exit code ${code})`,
            detail: errorOutput,
          };
          resolve(null);
        }
      });

      pgDump.on('error', (err) => {
        strapi.log.error(`[Backup] Spawn error: ${err.message}`);
        ctx.status = 500;
        ctx.body = {
          success: false,
          error: `Không thể chạy pg_dump: ${err.message}`,
        };
        resolve(null);
      });
    });
  },
};

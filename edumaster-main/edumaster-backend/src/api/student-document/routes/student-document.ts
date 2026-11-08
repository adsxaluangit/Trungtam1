/**
 * student-document router
 */

import { factories } from '@strapi/strapi';

export default {
  routes: [
    // Custom route: tìm tài liệu theo CCCD (trước core routes để không bị ghi đè)
    {
      method: 'GET',
      path: '/student-documents/by-id-number',
      handler: 'student-document.findByIdNumber',
      config: {
        policies: [],
        auth: { scope: ['api::student-document.student-document.findByIdNumber'] }
      }
    },
    // Custom route: thay thế hoặc tạo mới document (tránh trùng lặp file)
    {
      method: 'POST',
      path: '/student-documents/replace-or-create',
      handler: 'student-document.replaceOrCreate',
      config: {
        policies: [],
        auth: { scope: ['api::student-document.student-document.replaceOrCreate'] }
      }
    },
    // Core CRUD routes
    { method: 'GET',    path: '/student-documents',      handler: 'student-document.find' },
    { method: 'GET',    path: '/student-documents/:id',  handler: 'student-document.findOne' },
    { method: 'POST',   path: '/student-documents',      handler: 'student-document.create' },
    { method: 'PUT',    path: '/student-documents/:id',  handler: 'student-document.update' },
    { method: 'DELETE', path: '/student-documents/:id',  handler: 'student-document.delete' },
  ]
};

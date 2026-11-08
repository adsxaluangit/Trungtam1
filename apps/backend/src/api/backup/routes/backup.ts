/**
 * backup router — Custom route for database backup
 * auth: false → we handle JWT verification manually in the controller
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/backup',
      handler: 'backup.create',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

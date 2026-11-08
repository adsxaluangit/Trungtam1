
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/auth/login-official',
      handler: 'auth-official.login',
      config: {
        auth: false,
      },
    },
  ],
};

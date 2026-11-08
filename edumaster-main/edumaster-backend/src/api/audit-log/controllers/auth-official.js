
'use strict';

module.exports = {
  async login(ctx) {
    const { identifier, password } = ctx.request.body;

    if (!identifier || !password) {
      return ctx.badRequest('Missing identifier or password');
    }

    try {
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: {
          $or: [
            { username: identifier },
            { email: identifier.toLowerCase() },
          ],
        },
        populate: ['role'],
      });

      if (!user) {
        return ctx.badRequest('Invalid identifier or password');
      }

      if (user.blocked) {
        return ctx.badRequest('Your account has been blocked');
      }

      const validPassword = await strapi.service('plugin::users-permissions.user').validatePassword(
        password,
        user.password
      );

      if (!validPassword) {
        return ctx.badRequest('Invalid identifier or password');
      }

      const jwt = strapi.service('plugin::users-permissions.jwt').issue({
        id: user.id,
      });

      return {
        jwt,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role?.name || 'Authenticated',
        },
      };
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  },
};

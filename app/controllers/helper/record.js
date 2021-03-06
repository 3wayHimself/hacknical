
import logger from '../../utils/logger';
import notify from '../../services/notify';
import { getValue } from '../../utils/helper';
import network from '../../services/network';

const updateViewData = async (ctx, options) => {
  const { platform, browser, device } = ctx.state;
  const {
    type = null,
    login = null,
  } = options;

  await network.stat.putRecords({
    type,
    login,
    platform,
    browser: browser || '',
  });
  if (type) {
    await network.stat.putStat({
      type,
      action: 'pageview'
    });
    notify.slack({
      mq: ctx.mq,
      data: {
        type: 'view',
        data: `【${type.toUpperCase()}:${login}】${device.toUpperCase()}:${platform.toUpperCase()}:${browser.toUpperCase()}`
      }
    });
  }
  logger.info(`[${type.toUpperCase()}:VIEW][${login}]`);
};

const collectGithubRecord = (key = 'params.login') => async (ctx, next) => {
  await next();
  const login = getValue(ctx, key);
  const { githubLogin } = ctx.session;

  // make sure that admin user's visit will not be collected.
  if (githubLogin !== login) {
    updateViewData(ctx, { login, type: 'github' });
  }
};

const getUser = async (ctx, source) => {
  const value = getValue(ctx, source);
  const key = source.split('.').slice(-1)[0];

  let user;
  if (key === 'hash') {
    const resumeInfo = await network.user.getResumeInfo({ hash: value });
    user = await network.user.getUser({ userId: resumeInfo.userId });
  } else {
    user = await network.user.getUser({ [key]: value });
  }

  return user;
};

const collectResumeRecordByHash = (key = 'params.hash') => async (ctx, next) => {
  const { notrace } = ctx.query;

  const user = await getUser(ctx, key);
  const login = user.githubLogin;

  const { githubLogin, fromDownload } = ctx.session;
  const isAdmin = user && login === githubLogin;

  ctx.query.isAdmin = isAdmin;
  ctx.query.userName = user ? user.userName : '';
  ctx.query.userLogin = user ? login : '';
  await next();

  if (
    !fromDownload
    && (!isAdmin && (notrace !== true || notrace !== 'true' || notrace === 'false'))
    && user
  ) {
    updateViewData(ctx, { login, type: 'resume' });
  }
};

export default {
  github: collectGithubRecord,
  resume: collectResumeRecordByHash,
};

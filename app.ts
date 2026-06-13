import { App, LogLevel } from '@slack/bolt';
import 'dotenv/config';
import registerListeners from './listeners/index.js';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: LogLevel.DEBUG,
});

registerListeners(app);

(async () => {
  try {
    await app.start(process.env.PORT || 3000);
    app.logger.info('Out of Context is running....');
  } catch (error) {
    app.logger.error('Unable to start App', error);
  }
})();
